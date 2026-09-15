using System.Data;
using Microsoft.Data.SqlClient;

namespace Zomato.Api.Common;

/// <summary>
/// Pure ADO.NET data access layer. Saare DB calls stored procedures ke through
/// hote hain - koi inline SQL nahi. SP jo columns return karti hai, wahi
/// JSON me chale jaate hain, isliye extra entity classes ki zaroorat nahi.
/// </summary>
public sealed class Db(IConfiguration config, ILogger<Db> logger)
{
    private readonly string _connectionString =
        config.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection missing in appsettings.json");

    public const int DefaultTimeoutSeconds = 60;

    /* =========================== public API =========================== */

    /// <summary>Ek result set laata hai.</summary>
    public async Task<List<Row>> QueryAsync(
        string procedure,
        SpParams? parameters = null,
        CancellationToken ct = default)
    {
        var sets = await QueryMultipleAsync(procedure, parameters, maxResultSets: 1, ct);
        return sets.Count > 0 ? sets[0] : [];
    }

    /// <summary>Pehli row, ya null.</summary>
    public async Task<Row?> QuerySingleAsync(
        string procedure,
        SpParams? parameters = null,
        CancellationToken ct = default)
    {
        var rows = await QueryAsync(procedure, parameters, ct);
        return rows.Count > 0 ? rows[0] : null;
    }

    /// <summary>Ek scalar value (pehli row, pehla column).</summary>
    public async Task<T?> QueryScalarAsync<T>(
        string procedure,
        SpParams? parameters = null,
        CancellationToken ct = default)
    {
        var row = await QuerySingleAsync(procedure, parameters, ct);
        if (row is null || row.Count == 0) return default;
        var value = row.Values.First();
        return value is null ? default : (T)Convert.ChangeType(value, typeof(T));
    }

    /// <summary>Multiple result sets (SP ke andar kai SELECT).</summary>
    public async Task<List<List<Row>>> QueryMultipleAsync(
        string procedure,
        SpParams? parameters = null,
        int maxResultSets = 20,
        CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await using var cmd = CreateCommand(conn, procedure, parameters);

        await conn.OpenAsync(ct);

        var result = new List<List<Row>>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);

        do
        {
            if (result.Count >= maxResultSets) break;
            result.Add(await ReadSetAsync(reader, ct));
        }
        while (await reader.NextResultAsync(ct));

        return result;
    }

    /// <summary>
    /// INSERT/UPDATE/DELETE. Rows affected return karta hai.
    /// </summary>
    public async Task<int> ExecuteAsync(
        string procedure,
        SpParams? parameters = null,
        CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await using var cmd = CreateCommand(conn, procedure, parameters);

        await conn.OpenAsync(ct);
        return await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// OUTPUT parameters wali SP ke liye (jaise usp_Order_Create).
    /// Result sets + output values dono milte hain.
    /// </summary>
    public async Task<SpResult> ExecuteWithOutputAsync(
        string procedure,
        SpParams parameters,
        CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await using var cmd = CreateCommand(conn, procedure, parameters);

        await conn.OpenAsync(ct);

        var sets = new List<List<Row>>();
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            do
            {
                sets.Add(await ReadSetAsync(reader, ct));
            }
            while (await reader.NextResultAsync(ct));
        }

        var outputs = new Row();
        foreach (var p in cmd.Parameters.Cast<SqlParameter>())
        {
            if (p.Direction is ParameterDirection.Output or ParameterDirection.InputOutput)
                outputs[p.ParameterName.TrimStart('@')] = p.Value is DBNull ? null : p.Value;
        }

        return new SpResult(sets, outputs);
    }

    /* ============================ internals =========================== */

    private SqlCommand CreateCommand(SqlConnection conn, string procedure, SpParams? parameters)
    {
        var cmd = new SqlCommand(procedure, conn)
        {
            CommandType = CommandType.StoredProcedure,
            CommandTimeout = DefaultTimeoutSeconds
        };

        if (parameters is null) return cmd;

        foreach (var (name, spec) in parameters)
        {
            var p = new SqlParameter
            {
                ParameterName = name.StartsWith('@') ? name : "@" + name,
                Direction = spec.Direction,
                Value = spec.Value ?? DBNull.Value
            };

            if (spec.TableTypeName is not null)
            {
                p.SqlDbType = SqlDbType.Structured;
                p.TypeName = spec.TableTypeName;
            }
            else if (spec.DbType.HasValue)
            {
                p.SqlDbType = spec.DbType.Value;
            }

            if (spec.Size.HasValue) p.Size = spec.Size.Value;
            if (spec.Precision.HasValue) p.Precision = spec.Precision.Value;
            if (spec.Scale.HasValue) p.Scale = spec.Scale.Value;

            cmd.Parameters.Add(p);
        }

        logger.LogDebug("EXEC {Procedure} ({ParamCount} params)", procedure, cmd.Parameters.Count);
        return cmd;
    }

    private static async Task<List<Row>> ReadSetAsync(SqlDataReader reader, CancellationToken ct)
    {
        var rows = new List<Row>();
        if (reader.FieldCount == 0) return rows;

        var names = new string[reader.FieldCount];
        for (var i = 0; i < reader.FieldCount; i++)
            names[i] = Camel(reader.GetName(i));

        while (await reader.ReadAsync(ct))
        {
            var row = new Row(reader.FieldCount);
            for (var i = 0; i < reader.FieldCount; i++)
                row[names[i]] = await reader.IsDBNullAsync(i, ct) ? null : reader.GetValue(i);

            rows.Add(row);
        }

        return rows;
    }

    /// <summary>SQL ka PascalCase column -> JSON ka camelCase key.</summary>
    private static string Camel(string name)
    {
        if (string.IsNullOrEmpty(name)) return name;
        if (name.Length == 1) return name.ToLowerInvariant();
        if (char.IsLower(name[0])) return name;

        // Poora UPPERCASE (e.g. "ID") ko lowercase kar do
        if (name.All(c => !char.IsLetter(c) || char.IsUpper(c)))
            return name.ToLowerInvariant();

        return char.ToLowerInvariant(name[0]) + name[1..];
    }
}

