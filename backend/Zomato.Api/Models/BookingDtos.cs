using System.ComponentModel.DataAnnotations;

namespace Zomato.Api.Models;

/* ======================= TABLE BOOKING ========================== */

public sealed class TableAvailabilityRequest
{
    [Range(1, int.MaxValue)] public int RestaurantId { get; set; }

    [Required] public DateOnly BookingDate { get; set; }

    /// <summary>"19:30" format</summary>
    [Required] public string BookingTime { get; set; } = "19:30";

    [Range(1, 30)] public int GuestCount { get; set; } = 2;
    [Range(30, 300)] public int DurationMin { get; set; } = 90;

    /// <summary>Indoor | Outdoor | Rooftop</summary>
    public string? SeatingPref { get; set; }
}

public sealed class TableBookingRequest : IValidatableObject
{
    [Range(1, int.MaxValue)] public int RestaurantId { get; set; }

    [Required][StringLength(120, MinimumLength = 2)] public string GuestName { get; set; } = "";

    [Required]
    [RegularExpression(@"^[0-9+\-\s()]{7,20}$", ErrorMessage = "Phone number valid nahi hai.")]
    public string GuestPhone { get; set; } = "";

    [Required] public DateOnly BookingDate { get; set; }
    [Required] public string BookingTime { get; set; } = "19:30";

    [Range(1, 30, ErrorMessage = "1 se 30 guests. Isse zyada ke liye Hall Booking use karo.")]
    public int GuestCount { get; set; } = 2;

    [Range(30, 300)] public int DurationMin { get; set; } = 90;

    public string? SeatingPref { get; set; }

    /// <summary>Birthday | Anniversary | Casual | Business</summary>
    [StringLength(60)] public string? Occasion { get; set; }

    [StringLength(500)] public string? SpecialRequest { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (!TimeOnly.TryParse(BookingTime, out _))
            yield return new ValidationResult("BookingTime 'HH:mm' format me do (jaise 19:30).", [nameof(BookingTime)]);

        if (BookingDate < DateOnly.FromDateTime(DateTime.UtcNow.AddHours(5.5).Date))
            yield return new ValidationResult("Beeti hui date par booking nahi ho sakti.", [nameof(BookingDate)]);

        if (BookingDate > DateOnly.FromDateTime(DateTime.UtcNow.AddDays(90)))
            yield return new ValidationResult("90 din se aage ki booking abhi allowed nahi hai.", [nameof(BookingDate)]);
    }
}

public sealed class BookingFilter
{
    public int? RestaurantId { get; set; }
    public int? HallId { get; set; }
    public string? Status { get; set; }
    public string? EventType { get; set; }
    public string? Search { get; set; }
    public DateOnly? FromDate { get; set; }
    public DateOnly? ToDate { get; set; }
    [Range(1, int.MaxValue)] public int PageNumber { get; set; } = 1;
    [Range(1, 100)] public int PageSize { get; set; } = 20;
}

public sealed class UpdateBookingStatusRequest
{
    [Required] public string Status { get; set; } = "";
}

/* ======================== HALL BOOKING ========================== */

public sealed class HallFilter
{
    public int? RestaurantId { get; set; }
    public string? City { get; set; }
    [Range(1, 2000)] public int? MinGuestCapacity { get; set; }
    [Range(0, 100000)] public decimal? MaxBudgetPerPlate { get; set; }
    public bool IncludeInactive { get; set; }
}

public sealed class HallRequest
{
    public int HallId { get; set; }

    [Range(1, int.MaxValue)] public int RestaurantId { get; set; }

    [Required][StringLength(120, MinimumLength = 2)] public string Name { get; set; } = "";
    public string? Description { get; set; }

    [Range(1, 2000)] public int MinCapacity { get; set; } = 20;
    [Range(1, 5000)] public int MaxCapacity { get; set; } = 100;

    [Range(0, 100000)] public decimal PricePerPlate { get; set; }
    [Range(0, 1000000)] public decimal BaseRent { get; set; }

    [StringLength(500)] public string? ImageUrl { get; set; }

    /// <summary>JSON array of image URLs</summary>
    public string? GalleryJson { get; set; }

    /// <summary>JSON array: ["AC","DJ","Parking"]</summary>
    public string? AmenitiesJson { get; set; }

