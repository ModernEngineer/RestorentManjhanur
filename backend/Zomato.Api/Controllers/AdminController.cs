using Zomato.Api.Models;

namespace Zomato.Api.Controllers;

/// <summary>
/// Admin panel: dashboard, restaurants, employees (+ restaurant assignment),
/// coupons/discounts, testimonials aur settings.
/// </summary>
[ApiController]
[Route("api/admin")]
[Authorize(Roles = AppRoles.Admin)]
public sealed class AdminController(
    Db db,
    PasswordService passwords,
    ILogger<AdminController> logger) : ControllerBase
{
    /* =========================== DASHBOARD ============================ */

    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard(
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        CancellationToken ct)
    {
        var sets = await db.QueryMultipleAsync("dbo.usp_Dashboard_AdminStats", new SpParams()
            .AddIfNotNull("@FromDate", fromDate?.ToDateTime(TimeOnly.MinValue))
            .AddIfNotNull("@ToDate", toDate?.ToDateTime(TimeOnly.MinValue)), maxResultSets: 7, ct: ct);

        return Ok(ApiResponse.Ok(new
        {
            kpi = Set(sets, 0).FirstOrDefault(),
            revenueTrend = Set(sets, 1),
            topRestaurants = Set(sets, 2),
            orderStatusBreakdown = Set(sets, 3),
            topDishes = Set(sets, 4),
            recentOrders = Set(sets, 5),
            bookingsSummary = Set(sets, 6).FirstOrDefault()
        }));
    }

    /* ========================== RESTAURANTS =========================== */

    [HttpGet("restaurants")]
    public async Task<IActionResult> Restaurants([FromQuery] RestaurantAdminFilter f, CancellationToken ct)
    {
        var rows = await db.QueryAsync("dbo.usp_Restaurant_ListForAdmin", new SpParams()
            .AddIfNotNull("@Search", f.Search)
            .AddIfNotNull("@City", f.City)
            .AddIfNotNull("@IsActive", f.IsActive)
            .Add("@IsAdmin", true)
            .Add("@PageNumber", f.PageNumber)
            .Add("@PageSize", f.PageSize), ct);

        return Ok(ApiResponse.Ok(PagedResult<Row>.FromRows(rows, f.PageNumber, f.PageSize)));
    }

    [HttpPost("restaurants")]
    public async Task<IActionResult> SaveRestaurant([FromBody] RestaurantRequest req, CancellationToken ct)
    {
        if (!TimeOnly.TryParse(req.OpeningTime, out var open) || !TimeOnly.TryParse(req.ClosingTime, out var close))
            return BadRequest(ApiResponse.Fail("OpeningTime/ClosingTime 'HH:mm' format me do."));

        var row = await db.QuerySingleAsync("dbo.usp_Restaurant_Save", new SpParams()
            .Add("@RestaurantId", req.RestaurantId)
            .Add("@Name", req.Name.Trim())
            .AddIfNotNull("@Slug", req.Slug?.Trim().ToLowerInvariant())
            .AddIfNotNull("@Tagline", req.Tagline?.Trim())
            .AddIfNotNull("@Description", req.Description)
            .AddIfNotNull("@ThumbnailUrl", req.ThumbnailUrl)
            .AddIfNotNull("@CoverImageUrl", req.CoverImageUrl)
            .Add("@AddressLine", req.AddressLine.Trim())
            .Add("@Locality", req.Locality.Trim())
            .Add("@City", req.City.Trim())
            .AddIfNotNull("@Pincode", req.Pincode?.Trim())
            .Add("@Latitude", req.Latitude)
            .Add("@Longitude", req.Longitude)
            .AddIfNotNull("@Phone", req.Phone?.Trim())
            .Add("@CostForTwo", req.CostForTwo)
            .Add("@OpeningTime", open.ToTimeSpan())
            .Add("@ClosingTime", close.ToTimeSpan())
            .Add("@DeliveryRadiusKm", req.DeliveryRadiusKm)
            .Add("@AvgPrepTimeMin", req.AvgPrepTimeMin)
            .Add("@IsPureVeg", req.IsPureVeg)
            .Add("@HasOutdoorSeating", req.HasOutdoorSeating)
            .Add("@IsPetFriendly", req.IsPetFriendly)
            .Add("@ServesAlcohol", req.ServesAlcohol)
            .Add("@HasTableBooking", req.HasTableBooking)
            .Add("@HasHallBooking", req.HasHallBooking)
            .Add("@AcceptsOnlineOrder", req.AcceptsOnlineOrder)
            .Add("@IsPromoted", req.IsPromoted)
            .Add("@IsActive", req.IsActive)
            .AddIfNotNull("@CuisineIds", req.CuisineIds), ct);

        logger.LogInformation("Restaurant saved: {RestaurantId} by admin {AdminId}",
            row?.Int("restaurantId"), User.UserId());

        return Ok(ApiResponse.Ok(row, "Restaurant save ho gaya."));
    }

    [HttpPut("restaurants/{restaurantId:int}/toggle")]
    public async Task<IActionResult> ToggleRestaurant(int restaurantId, [FromBody] ToggleRequest req, CancellationToken ct)
    {
        var row = await db.QuerySingleAsync("dbo.usp_Restaurant_ToggleActive", new SpParams()
            .Add("@RestaurantId", restaurantId)
            .Add("@IsActive", req.IsActive), ct);

        return row?.Int("affectedRows") > 0
            ? Ok(ApiResponse.Ok(req.IsActive ? "Restaurant active kar diya." : "Restaurant deactivate kar diya."))
            : NotFound(ApiResponse.Fail("Restaurant nahi mila."));
    }

    /// <summary>Restaurant ki thumbnail / cover image badalna.</summary>
    [HttpPut("restaurants/{restaurantId:int}/images")]
    public async Task<IActionResult> UpdateRestaurantImages(
        int restaurantId,
        [FromBody] RestaurantImagesRequest req,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.ThumbnailUrl) && string.IsNullOrWhiteSpace(req.CoverImageUrl))
            return BadRequest(ApiResponse.Fail("Kam se kam ek image URL bhejo."));

        var row = await db.QuerySingleAsync("dbo.usp_Restaurant_UpdateImages", new SpParams()
            .Add("@RestaurantId", restaurantId)
            .AddIfNotNull("@ThumbnailUrl", req.ThumbnailUrl)
            .AddIfNotNull("@CoverImageUrl", req.CoverImageUrl), ct);

        return row is null
            ? NotFound(ApiResponse.Fail("Restaurant nahi mila."))
            : Ok(ApiResponse.Ok(row, "Images update ho gayi."));
    }

    /* ============================ EMPLOYEES =========================== */

    [HttpGet("employees")]
    public async Task<IActionResult> Employees([FromQuery] EmployeeFilter f, CancellationToken ct)
    {
        var rows = await db.QueryAsync("dbo.usp_Employee_List", new SpParams()
            .AddIfNotNull("@Search", f.Search)
            .AddIfNotNull("@RestaurantId", f.RestaurantId)
            .AddIfNotNull("@Designation", f.Designation)
            .AddIfNotNull("@IsActive", f.IsActive)
            .Add("@Unassigned", f.Unassigned)
            .Add("@PageNumber", f.PageNumber)
            .Add("@PageSize", f.PageSize), ct);

        return Ok(ApiResponse.Ok(PagedResult<Row>.FromRows(rows, f.PageNumber, f.PageSize)));
    }

    [HttpPost("employees")]
    public async Task<IActionResult> SaveEmployee([FromBody] EmployeeRequest req, CancellationToken ct)
    {
        string? hash = null;

        if (!string.IsNullOrWhiteSpace(req.Password))
        {
            var (ok, error) = PasswordService.Validate(req.Password);
            if (!ok) return BadRequest(ApiResponse.Fail(error!));
            hash = passwords.Hash(req.Password);
        }

        var row = await db.QuerySingleAsync("dbo.usp_Employee_Save", new SpParams()
            .Add("@UserId", req.UserId)
            .Add("@FullName", req.FullName.Trim())
            .Add("@Email", req.Email.Trim().ToLowerInvariant())
            .AddIfNotNull("@Phone", req.Phone?.Trim())
            .AddIfNotNull("@PasswordHash", hash)
            .AddIfNotNull("@ProfileImage", req.ProfileImage)
            .Add("@IsActive", req.IsActive), ct);

        var userId = row?.Int("userId") ?? -1;
        var message = row?.Str("message") ?? "Save nahi ho saka.";

        return userId > 0
            ? Ok(ApiResponse.Ok(row, "Employee save ho gaya."))
            : BadRequest(ApiResponse.Fail(message));
    }

    /// <summary>
    /// Kisi employee ko restaurant assign karna (kisko kaunsa restaurant dena hai).
    /// Same pair dobara bhejo to permissions update ho jaate hain.
    /// </summary>
    [HttpPost("employees/assign")]
    public async Task<IActionResult> AssignRestaurant([FromBody] AssignRestaurantRequest req, CancellationToken ct)
    {
        var row = await db.QuerySingleAsync("dbo.usp_Employee_AssignRestaurant", new SpParams()
            .Add("@UserId", req.UserId)
            .Add("@RestaurantId", req.RestaurantId)
            .Add("@Designation", req.Designation.Trim())
            .Add("@CanManageMenu", req.CanManageMenu)
            .Add("@CanManageOrder", req.CanManageOrder)
            .Add("@CanManageBooking", req.CanManageBooking)
            .Add("@AssignedByUserId", User.UserId()), ct);

        var assignmentId = row?.Int("assignmentId") ?? -1;
        var message = row?.Str("message") ?? "Assign nahi ho saka.";

        if (assignmentId <= 0)
            return BadRequest(ApiResponse.Fail(message));

        logger.LogInformation("Employee {UserId} -> restaurant {RestaurantId} assigned by admin {AdminId}",
            req.UserId, req.RestaurantId, User.UserId());

        return Ok(ApiResponse.Ok(row, message));
    }

    [HttpDelete("employees/{userId:int}/unassign/{restaurantId:int}")]
    public async Task<IActionResult> UnassignRestaurant(int userId, int restaurantId, CancellationToken ct)
    {
        var row = await db.QuerySingleAsync("dbo.usp_Employee_UnassignRestaurant", new SpParams()
            .Add("@UserId", userId)
            .Add("@RestaurantId", restaurantId), ct);

        return row?.Int("affectedRows") > 0
            ? Ok(ApiResponse.Ok(row.Str("message") ?? "Assignment hata diya."))
            : NotFound(ApiResponse.Fail("Assignment nahi mila."));
    }

    [HttpGet("employees/{userId:int}/assignments")]
    public async Task<IActionResult> EmployeeAssignments(int userId, CancellationToken ct) =>
        Ok(ApiResponse.Ok(await db.QueryAsync("dbo.usp_Employee_GetAssignments",
            new SpParams().Add("@UserId", userId), ct)));

    [HttpPut("employees/{userId:int}/toggle")]
    public async Task<IActionResult> ToggleEmployee(int userId, [FromBody] ToggleRequest req, CancellationToken ct)
    {
        if (userId == User.UserId())
            return BadRequest(ApiResponse.Fail("Apne aap ko deactivate nahi kar sakte."));

        var row = await db.QuerySingleAsync("dbo.usp_Employee_ToggleActive", new SpParams()
            .Add("@UserId", userId)
            .Add("@IsActive", req.IsActive), ct);

        return row?.Int("affectedRows") > 0
            ? Ok(ApiResponse.Ok(req.IsActive ? "Employee active kar diya." : "Employee deactivate kar diya."))
            : NotFound(ApiResponse.Fail("Employee nahi mila."));
    }

    /* ======================= COUPONS / DISCOUNTS ====================== */

    [HttpGet("coupons")]
    public async Task<IActionResult> Coupons(
        [FromQuery] string? search,
        [FromQuery] int? restaurantId,
        [FromQuery] bool? isActive,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var rows = await db.QueryAsync("dbo.usp_Coupon_ListForAdmin", new SpParams()
            .AddIfNotNull("@Search", search)
            .AddIfNotNull("@RestaurantId", restaurantId)
            .AddIfNotNull("@IsActive", isActive)
            .Add("@PageNumber", pageNumber)
            .Add("@PageSize", Math.Clamp(pageSize, 1, 100)), ct);

        return Ok(ApiResponse.Ok(PagedResult<Row>.FromRows(rows, pageNumber, pageSize)));
    }

    [HttpPost("coupons")]
    public async Task<IActionResult> SaveCoupon([FromBody] CouponRequest req, CancellationToken ct)
    {
        var row = await db.QuerySingleAsync("dbo.usp_Coupon_Save", new SpParams()
            .Add("@CouponId", req.CouponId)
            .Add("@Code", req.Code.Trim().ToUpperInvariant())
            .Add("@Title", req.Title.Trim())
            .AddIfNotNull("@Description", req.Description?.Trim())
            .Add("@DiscountType", req.DiscountType.ToUpperInvariant())
            .Add("@DiscountValue", req.DiscountValue)
            .AddIfNotNull("@MaxDiscountAmount", req.MaxDiscountAmount)
            .Add("@MinOrderAmount", req.MinOrderAmount)
            .AddIfNotNull("@RestaurantId", req.RestaurantId)
            .Add("@AppliesTo", req.AppliesTo.ToUpperInvariant())
            .Add("@ValidFrom", req.ValidFrom)
            .Add("@ValidTo", req.ValidTo)
            .AddIfNotNull("@UsageLimit", req.UsageLimit)
            .AddIfNotNull("@UsageLimitPerUser", req.UsageLimitPerUser)
            .Add("@IsActive", req.IsActive), ct);

        var couponId = row?.Int("couponId") ?? -1;
        var message = row?.Str("message") ?? "Save nahi ho saka.";

        return couponId > 0
            ? Ok(ApiResponse.Ok(row, "Coupon save ho gaya."))
            : BadRequest(ApiResponse.Fail(message));
    }

    [HttpPut("coupons/{couponId:int}/toggle")]
    public async Task<IActionResult> ToggleCoupon(int couponId, [FromBody] ToggleRequest req, CancellationToken ct)
    {
        var row = await db.QuerySingleAsync("dbo.usp_Coupon_ToggleActive", new SpParams()
            .Add("@CouponId", couponId)
            .Add("@IsActive", req.IsActive), ct);

        return row?.Int("affectedRows") > 0
            ? Ok(ApiResponse.Ok(req.IsActive ? "Coupon live kar diya." : "Coupon band kar diya."))
            : NotFound(ApiResponse.Fail("Coupon nahi mila."));
    }

    /* =========================== REVIEWS ============================== */

    [HttpGet("reviews")]
    public async Task<IActionResult> Reviews(
        [FromQuery] int? restaurantId,
        [FromQuery] bool? isApproved,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var rows = await db.QueryAsync("dbo.usp_Review_List", new SpParams()
            .AddIfNotNull("@RestaurantId", restaurantId)
            .AddIfNotNull("@IsApproved", isApproved)
            .Add("@SortBy", "newest")
            .Add("@PageNumber", pageNumber)
            .Add("@PageSize", Math.Clamp(pageSize, 1, 100)), ct);

        return Ok(ApiResponse.Ok(PagedResult<Row>.FromRows(rows, pageNumber, pageSize)));
    }

    [HttpPut("reviews/{reviewId:long}/moderate")]
    public async Task<IActionResult> ModerateReview(long reviewId, [FromBody] ToggleRequest req, CancellationToken ct)
    {
        var row = await db.QuerySingleAsync("dbo.usp_Review_Moderate", new SpParams()
            .Add("@ReviewId", reviewId)
            .Add("@IsApproved", req.IsActive), ct);

        return row?.Int("affectedRows") > 0
            ? Ok(ApiResponse.Ok(row.Str("message") ?? "Updated."))
            : NotFound(ApiResponse.Fail("Review nahi mila."));
    }

    /* ==================== TESTIMONIALS (happy customers) ============== */

    [HttpGet("testimonials")]
    public async Task<IActionResult> Testimonials(CancellationToken ct) =>
        Ok(ApiResponse.Ok(await db.QueryAsync("dbo.usp_Testimonial_List",
            new SpParams().Add("@IncludeInactive", true), ct)));

    [HttpPost("testimonials")]
    public async Task<IActionResult> SaveTestimonial([FromBody] TestimonialRequest req, CancellationToken ct)
    {
        var row = await db.QuerySingleAsync("dbo.usp_Testimonial_Save", new SpParams()
            .Add("@TestimonialId", req.TestimonialId)
            .Add("@CustomerName", req.CustomerName.Trim())
            .AddIfNotNull("@CustomerImage", req.CustomerImage)
            .AddIfNotNull("@City", req.City?.Trim())
            .AddIfNotNull("@Designation", req.Designation?.Trim())
            .Add("@Rating", req.Rating)
            .Add("@Message", req.Message.Trim())
            .Add("@DisplayOrder", req.DisplayOrder)
            .Add("@IsActive", req.IsActive), ct);

        return Ok(ApiResponse.Ok(row, "Testimonial save ho gaya."));
    }

    [HttpDelete("testimonials/{testimonialId:int}")]
    public async Task<IActionResult> DeleteTestimonial(int testimonialId, CancellationToken ct)
    {
        var row = await db.QuerySingleAsync("dbo.usp_Testimonial_Delete",
            new SpParams().Add("@TestimonialId", testimonialId), ct);

        return row?.Int("affectedRows") > 0
            ? Ok(ApiResponse.Ok("Testimonial delete ho gaya."))
            : NotFound(ApiResponse.Fail("Testimonial nahi mila."));
    }

    /* =========================== PAYMENTS ============================= */

    [HttpGet("payments")]
    public async Task<IActionResult> Payments(
        [FromQuery] string? status,
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var rows = await db.QueryAsync("dbo.usp_Payment_List", new SpParams()
            .AddIfNotNull("@Status", status?.ToUpperInvariant())
            .AddIfNotNull("@FromDate", fromDate?.ToDateTime(TimeOnly.MinValue))
            .AddIfNotNull("@ToDate", toDate?.ToDateTime(TimeOnly.MinValue))
            .Add("@PageNumber", pageNumber)
            .Add("@PageSize", Math.Clamp(pageSize, 1, 100)), ct);

        return Ok(ApiResponse.Ok(PagedResult<Row>.FromRows(rows, pageNumber, pageSize)));
    }

    /* =========================== SETTINGS ============================= */

    [HttpGet("settings")]
    public async Task<IActionResult> Settings(CancellationToken ct) =>
        Ok(ApiResponse.Ok(await db.QueryAsync("dbo.usp_Setting_GetAll", null, ct)));

    [HttpPost("settings")]
    public async Task<IActionResult> SaveSetting([FromBody] SettingRequest req, CancellationToken ct)
    {
        var row = await db.QuerySingleAsync("dbo.usp_Setting_Save", new SpParams()
            .Add("@SettingKey", req.SettingKey.Trim())
            .Add("@SettingValue", req.SettingValue.Trim())
            .AddIfNotNull("@Description", req.Description?.Trim()), ct);

        return Ok(ApiResponse.Ok(row, "Setting save ho gayi."));
    }

    private static List<Row> Set(List<List<Row>> sets, int i) => i < sets.Count ? sets[i] : [];
}

public sealed class RestaurantImagesRequest
{
    public string? ThumbnailUrl { get; set; }
    public string? CoverImageUrl { get; set; }
}