/// <summary>Ek DB row - column name (camelCase) se value.</summary>
public sealed class Row : Dictionary<string, object?>
{
    public Row() : base(StringComparer.OrdinalIgnoreCase) { }
    public Row(int capacity) : base(capacity, StringComparer.OrdinalIgnoreCase) { }

    public T? Get<T>(string key)
    {
        if (!TryGetValue(key, out var v) || v is null) return default;
        if (v is T typed) return typed;

        var target = typeof(T);
        if (target.IsGenericType && target.GetGenericTypeDefinition() == typeof(Nullable<>))
            target = Nullable.GetUnderlyingType(target)!;

        return (T)Convert.ChangeType(v, target);
    }

    public string? Str(string key) => TryGetValue(key, out var v) ? v?.ToString() : null;
    public int Int(string key) => Get<int?>(key) ?? 0;
    public long Long(string key) => Get<long?>(key) ?? 0;
    public decimal Dec(string key) => Get<decimal?>(key) ?? 0m;
    public bool Bool(string key) => Get<bool?>(key) ?? false;
}

/// <summary>Multi-result + output params ka wrapper.</summary>
public sealed record SpResult(List<List<Row>> ResultSets, Row Outputs)
{
    public List<Row> Set(int index) => index < ResultSets.Count ? ResultSets[index] : [];
    public Row? First(int index = 0) => Set(index).FirstOrDefault();
}

/// <summary>Ek SP parameter ki definition.</summary>
public sealed record SpParam(
    object? Value,
    ParameterDirection Direction = ParameterDirection.Input,
    SqlDbType? DbType = null,
    int? Size = null,
    byte? Precision = null,
    byte? Scale = null,
    string? TableTypeName = null);

/// <summary>
/// SP parameters ka builder. Fluent style:
/// new SpParams().Add("@UserId", 5).Out("@OrderId", SqlDbType.BigInt)
/// </summary>
public sealed class SpParams : Dictionary<string, SpParam>
{
    public SpParams() : base(StringComparer.OrdinalIgnoreCase) { }

    public SpParams Add(string name, object? value)
    {
        this[name] = new SpParam(value);
        return this;
    }

    /// <summary>Value null/empty ho to parameter hi skip - SP ka default lag jaayega.</summary>
    public SpParams AddIfNotNull(string name, object? value)
    {
        if (value is null) return this;
        if (value is string s && string.IsNullOrWhiteSpace(s)) return this;
        this[name] = new SpParam(value);
        return this;
    }

    public SpParams AddTvp(string name, System.Data.DataTable table, string typeName)
    {
        this[name] = new SpParam(table, TableTypeName: typeName);
        return this;
    }

    public SpParams Out(string name, SqlDbType type, int size = 0)
    {
        this[name] = new SpParam(null, ParameterDirection.Output, type, size == 0 ? null : size);
        return this;
    }
}
