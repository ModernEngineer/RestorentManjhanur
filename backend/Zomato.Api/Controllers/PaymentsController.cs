using System.Text.Json;
using Zomato.Api.Models;

namespace Zomato.Api.Controllers;

/// <summary>
/// Payment flow (abhi MOCK gateway par):
///   1) POST /api/payments/create   -> gateway order + paymentRef milta hai
///   2) checkout UI par pay karo
///   3) POST /api/payments/verify   -> signature verify, order CONFIRMED
///
/// Razorpay/Stripe lagane par sirf IPaymentGateway ka naya implementation
/// register karna hai - ye controller aur SPs same rahenge.
/// </summary>
[ApiController]
[Route("api/payments")]
[Authorize]
public sealed class PaymentsController(
    Db db,
    IPaymentGateway gateway,
    ILogger<PaymentsController> logger) : ControllerBase
{
    /* ============================== CREATE ============================ */

    [HttpPost("create")]
    public async Task<IActionResult> Create([FromBody] CreatePaymentRequest req, CancellationToken ct)
    {
        var purpose = req.PurposeType.ToUpperInvariant();
        var userId = User.UserId();

        decimal amount;
        string receipt;

        if (purpose == "ORDER")
        {
            var order = await db.QuerySingleAsync("dbo.usp_Order_GetById", new SpParams()
                .Add("@OrderId", req.OrderId!.Value)
                .Add("@ForUserId", userId)
                .Add("@RestrictToUser", true), ct);

            if (order is null)
                return NotFound(ApiResponse.Fail("Order nahi mila."));

            if (order.Str("paymentStatus") == "PAID")
                return BadRequest(ApiResponse.Fail("Is order ka payment pehle ho chuka hai."));

            if (order.Str("paymentMode") == "COD")
                return BadRequest(ApiResponse.Fail("COD order me online payment ki zaroorat nahi."));

            if (order.Str("status") is "CANCELLED" or "REJECTED")
                return BadRequest(ApiResponse.Fail("Cancelled order ka payment nahi ho sakta."));

            amount = order.Dec("totalAmount");
            receipt = order.Str("orderNumber") ?? $"ORD-{req.OrderId}";
        }
        else /* HALL */
        {
            var bookings = await db.QueryAsync("dbo.usp_HallBooking_List", new SpParams()
                .Add("@UserId", userId)
                .Add("@PageSize", 100), ct);

            var booking = bookings.FirstOrDefault(b => b.Long("bookingId") == req.HallBookingId!.Value);

            if (booking is null)
                return NotFound(ApiResponse.Fail("Hall booking nahi mili."));

            if (booking.Str("paymentStatus") == "PAID")
                return BadRequest(ApiResponse.Fail("Is booking ka advance pehle mil chuka hai."));

            if (booking.Str("status") is "CANCELLED" or "REJECTED")
                return BadRequest(ApiResponse.Fail("Cancelled booking ka payment nahi ho sakta."));

            // 30% advance
            amount = Math.Round(booking.Dec("totalAmount") * 0.30m, 2);
            receipt = booking.Str("bookingNumber") ?? $"HALL-{req.HallBookingId}";
        }

        if (amount <= 0)
            return BadRequest(ApiResponse.Fail("Payable amount 0 hai."));

        var gatewayOrder = await gateway.CreateOrderAsync(amount, receipt, ct);
        var paymentRef = MockPaymentGateway.NewPaymentRef(purpose);

        await db.QuerySingleAsync("dbo.usp_Payment_Create", new SpParams()
            .Add("@UserId", userId)
            .AddIfNotNull("@OrderId", purpose == "ORDER" ? req.OrderId : null)
            .AddIfNotNull("@HallBookingId", purpose == "HALL" ? req.HallBookingId : null)
            .Add("@PurposeType", purpose)
            .Add("@Amount", amount)
            .Add("@GatewayName", gateway.Provider)
            .Add("@GatewayOrderId", gatewayOrder.GatewayOrderId)
            .Add("@PaymentRef", paymentRef), ct);

        logger.LogInformation("Payment created {PaymentRef} ({Amount}) for {Purpose}", paymentRef, amount, purpose);

        return Ok(ApiResponse.Ok(new
        {
            paymentRef,
            gatewayOrderId = gatewayOrder.GatewayOrderId,
            keyId = gatewayOrder.PublicKeyId,
            amount = gatewayOrder.Amount,
            currency = gatewayOrder.Currency,
            provider = gatewayOrder.Provider,
            receipt
        }, "Payment initiate ho gaya."));
    }

    /* ============================== VERIFY ============================ */

    [HttpPost("verify")]
    public async Task<IActionResult> Verify([FromBody] VerifyPaymentRequest req, CancellationToken ct)
    {
        var verification = gateway.VerifyPayment(req.GatewayOrderId, req.GatewayPaymentId, req.Signature);

        var status = verification.IsValid ? "PAID" : "FAILED";

        var payload = JsonSerializer.Serialize(new
        {
            req.GatewayOrderId,
            req.GatewayPaymentId,
            req.Method,
            verifiedAt = DateTime.UtcNow,
            gateway = gateway.Provider
        });

        var row = await db.QuerySingleAsync("dbo.usp_Payment_Complete", new SpParams()
            .Add("@PaymentRef", req.PaymentRef)
            .Add("@GatewayPaymentId", req.GatewayPaymentId)
            .Add("@GatewaySignature", req.Signature)
            .Add("@Status", status)
            .AddIfNotNull("@Method", req.Method?.ToUpperInvariant())
            .AddIfNotNull("@FailureReason", verification.Reason)
            .Add("@RawPayload", payload), ct);

        if (row is null || row.Int("affectedRows") == 0)
            return NotFound(ApiResponse.Fail(row?.Str("message") ?? "Payment reference nahi mila."));

        if (!verification.IsValid)
        {
            logger.LogWarning("Payment verify fail {PaymentRef}: {Reason}", req.PaymentRef, verification.Reason);
            return BadRequest(ApiResponse.Fail(verification.Reason ?? "Payment verify nahi ho saka."));
        }

        logger.LogInformation("Payment {PaymentRef} PAID", req.PaymentRef);

        return Ok(ApiResponse.Ok(new
        {
            paymentRef = req.PaymentRef,
            status,
            orderId = row.Get<long?>("orderId"),
            hallBookingId = row.Get<long?>("hallBookingId")
        }, "Payment successful! Order confirm ho gaya."));
    }

    /* ==================== MOCK-ONLY test helper ======================= */

    /// <summary>
    /// Sirf MOCK gateway ke liye - checkout simulate karta hai aur valid
    /// signature deta hai, taaki poora flow bina real gateway test ho jaaye.
    /// ?fail=true bhejo to failure path test kar sakte ho.
    /// Real gateway par ye 400 return karega.
    /// </summary>
    [HttpPost("mock/checkout")]
    public IActionResult MockCheckout(
        [FromQuery] string gatewayOrderId,
        [FromQuery] bool fail = false)
    {
        if (gateway.Provider != "MOCK")
            return BadRequest(ApiResponse.Fail("Mock checkout sirf MOCK gateway par available hai."));

        if (string.IsNullOrWhiteSpace(gatewayOrderId))
            return BadRequest(ApiResponse.Fail("gatewayOrderId zaroori hai."));

        var paymentId = "mock_pay_" + Guid.NewGuid().ToString("N")[..16];

        // fail=true par jaan-boojh kar galat signature, taaki verify reject kare
        var signature = fail
            ? "0000000000000000000000000000000000000000000000000000000000000000"
            : gateway.SignForTesting(gatewayOrderId, paymentId);

        return Ok(ApiResponse.Ok(new
        {
            gatewayOrderId,
            gatewayPaymentId = paymentId,
            signature,
            method = "UPI",
            simulatedFailure = fail
        }, fail ? "Failure simulate kiya gaya." : "Mock payment ho gaya, ab /verify call karo."));
    }

    /* ============================== HISTORY =========================== */

    [HttpGet("my")]
    public async Task<IActionResult> MyPayments(
        [FromQuery] string? status,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var rows = await db.QueryAsync("dbo.usp_Payment_List", new SpParams()
            .Add("@UserId", User.UserId())
            .AddIfNotNull("@Status", status?.ToUpperInvariant())
            .Add("@PageNumber", pageNumber)
            .Add("@PageSize", Math.Clamp(pageSize, 1, 100)), ct);

        return Ok(ApiResponse.Ok(PagedResult<Row>.FromRows(rows, pageNumber, pageSize)));
    }
}
