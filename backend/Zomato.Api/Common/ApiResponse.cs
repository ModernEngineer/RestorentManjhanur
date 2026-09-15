namespace Zomato.Api.Common;

/// <summary>
/// Saari API responses ka ek hi shape - frontend me handling aasan rehti hai.
/// { success, message, data, errors }
/// </summary>
public sealed class ApiResponse<T>
{
    public bool Success { get; init; }
    public string? Message { get; init; }
    public T? Data { get; init; }
    public IReadOnlyList<string>? Errors { get; init; }

    public static ApiResponse<T> Ok(T data, string? message = null) =>
        new() { Success = true, Data = data, Message = message };

    public static ApiResponse<T> Fail(string message, IReadOnlyList<string>? errors = null) =>
        new() { Success = false, Message = message, Errors = errors };
}

public static class ApiResponse
{
    public static ApiResponse<object?> Ok(string message) =>
        new() { Success = true, Message = message };

    public static ApiResponse<object?> Fail(string message) =>
        new() { Success = false, Message = message };

    public static ApiResponse<T> Ok<T>(T data, string? message = null) =>
        ApiResponse<T>.Ok(data, message);
}

/// <summary>Pagination ke saath list response.</summary>
public sealed class PagedResult<T>
{
    public IReadOnlyList<T> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int PageNumber { get; init; }
    public int PageSize { get; init; }
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
    public bool HasNextPage => PageNumber < TotalPages;
    public bool HasPreviousPage => PageNumber > 1;

    public static PagedResult<Row> FromRows(List<Row> rows, int pageNumber, int pageSize)
    {
        // SP har row me COUNT(*) OVER() ko TotalCount ke naam se bhejti hai
        var total = rows.Count > 0 ? rows[0].Int("totalCount") : 0;
        if (total == 0 && rows.Count > 0) total = rows.Count;

        foreach (var r in rows) r.Remove("totalCount");

        return new PagedResult<Row>
        {
            Items = rows,
            TotalCount = total,
            PageNumber = pageNumber,
            PageSize = pageSize
        };
    }
}