    public bool HasAC { get; set; } = true;
    public bool HasParking { get; set; } = true;
    public bool HasDJ { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class HallAvailabilityRequest : IValidatableObject
{
    [Range(1, int.MaxValue)] public int HallId { get; set; }
    [Required] public DateOnly EventDate { get; set; }
    [Required] public string StartTime { get; set; } = "19:00";
    [Required] public string EndTime { get; set; } = "23:00";

    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (!TimeOnly.TryParse(StartTime, out var s))
            yield return new ValidationResult("StartTime 'HH:mm' format me do.", [nameof(StartTime)]);
        else if (!TimeOnly.TryParse(EndTime, out var e))
            yield return new ValidationResult("EndTime 'HH:mm' format me do.", [nameof(EndTime)]);
        else if (e <= s)
            yield return new ValidationResult("EndTime, StartTime se baad ka hona chahiye.", [nameof(EndTime)]);
    }
}

public sealed class HallQuoteRequest
{
    [Range(1, int.MaxValue)] public int HallId { get; set; }
    [Range(1, 5000)] public int GuestCount { get; set; } = 50;
    public bool CakeRequired { get; set; }
    [Range(0.5, 25)] public decimal? CakeWeightKg { get; set; }
    [StringLength(120)] public string? DecorationTheme { get; set; }
    [StringLength(40)] public string? CouponCode { get; set; }
}

public sealed class HallBookingRequest : IValidatableObject
{
    [Range(1, int.MaxValue)] public int HallId { get; set; }

    /// <summary>Birthday | Anniversary | Kitty Party | Corporate | Wedding | Other</summary>
    [Required][StringLength(60)] public string EventType { get; set; } = "Birthday";

    [Required][StringLength(120, MinimumLength = 2)] public string ContactName { get; set; } = "";

    [Required]
    [RegularExpression(@"^[0-9+\-\s()]{7,20}$", ErrorMessage = "Phone number valid nahi hai.")]
    public string ContactPhone { get; set; } = "";

    [Required] public DateOnly EventDate { get; set; }
    [Required] public string StartTime { get; set; } = "19:00";
    [Required] public string EndTime { get; set; } = "23:00";

    [Range(1, 5000)] public int GuestCount { get; set; } = 50;

    [StringLength(120)] public string? DecorationTheme { get; set; }
    public bool CakeRequired { get; set; }
    [StringLength(80)] public string? CakeFlavour { get; set; }
    [Range(0.5, 25)] public decimal? CakeWeightKg { get; set; }

    /// <summary>Veg | Non-Veg | Both</summary>
    [StringLength(200)] public string? MenuPreference { get; set; }

    [StringLength(1000)] public string? SpecialRequest { get; set; }
    [StringLength(40)] public string? CouponCode { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (!TimeOnly.TryParse(StartTime, out var s))
        {
            yield return new ValidationResult("StartTime 'HH:mm' format me do.", [nameof(StartTime)]);
            yield break;
        }

        if (!TimeOnly.TryParse(EndTime, out var e))
        {
            yield return new ValidationResult("EndTime 'HH:mm' format me do.", [nameof(EndTime)]);
            yield break;
        }

        if (e <= s)
            yield return new ValidationResult("EndTime, StartTime se baad ka hona chahiye.", [nameof(EndTime)]);

        if (EventDate < DateOnly.FromDateTime(DateTime.UtcNow.AddHours(5.5).Date))
            yield return new ValidationResult("Beeti hui date par booking nahi ho sakti.", [nameof(EventDate)]);

        if (CakeRequired && CakeWeightKg is null)
            yield return new ValidationResult("Cake ka weight bataao.", [nameof(CakeWeightKg)]);
    }
}

/* ==================== TABLES (admin master) ===================== */

public sealed class RestaurantTableRequest
{
    public int TableId { get; set; }
    [Range(1, int.MaxValue)] public int RestaurantId { get; set; }
    [Required][StringLength(20)] public string TableNumber { get; set; } = "";
    [Range(1, 50)] public int SeatCapacity { get; set; } = 4;

    /// <summary>Indoor | Outdoor | Rooftop</summary>
    [StringLength(40)] public string Location { get; set; } = "Indoor";
    public bool IsActive { get; set; } = true;
}
