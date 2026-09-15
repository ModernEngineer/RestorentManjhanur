using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Zomato.Api.Services;

/// <summary>
/// Razorpay ka asli implementation.
///
/// Flow:
///   1. CreateOrderAsync  -> Razorpay par order banta hai, order_id milta hai
///   2. Frontend Razorpay checkout kholta hai (key_id + order_id ke saath)
///   3. Customer pay karta hai -> Razorpay 3 cheezein deta hai:
///      razorpay_order_id, razorpay_payment_id, razorpay_signature
///   4. VerifyPayment signature check karta hai:
///      HMAC_SHA256("{order_id}|{payment_id}", key_secret) == signature
///
/// Key secret kabhi browser tak nahi jaata - sirf key_id public hota hai.
/// </summary>
public sealed class RazorpayGateway(
    IHttpClientFactory httpClientFactory,
    IOptions<PaymentSettings> options,
    ILogger<RazorpayGateway> logger) : IPaymentGateway
{
    public const string HttpClientName = "razorpay";

    private readonly PaymentSettings _s = options.Value;

    public string Provider => "RAZORPAY";

    /* ============================ create order ========================== */

    public async Task<GatewayOrder> CreateOrderAsync(
        decimal amount,
        string receipt,
        CancellationToken ct = default)
    {
        if (amount <= 0)
            throw new ArgumentOutOfRangeException(nameof(amount), "Amount 0 se zyada honi chahiye.");

        EnsureConfigured();

        // Razorpay amount PAISE me leta hai (integer). 702.90 -> 70290
        var paise = (long)Math.Round(amount * 100m, MidpointRounding.AwayFromZero);

        // receipt max 40 characters
        var safeReceipt = receipt.Length > 40 ? receipt[..40] : receipt;

        var payload = new
        {
            amount = paise,
            currency = _s.Currency,
            receipt = safeReceipt,
            payment_capture = 1,   // paise turant capture ho jaayein
        };

        var client = httpClientFactory.CreateClient(HttpClientName);

        using var request = new HttpRequestMessage(HttpMethod.Post, "orders")
        {
            Content = JsonContent.Create(payload),
        };

        HttpResponseMessage response;
        try
        {
            response = await client.SendAsync(request, ct);
        }
        catch (HttpRequestException ex)
        {
            logger.LogError(ex, "Razorpay tak pahunch nahi paaye");
            throw new InvalidOperationException(
                "Razorpay se connect nahi ho paaya. Internet ya Razorpay ka status check karo.", ex);
        }

        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            var reason = ExtractError(body) ?? $"HTTP {(int)response.StatusCode}";
            logger.LogError("Razorpay order create fail: {Status} {Body}", response.StatusCode, body);

            throw new InvalidOperationException($"Razorpay ne order reject kiya: {reason}");
        }

        var order = JsonSerializer.Deserialize<RazorpayOrder>(body);

        if (order is null || string.IsNullOrWhiteSpace(order.Id))
        {
            logger.LogError("Razorpay ka response samajh nahi aaya: {Body}", body);
            throw new InvalidOperationException("Razorpay ne order id nahi bheji.");
        }

        logger.LogInformation("Razorpay order bana: {OrderId} ({Paise} paise, receipt {Receipt})",
            order.Id, paise, safeReceipt);

        return new GatewayOrder(
            order.Id,
            _s.KeyId,
            amount,
            _s.Currency,
            Provider);
    }

    /* =========================== verify payment ========================= */

    public GatewayVerification VerifyPayment(
        string gatewayOrderId,
        string gatewayPaymentId,
        string signature)
    {
        if (string.IsNullOrWhiteSpace(gatewayOrderId) ||
            string.IsNullOrWhiteSpace(gatewayPaymentId) ||
            string.IsNullOrWhiteSpace(signature))
            return new GatewayVerification(false, "Payment details adhoore hain.");

        EnsureConfigured();

        // Razorpay ka formula: HMAC_SHA256(order_id + "|" + payment_id, key_secret)
        var expected = Convert.ToHexString(
                HMACSHA256.HashData(
                    Encoding.UTF8.GetBytes(_s.KeySecret),
                    Encoding.UTF8.GetBytes($"{gatewayOrderId}|{gatewayPaymentId}")))
            .ToLowerInvariant();

        var provided = signature.Trim().ToLowerInvariant();

        var match = CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected),
            Encoding.UTF8.GetBytes(provided));

        if (!match)
        {
            logger.LogWarning("Razorpay signature match nahi hui - order {OrderId}, payment {PaymentId}",
                gatewayOrderId, gatewayPaymentId);

            return new GatewayVerification(false,
                "Signature verify nahi hui - payment genuine nahi lag raha.");
        }

        return new GatewayVerification(true, null);
    }

    /// <summary>Real gateway par test signature banane ka koi option nahi.</summary>
    public string? SignForTesting(string gatewayOrderId, string gatewayPaymentId) => null;

    /* =============================== helpers =========================== */

    private void EnsureConfigured()
    {
        if (string.IsNullOrWhiteSpace(_s.KeyId) || string.IsNullOrWhiteSpace(_s.KeySecret))
            throw new InvalidOperationException(
                "Razorpay keys set nahi hain. Payment:KeyId aur Payment:KeySecret configure karo " +
                "(secret ke liye User Secrets ya environment variable use karo).");
    }

    /// <summary>Razorpay ke error JSON se readable message nikalta hai.</summary>
    private static string? ExtractError(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);

            if (doc.RootElement.TryGetProperty("error", out var error))
            {
                var description = error.TryGetProperty("description", out var d) ? d.GetString() : null;
                var code = error.TryGetProperty("code", out var c) ? c.GetString() : null;

                return string.IsNullOrWhiteSpace(code) ? description : $"{description} ({code})";
            }
        }
        catch (JsonException)
        {
            // JSON nahi hai - null return karke caller HTTP status dikhayega
        }

        return null;
    }

    private sealed class RazorpayOrder
    {
        [JsonPropertyName("id")] public string? Id { get; set; }
        [JsonPropertyName("amount")] public long Amount { get; set; }
        [JsonPropertyName("currency")] public string? Currency { get; set; }
        [JsonPropertyName("receipt")] public string? Receipt { get; set; }
        [JsonPropertyName("status")] public string? Status { get; set; }
    }
}

/* ===================================================================== */

public static class RazorpayServiceCollectionExtensions
{
    /// <summary>
    /// Razorpay ka HttpClient register karta hai - base URL aur Basic auth
    /// header ek hi jagah set ho jaate hain.
    /// </summary>
    public static IServiceCollection AddRazorpayHttpClient(
        this IServiceCollection services,
        PaymentSettings settings)
    {
        services.AddHttpClient(RazorpayGateway.HttpClientName, client =>
        {
            client.BaseAddress = new Uri("https://api.razorpay.com/v1/");
            client.Timeout = TimeSpan.FromSeconds(30);

            var basic = Convert.ToBase64String(
                Encoding.UTF8.GetBytes($"{settings.KeyId}:{settings.KeySecret}"));

            client.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Basic", basic);

            client.DefaultRequestHeaders.Accept.Add(
                new MediaTypeWithQualityHeaderValue("application/json"));
        });

        return services;
    }
}
