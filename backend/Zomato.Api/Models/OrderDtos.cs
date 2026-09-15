using System.ComponentModel.DataAnnotations;

namespace Zomato.Api.Models;

public sealed class CartItemRequest
{
    [Range(1, int.MaxValue)] public int FoodItemId { get; set; }

    [Range(1, 50, ErrorMessage = "Quantity 1 se 50 ke beech ho.")]
    public int Quantity { get; set; } = 1;

    [StringLength(300)] public string? Notes { get; set; }
}

public sealed class PlaceOrderRequest : IValidatableObject
{
    [Range(1, int.MaxValue, ErrorMessage = "Restaurant select karo.")]
    public int RestaurantId { get; set; }

    /// <summary>DELIVERY ke liye zaroori, PICKUP ke liye nahi.</summary>
    public int? AddressId { get; set; }

    [MinLength(1, ErrorMessage = "Cart khaali hai.")]
    public List<CartItemRequest> Items { get; set; } = [];

    [StringLength(40)] public string? CouponCode { get; set; }

    /// <summary>ONLINE | COD</summary>
    public string PaymentMode { get; set; } = "ONLINE";

    /// <summary>DELIVERY | PICKUP</summary>
    public string OrderType { get; set; } = "DELIVERY";

    [StringLength(500)] public string? CustomerNote { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (!OrderConstants.PaymentModes.Contains(PaymentMode, StringComparer.OrdinalIgnoreCase))
            yield return new ValidationResult(
                $"PaymentMode '{PaymentMode}' valid nahi hai. Allowed: {string.Join(", ", OrderConstants.PaymentModes)}",
                [nameof(PaymentMode)]);

        if (!OrderConstants.OrderTypes.Contains(OrderType, StringComparer.OrdinalIgnoreCase))
            yield return new ValidationResult(
                $"OrderType '{OrderType}' valid nahi hai. Allowed: {string.Join(", ", OrderConstants.OrderTypes)}",
                [nameof(OrderType)]);

        if (OrderType.Equals("DELIVERY", StringComparison.OrdinalIgnoreCase) && AddressId is null or <= 0)
            yield return new ValidationResult("Delivery ke liye address select karna zaroori hai.", [nameof(AddressId)]);

        var duplicate = Items.GroupBy(i => i.FoodItemId).FirstOrDefault(g => g.Count() > 1);
        if (duplicate is not null)
            yield return new ValidationResult(
                $"Item {duplicate.Key} cart me do baar hai - quantity merge karo.", [nameof(Items)]);
    }
}

public sealed class OrderFilter
{
    public int? RestaurantId { get; set; }
    public string? Status { get; set; }
    public string? PaymentStatus { get; set; }
    public string? Search { get; set; }
    public DateOnly? FromDate { get; set; }
    public DateOnly? ToDate { get; set; }
    public int? DeliveryEmployeeId { get; set; }
    [Range(1, int.MaxValue)] public int PageNumber { get; set; } = 1;
    [Range(1, 100)] public int PageSize { get; set; } = 20;
}

public sealed class UpdateOrderStatusRequest
{
    [Required(ErrorMessage = "Status zaroori hai.")]
    public string Status { get; set; } = "";

    [StringLength(400)] public string? Remarks { get; set; }
}

/// <summary>Cancel ke liye status ki zaroorat nahi - sirf optional reason.</summary>
public sealed class CancelOrderRequest
{
    [StringLength(400)] public string? Remarks { get; set; }
}

public sealed class AssignDeliveryRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "Delivery employee select karo.")]
    public int DeliveryEmployeeId { get; set; }
}

public sealed class ValidateCouponRequest
{
    [Required(ErrorMessage = "Coupon code zaroori hai.")]
    [StringLength(40)]
    public string Code { get; set; } = "";

    public int? RestaurantId { get; set; }

    [Range(1, 1000000)] public decimal OrderAmount { get; set; }

    /// <summary>ORDER | TABLE | HALL</summary>
    public string AppliesTo { get; set; } = "ORDER";
}

public sealed class CouponRequest : IValidatableObject
{
    public int CouponId { get; set; }

