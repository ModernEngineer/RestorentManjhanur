using System.ComponentModel.DataAnnotations;

namespace Zomato.Api.Models;

/* ====================== RESTAURANT SEARCH ======================= */

/// <summary>
/// Zomato jaise saare filters. Query string se bind hota hai:
/// /api/restaurants?minRating=4.5&amp;openNow=true&amp;petFriendly=true&amp;lat=28.63&amp;lng=77.21
/// </summary>
public sealed class RestaurantFilter
{
    public string? Search { get; set; }
    public string? City { get; set; }
    public string? Locality { get; set; }

    /// <summary>CSV: "1,4,7"</summary>
    public string? CuisineIds { get; set; }

    [Range(0, 5)] public decimal? MinRating { get; set; }
    [Range(0, 100000)] public decimal? MinCostForTwo { get; set; }
    [Range(0, 100000)] public decimal? MaxCostForTwo { get; set; }

    public bool PureVegOnly { get; set; }
    public bool OutdoorSeating { get; set; }
    public bool PetFriendly { get; set; }
    public bool ServesAlcohol { get; set; }
    public bool OpenNow { get; set; }
    public bool HasOffers { get; set; }
    public bool HasTableBooking { get; set; }
    public bool HasHallBooking { get; set; }

    [Range(-90, 90)] public decimal? Lat { get; set; }
    [Range(-180, 180)] public decimal? Lng { get; set; }

    /// <summary>NULL = restaurant ka apna radius (default 15 km)</summary>
    [Range(0.5, 50)] public decimal? MaxDistanceKm { get; set; }

    public bool OnlyDeliverable { get; set; }

    /// <summary>relevance | rating | cost_low | cost_high | distance | popular | newest</summary>
    public string SortBy { get; set; } = "relevance";

    [Range(1, int.MaxValue)] public int PageNumber { get; set; } = 1;
    [Range(1, 60)] public int PageSize { get; set; } = 12;
}

public sealed class RestaurantRequest
{
    public int RestaurantId { get; set; }

    [Required][StringLength(150, MinimumLength = 2)] public string Name { get; set; } = "";
    [StringLength(180)] public string? Slug { get; set; }
    [StringLength(250)] public string? Tagline { get; set; }
    public string? Description { get; set; }
    [StringLength(500)] public string? ThumbnailUrl { get; set; }
    [StringLength(500)] public string? CoverImageUrl { get; set; }

    [Required][StringLength(300, MinimumLength = 5)] public string AddressLine { get; set; } = "";
    [Required][StringLength(120)] public string Locality { get; set; } = "";
    [Required][StringLength(80)] public string City { get; set; } = "";
    [StringLength(10)] public string? Pincode { get; set; }

    [Range(-90, 90)] public decimal Latitude { get; set; }
    [Range(-180, 180)] public decimal Longitude { get; set; }

    [StringLength(20)] public string? Phone { get; set; }

    [Range(1, 100000)] public decimal CostForTwo { get; set; } = 500;

    /// <summary>"11:00" format</summary>
    [Required] public string OpeningTime { get; set; } = "11:00";
    [Required] public string ClosingTime { get; set; } = "23:00";

    [Range(0.5, 50, ErrorMessage = "Delivery radius 0.5 se 50 km ke beech ho.")]
    public decimal DeliveryRadiusKm { get; set; } = 15m;

    [Range(5, 180)] public int AvgPrepTimeMin { get; set; } = 30;

    public bool IsPureVeg { get; set; }
    public bool HasOutdoorSeating { get; set; }
    public bool IsPetFriendly { get; set; }
    public bool ServesAlcohol { get; set; }
    public bool HasTableBooking { get; set; } = true;
    public bool HasHallBooking { get; set; }
    public bool AcceptsOnlineOrder { get; set; } = true;
    public bool IsPromoted { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>CSV: "1,4,7"</summary>
    public string? CuisineIds { get; set; }
}

/* ============================ MENU ============================== */

public sealed class FoodItemFilter
{
    public int? RestaurantId { get; set; }
    public int? CategoryId { get; set; }
    public string? Search { get; set; }
    public bool VegOnly { get; set; }
    public bool NonVegOnly { get; set; }
    public bool Bestseller { get; set; }
    public bool OnlyOffers { get; set; }
    [Range(0, 100000)] public decimal? MinPrice { get; set; }
    [Range(0, 100000)] public decimal? MaxPrice { get; set; }
    public bool IncludeInactive { get; set; }

    /// <summary>default | price_low | price_high | rating | name</summary>
    public string SortBy { get; set; } = "default";

    [Range(1, int.MaxValue)] public int PageNumber { get; set; } = 1;
    [Range(1, 100)] public int PageSize { get; set; } = 50;
}

public sealed class FoodItemRequest
{
    public int FoodItemId { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "Restaurant select karo.")]
    public int RestaurantId { get; set; }

    public int? CategoryId { get; set; }

    [Required][StringLength(150, MinimumLength = 2)] public string Name { get; set; } = "";
    [StringLength(600)] public string? Description { get; set; }

    [Range(1, 100000, ErrorMessage = "Price 1 se zyada honi chahiye.")]
    public decimal Price { get; set; }

    [Range(0, 100000)] public decimal? DiscountPrice { get; set; }

    [StringLength(500)] public string? ImageUrl { get; set; }

    public bool IsVeg { get; set; } = true;
    public bool IsBestseller { get; set; }
    public bool IsAvailable { get; set; } = true;
    [StringLength(40)] public string? ServesCount { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class UpdateImageRequest
{
    [Required(ErrorMessage = "Image URL zaroori hai.")]
    [StringLength(500)]
    public string ImageUrl { get; set; } = "";
}

public sealed class FoodCategoryRequest
{
    public int CategoryId { get; set; }
    public int? RestaurantId { get; set; }
    [Required][StringLength(100)] public string Name { get; set; } = "";
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class BulkDiscountRequest
{
    public int? FoodItemId { get; set; }
    public int? RestaurantId { get; set; }
    public int? CategoryId { get; set; }

    [Range(0, 99, ErrorMessage = "Discount 0 se 99 percent ke beech ho (0 = discount hatao).")]
    public decimal DiscountPercent { get; set; }

    [Range(0, 100000)] public decimal? MaxPrice { get; set; }
}

/* =========================== REVIEWS ============================ */

public sealed class ReviewRequest
{
    [Range(1, int.MaxValue)] public int RestaurantId { get; set; }
    public long? OrderId { get; set; }

    [Range(1, 5, ErrorMessage = "Rating 1 se 5 ke beech ho.")]
    public decimal Rating { get; set; }

    [Range(1, 5)] public decimal? FoodRating { get; set; }
    [Range(1, 5)] public decimal? ServiceRating { get; set; }

    [StringLength(150)] public string? Title { get; set; }
    [StringLength(4000)] public string? Comment { get; set; }
    [StringLength(500)] public string? ImageUrl { get; set; }
}

public sealed class TestimonialRequest
{
    public int TestimonialId { get; set; }
    [Required][StringLength(120)] public string CustomerName { get; set; } = "";
    [StringLength(500)] public string? CustomerImage { get; set; }
    [StringLength(80)] public string? City { get; set; }
    [StringLength(120)] public string? Designation { get; set; }
    [Range(1, 5)] public decimal Rating { get; set; } = 5;
    [Required][StringLength(1000, MinimumLength = 10)] public string Message { get; set; } = "";
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
}
