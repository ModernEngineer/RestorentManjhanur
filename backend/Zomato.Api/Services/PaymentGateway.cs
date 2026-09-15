using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Zomato.Api.Services;

public sealed class PaymentSettings
{
    /// <summary>MOCK | RAZORPAY  (abhi MOCK active hai)</summary>
    public string Provider { get; set; } = "MOCK";
    public string KeyId { get; set; } = "mock_key_id";
    public string KeySecret { get; set; } = "mock_key_secret";
    public string Currency { get; set; } = "INR";
}

public sealed record GatewayOrder(
    string GatewayOrderId,
    string PublicKeyId,
    decimal Amount,
    string Currency,
    string Provider);

public sealed record GatewayVerification(bool IsValid, string? Reason);

/// <summary>
/// Payment gateway ka contract. Aaj MockPaymentGateway lagi hai;
/// Razorpay/Stripe aane par sirf ye interface implement karna hai,
/// controllers aur DB layer waise hi rahenge.
/// </summary>
public interface IPaymentGateway
{
    string Provider { get; }

    /// <summary>Gateway par order banata hai, checkout ke liye ids deta hai.</summary>
    Task<GatewayOrder> CreateOrderAsync(decimal amount, string receipt, CancellationToken ct = default);

    /// <summary>Callback me aayi signature verify karta hai.</summary>
    GatewayVerification VerifyPayment(string gatewayOrderId, string gatewayPaymentId, string signature);

    /// <summary>
    /// Sirf MOCK ke liye: client ki jagah server hi valid signature bana deta hai,
    /// taaki poora success/failure flow bina real gateway test ho sake.
    /// Real gateway me ye null return karega.
    /// </summary>
    string? SignForTesting(string gatewayOrderId, string gatewayPaymentId);
}

/// <summary>
/// Mock gateway - koi network call nahi, par signature HMAC se banti aur
/// verify hoti hai, isliye tampering bhi pakdi jaati hai.
/// </summary>
public sealed class MockPaymentGateway(IOptions<PaymentSettings> options, ILogger<MockPaymentGateway> logger)
    : IPaymentGateway
{
    private readonly PaymentSettings _s = options.Value;

    public string Provider => "MOCK";

    public Task<GatewayOrder> CreateOrderAsync(decimal amount, string receipt, CancellationToken ct = default)
    {
        if (amount <= 0)
            throw new ArgumentOutOfRangeException(nameof(amount), "Amount 0 se zyada honi chahiye.");

        var gatewayOrderId = "mock_order_" + Guid.NewGuid().ToString("N")[..16];

        logger.LogInformation("MOCK gateway order banaya: {OrderId} for {Amount} (receipt {Receipt})",
            gatewayOrderId, amount, receipt);

        return Task.FromResult(new GatewayOrder(
            gatewayOrderId,
            _s.KeyId,
            amount,
            _s.Currency,
            Provider));
    }

    public GatewayVerification VerifyPayment(string gatewayOrderId, string gatewayPaymentId, string signature)
    {
        if (string.IsNullOrWhiteSpace(gatewayOrderId) ||
            string.IsNullOrWhiteSpace(gatewayPaymentId) ||
            string.IsNullOrWhiteSpace(signature))
            return new GatewayVerification(false, "Payment details adhoore hain.");

        var expected = Sign(gatewayOrderId, gatewayPaymentId);

        var match = CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected),
            Encoding.UTF8.GetBytes(signature));

        return match
            ? new GatewayVerification(true, null)
            : new GatewayVerification(false, "Signature match nahi hui - payment verify nahi ho saka.");
    }

    public string? SignForTesting(string gatewayOrderId, string gatewayPaymentId) =>
        Sign(gatewayOrderId, gatewayPaymentId);

    private string Sign(string orderId, string paymentId)
    {
        var payload = $"{orderId}|{paymentId}";
        var bytes = HMACSHA256.HashData(
            Encoding.UTF8.GetBytes(_s.KeySecret),
            Encoding.UTF8.GetBytes(payload));

        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    public static string NewPaymentRef(string purpose) =>
        $"PAY-{purpose}-{DateTime.UtcNow.ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture)}-{Random.Shared.Next(1000, 9999)}";
}