    [Required][StringLength(40, MinimumLength = 3)] public string Code { get; set; } = "";
    [Required][StringLength(150, MinimumLength = 3)] public string Title { get; set; } = "";
    [StringLength(400)] public string? Description { get; set; }

    /// <summary>PERCENT | FLAT</summary>
    [Required] public string DiscountType { get; set; } = "PERCENT";

    [Range(0.01, 100000)] public decimal DiscountValue { get; set; }
    [Range(0, 100000)] public decimal? MaxDiscountAmount { get; set; }
    [Range(0, 1000000)] public decimal MinOrderAmount { get; set; }

    public int? RestaurantId { get; set; }

    /// <summary>ORDER | TABLE | HALL</summary>
    public string AppliesTo { get; set; } = "ORDER";

    public DateTime ValidFrom { get; set; } = DateTime.UtcNow;
    public DateTime ValidTo { get; set; } = DateTime.UtcNow.AddDays(30);

    [Range(1, 1000000)] public int? UsageLimit { get; set; }
    [Range(1, 100)] public int? UsageLimitPerUser { get; set; }
    public bool IsActive { get; set; } = true;

    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (!OrderConstants.DiscountTypes.Contains(DiscountType, StringComparer.OrdinalIgnoreCase))
            yield return new ValidationResult("DiscountType PERCENT ya FLAT hona chahiye.", [nameof(DiscountType)]);

        if (!OrderConstants.CouponScopes.Contains(AppliesTo, StringComparer.OrdinalIgnoreCase))
            yield return new ValidationResult("AppliesTo ORDER, TABLE ya HALL hona chahiye.", [nameof(AppliesTo)]);

        if (DiscountType.Equals("PERCENT", StringComparison.OrdinalIgnoreCase) && DiscountValue > 100)
            yield return new ValidationResult("Percent discount 100 se zyada nahi ho sakta.", [nameof(DiscountValue)]);

        if (ValidTo <= ValidFrom)
            yield return new ValidationResult("ValidTo, ValidFrom se baad ka hona chahiye.", [nameof(ValidTo)]);
    }
}

/* ========================== PAYMENTS ============================ */

public sealed class CreatePaymentRequest : IValidatableObject
{
    public long? OrderId { get; set; }
    public long? HallBookingId { get; set; }

    /// <summary>ORDER | HALL</summary>
    [Required] public string PurposeType { get; set; } = "ORDER";

    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (!OrderConstants.PaymentPurposes.Contains(PurposeType, StringComparer.OrdinalIgnoreCase))
            yield return new ValidationResult("PurposeType ORDER ya HALL hona chahiye.", [nameof(PurposeType)]);

        if (PurposeType.Equals("ORDER", StringComparison.OrdinalIgnoreCase) && OrderId is null or <= 0)
            yield return new ValidationResult("OrderId zaroori hai.", [nameof(OrderId)]);

        if (PurposeType.Equals("HALL", StringComparison.OrdinalIgnoreCase) && HallBookingId is null or <= 0)
            yield return new ValidationResult("HallBookingId zaroori hai.", [nameof(HallBookingId)]);
    }
}

public sealed class VerifyPaymentRequest
{
    [Required] public string PaymentRef { get; set; } = "";
    [Required] public string GatewayOrderId { get; set; } = "";
    [Required] public string GatewayPaymentId { get; set; } = "";
    [Required] public string Signature { get; set; } = "";

    /// <summary>UPI | CARD | NETBANKING | WALLET</summary>
    [StringLength(30)] public string? Method { get; set; }
}

public static class OrderConstants
{
    public static readonly string[] PaymentModes = ["ONLINE", "COD"];
    public static readonly string[] OrderTypes = ["DELIVERY", "PICKUP"];
    public static readonly string[] DiscountTypes = ["PERCENT", "FLAT"];
    public static readonly string[] CouponScopes = ["ORDER", "TABLE", "HALL"];
    public static readonly string[] PaymentPurposes = ["ORDER", "HALL"];

    public static readonly string[] OrderStatuses =
    [
        "PLACED", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY",
        "DELIVERED", "CANCELLED", "REJECTED"
    ];

    public static readonly string[] TableBookingStatuses =
        ["PENDING", "CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "REJECTED"];

    public static readonly string[] HallBookingStatuses =
        ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "REJECTED"];
}
