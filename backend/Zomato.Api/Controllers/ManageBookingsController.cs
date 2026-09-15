using Zomato.Api.Models;

namespace Zomato.Api.Controllers;

/// <summary>
/// Table booking + hall booking management, aur halls/tables ka master data.
/// Admin sab; Employee sirf assigned restaurants (CanManageBooking = 1).
/// </summary>
[ApiController]
[Route("api/manage/bookings")]
[Authorize(Roles = AppRoles.AdminOrEmployee)]
public sealed class ManageBookingsController(
    Db db,
    AccessGuard guard,
    FileStorageService files,
    ILogger<ManageBookingsController> logger) : ControllerBase
{
    /* ======================== TABLE BOOKINGS ========================== */

    [HttpGet("tables")]
    public async Task<IActionResult> TableBookings([FromQuery] BookingFilter f, CancellationToken ct)
    {
        var parameters = new SpParams()
            .AddIfNotNull("@RestaurantId", f.RestaurantId)
            .AddIfNotNull("@Status", f.Status?.ToUpperInvariant())
            .AddIfNotNull("@FromDate", f.FromDate?.ToDateTime(TimeOnly.MinValue))
            .AddIfNotNull("@ToDate", f.ToDate?.ToDateTime(TimeOnly.MinValue))
            .AddIfNotNull("@Search", f.Search)
            .Add("@PageNumber", f.PageNumber)
            .Add("@PageSize", f.PageSize);

        if (!User.IsAdmin())
            parameters.Add("@ForEmployeeId", User.UserId());

        var rows = await db.QueryAsync("dbo.usp_TableBooking_List", parameters, ct);
        return Ok(ApiResponse.Ok(PagedResult<Row>.FromRows(rows, f.PageNumber, f.PageSize)));
    }

    [HttpPut("tables/{bookingId:long}/status")]
    public async Task<IActionResult> UpdateTableBookingStatus(
        long bookingId,
        [FromBody] UpdateBookingStatusRequest req,
        CancellationToken ct)
    {
        var status = req.Status.Trim().ToUpperInvariant();

        if (!OrderConstants.TableBookingStatuses.Contains(status))
            return BadRequest(ApiResponse.Fail(
                $"Status valid nahi hai. Allowed: {string.Join(", ", OrderConstants.TableBookingStatuses)}"));

        var booking = await FindTableBookingAsync(bookingId, ct);
        if (booking is null)
            return NotFound(ApiResponse.Fail("Booking nahi mili."));

        var access = await guard.CanManageAsync(User, booking.Int("restaurantId"), ManagePermission.Booking, ct);
        if (!access.Allowed) return Forbid403(access.Reason!);

        var row = await db.QuerySingleAsync("dbo.usp_TableBooking_UpdateStatus", new SpParams()
            .Add("@BookingId", bookingId)
            .Add("@NewStatus", status)
            .Add("@HandledByUserId", User.UserId()), ct);

        var affected = row?.Int("affectedRows") ?? 0;
        var message = row?.Str("message") ?? "Update nahi hua.";

        if (affected == 0) return BadRequest(ApiResponse.Fail(message));

        logger.LogInformation("Table booking {BookingId} -> {Status}", bookingId, status);
        return Ok(ApiResponse.Ok(message));
    }

    /* ========================= HALL BOOKINGS ========================== */

    [HttpGet("halls")]
    public async Task<IActionResult> HallBookings([FromQuery] BookingFilter f, CancellationToken ct)
    {
        var parameters = new SpParams()
            .AddIfNotNull("@RestaurantId", f.RestaurantId)
            .AddIfNotNull("@HallId", f.HallId)
            .AddIfNotNull("@Status", f.Status?.ToUpperInvariant())
            .AddIfNotNull("@EventType", f.EventType)
            .AddIfNotNull("@FromDate", f.FromDate?.ToDateTime(TimeOnly.MinValue))
            .AddIfNotNull("@ToDate", f.ToDate?.ToDateTime(TimeOnly.MinValue))
            .AddIfNotNull("@Search", f.Search)
            .Add("@PageNumber", f.PageNumber)
            .Add("@PageSize", f.PageSize);

        if (!User.IsAdmin())
            parameters.Add("@ForEmployeeId", User.UserId());

        var rows = await db.QueryAsync("dbo.usp_HallBooking_List", parameters, ct);
        return Ok(ApiResponse.Ok(PagedResult<Row>.FromRows(rows, f.PageNumber, f.PageSize)));
    }

    [HttpPut("halls/{bookingId:long}/status")]
    public async Task<IActionResult> UpdateHallBookingStatus(
        long bookingId,
        [FromBody] UpdateBookingStatusRequest req,
        CancellationToken ct)
    {
        var status = req.Status.Trim().ToUpperInvariant();

        if (!OrderConstants.HallBookingStatuses.Contains(status))
            return BadRequest(ApiResponse.Fail(
                $"Status valid nahi hai. Allowed: {string.Join(", ", OrderConstants.HallBookingStatuses)}"));

        var booking = await FindHallBookingAsync(bookingId, ct);
        if (booking is null)
            return NotFound(ApiResponse.Fail("Booking nahi mili."));

        var access = await guard.CanManageAsync(User, booking.Int("restaurantId"), ManagePermission.Booking, ct);
        if (!access.Allowed) return Forbid403(access.Reason!);

        var row = await db.QuerySingleAsync("dbo.usp_HallBooking_UpdateStatus", new SpParams()
            .Add("@BookingId", bookingId)
            .Add("@NewStatus", status)
            .Add("@HandledByUserId", User.UserId()), ct);

        var affected = row?.Int("affectedRows") ?? 0;
        var message = row?.Str("message") ?? "Update nahi hua.";

        if (affected == 0) return BadRequest(ApiResponse.Fail(message));

        logger.LogInformation("Hall booking {BookingId} -> {Status}", bookingId, status);
        return Ok(ApiResponse.Ok(message));
    }

    /* ======================= HALLS (master data) ====================== */

    [HttpGet("halls/master")]
    public async Task<IActionResult> Halls([FromQuery] int? restaurantId, CancellationToken ct)
    {
        if (restaurantId is not null)
        {
            var access = await guard.CanManageAsync(User, restaurantId.Value, ManagePermission.Booking, ct);
            if (!access.Allowed) return Forbid403(access.Reason!);
        }
        else if (!User.IsAdmin())
        {
            return BadRequest(ApiResponse.Fail("restaurantId dena zaroori hai."));
        }

        var rows = await db.QueryAsync("dbo.usp_Hall_List", new SpParams()
            .AddIfNotNull("@RestaurantId", restaurantId)
            .Add("@IncludeInactive", true), ct);

        return Ok(ApiResponse.Ok(rows));
    }

    [HttpPost("halls/master")]
    public async Task<IActionResult> SaveHall([FromBody] HallRequest req, CancellationToken ct)
    {
        var access = await guard.CanManageAsync(User, req.RestaurantId, ManagePermission.Booking, ct);
        if (!access.Allowed) return Forbid403(access.Reason!);

        if (req.MaxCapacity < req.MinCapacity)
            return BadRequest(ApiResponse.Fail("MaxCapacity, MinCapacity se kam nahi ho sakti."));

        var row = await db.QuerySingleAsync("dbo.usp_Hall_Save", new SpParams()
            .Add("@HallId", req.HallId)
            .Add("@RestaurantId", req.RestaurantId)
            .Add("@Name", req.Name.Trim())
            .AddIfNotNull("@Description", req.Description)
            .Add("@MinCapacity", req.MinCapacity)
            .Add("@MaxCapacity", req.MaxCapacity)
            .Add("@PricePerPlate", req.PricePerPlate)
            .Add("@BaseRent", req.BaseRent)
            .AddIfNotNull("@ImageUrl", req.ImageUrl)
            .AddIfNotNull("@GalleryJson", req.GalleryJson)
            .AddIfNotNull("@AmenitiesJson", req.AmenitiesJson)
            .Add("@HasAC", req.HasAC)
            .Add("@HasParking", req.HasParking)
            .Add("@HasDJ", req.HasDJ)
            .Add("@IsActive", req.IsActive), ct);

        return Ok(ApiResponse.Ok(row, "Hall save ho gaya."));
    }

    /// <summary>Hall ki image badalna (file upload).</summary>
    [HttpPost("halls/master/{hallId:int}/image/upload")]
    [RequestSizeLimit(FileStorageService.MaxBytes + 1024)]
    public async Task<IActionResult> UploadHallImage(int hallId, IFormFile file, CancellationToken ct)
    {
        var hall = await db.QuerySingleAsync("dbo.usp_Hall_GetById", new SpParams().Add("@HallId", hallId), ct);
        if (hall is null)
            return NotFound(ApiResponse.Fail("Hall nahi mila."));

        var access = await guard.CanManageAsync(User, hall.Int("restaurantId"), ManagePermission.Booking, ct);
        if (!access.Allowed) return Forbid403(access.Reason!);

        var (ok, error) = FileStorageService.Validate(file, "halls");
        if (!ok) return BadRequest(ApiResponse.Fail(error!));

        var oldImage = hall.Str("imageUrl");
        var stored = await files.SaveAsync(file, "halls", ct);

        var row = await db.QuerySingleAsync("dbo.usp_Hall_UpdateImage", new SpParams()
            .Add("@HallId", hallId)
            .Add("@ImageUrl", stored.Url), ct);

        files.TryDelete(oldImage);

        return Ok(ApiResponse.Ok(new { hall = row, imageUrl = stored.Url }, "Hall image update ho gayi."));
    }

    /* ====================== TABLES (master data) ====================== */

    [HttpGet("tables/master")]
    public async Task<IActionResult> Tables([FromQuery] int restaurantId, CancellationToken ct)
    {
        var access = await guard.CanManageAsync(User, restaurantId, ManagePermission.Booking, ct);
        if (!access.Allowed) return Forbid403(access.Reason!);

        return Ok(ApiResponse.Ok(await db.QueryAsync("dbo.usp_Table_List",
            new SpParams().Add("@RestaurantId", restaurantId), ct)));
    }

    [HttpPost("tables/master")]
    public async Task<IActionResult> SaveTable([FromBody] RestaurantTableRequest req, CancellationToken ct)
    {
        var access = await guard.CanManageAsync(User, req.RestaurantId, ManagePermission.Booking, ct);
        if (!access.Allowed) return Forbid403(access.Reason!);

        var row = await db.QuerySingleAsync("dbo.usp_Table_Save", new SpParams()
            .Add("@TableId", req.TableId)
            .Add("@RestaurantId", req.RestaurantId)
            .Add("@TableNumber", req.TableNumber.Trim())
            .Add("@SeatCapacity", req.SeatCapacity)
            .Add("@Location", req.Location.Trim())
            .Add("@IsActive", req.IsActive), ct);

        var tableId = row?.Int("tableId") ?? -1;
        var message = row?.Str("message") ?? "Save nahi ho saka.";

        return tableId > 0
            ? Ok(ApiResponse.Ok(row, "Table save ho gaya."))
            : BadRequest(ApiResponse.Fail(message));
    }

    /* ============================= helpers ============================ */

    private Task<Row?> FindTableBookingAsync(long bookingId, CancellationToken ct) =>
        db.QuerySingleAsync("dbo.usp_TableBooking_List",
            new SpParams().Add("@BookingId", bookingId), ct);

    private Task<Row?> FindHallBookingAsync(long bookingId, CancellationToken ct) =>
        db.QuerySingleAsync("dbo.usp_HallBooking_List",
            new SpParams().Add("@BookingId", bookingId), ct);

    private ObjectResult Forbid403(string reason) =>
        StatusCode(StatusCodes.Status403Forbidden, ApiResponse.Fail(reason));
}
