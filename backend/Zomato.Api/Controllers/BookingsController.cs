using System.Data;
using Zomato.Api.Models;

namespace Zomato.Api.Controllers;

/// <summary>Table booking (dine-in) endpoints.</summary>
[ApiController]
[Route("api/table-bookings")]
[Authorize]
public sealed class TableBookingsController(Db db, ILogger<TableBookingsController> logger) : ControllerBase
{
    /// <summary>Kaunsi tables free hain - booking form par live check.</summary>
    [HttpPost("availability")]
    [AllowAnonymous]
    public async Task<IActionResult> Availability([FromBody] TableAvailabilityRequest req, CancellationToken ct)
    {
        if (!TimeOnly.TryParse(req.BookingTime, out var time))
            return BadRequest(ApiResponse.Fail("BookingTime 'HH:mm' format me do (jaise 19:30)."));

        var sets = await db.QueryMultipleAsync("dbo.usp_TableBooking_CheckAvailability", new SpParams()
            .Add("@RestaurantId", req.RestaurantId)
            .Add("@BookingDate", req.BookingDate.ToDateTime(TimeOnly.MinValue))
            .Add("@BookingTime", time.ToTimeSpan())
            .Add("@GuestCount", req.GuestCount)
            .Add("@DurationMin", req.DurationMin)
            .AddIfNotNull("@SeatingPref", req.SeatingPref), maxResultSets: 2, ct: ct);

        var tables = sets.Count > 0 ? sets[0] : [];
        var summary = sets.Count > 1 ? sets[1].FirstOrDefault() : null;

        return Ok(ApiResponse.Ok(new
        {
            availableTables = tables,
            availableCount = summary?.Int("availableTableCount") ?? tables.Count,
            isAvailable = tables.Count > 0
        }));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] TableBookingRequest req, CancellationToken ct)
    {
        if (!TimeOnly.TryParse(req.BookingTime, out var time))
            return BadRequest(ApiResponse.Fail("BookingTime 'HH:mm' format me do."));

        var parameters = new SpParams()
            .Add("@RestaurantId", req.RestaurantId)
            .Add("@UserId", User.UserId())
            .Add("@GuestName", req.GuestName.Trim())
            .Add("@GuestPhone", req.GuestPhone.Trim())
            .Add("@BookingDate", req.BookingDate.ToDateTime(TimeOnly.MinValue))
            .Add("@BookingTime", time.ToTimeSpan())
            .Add("@GuestCount", req.GuestCount)
            .Add("@DurationMin", req.DurationMin)
            .AddIfNotNull("@SeatingPref", req.SeatingPref)
            .AddIfNotNull("@Occasion", req.Occasion)
            .AddIfNotNull("@SpecialRequest", req.SpecialRequest?.Trim())
            .Out("@BookingId", SqlDbType.BigInt)
            .Out("@Message", SqlDbType.NVarChar, 400);

        var result = await db.ExecuteWithOutputAsync("dbo.usp_TableBooking_Create", parameters, ct);

        var bookingId = result.Outputs.Long("BookingId");
        var message = result.Outputs.Str("Message") ?? "Booking nahi ho saki.";

        if (bookingId <= 0)
            return BadRequest(ApiResponse.Fail(message));

        logger.LogInformation("Table booking {BookingId} by user {UserId}", bookingId, User.UserId());
        return Ok(ApiResponse.Ok(result.First(), message));
    }

    [HttpGet("my")]
    public async Task<IActionResult> My([FromQuery] BookingFilter f, CancellationToken ct)
    {
        var rows = await db.QueryAsync("dbo.usp_TableBooking_List", new SpParams()
            .Add("@UserId", User.UserId())
            .AddIfNotNull("@RestaurantId", f.RestaurantId)
            .AddIfNotNull("@Status", f.Status)
            .AddIfNotNull("@FromDate", f.FromDate?.ToDateTime(TimeOnly.MinValue))
            .AddIfNotNull("@ToDate", f.ToDate?.ToDateTime(TimeOnly.MinValue))
            .AddIfNotNull("@Search", f.Search)
            .Add("@PageNumber", f.PageNumber)
            .Add("@PageSize", f.PageSize), ct);

        return Ok(ApiResponse.Ok(PagedResult<Row>.FromRows(rows, f.PageNumber, f.PageSize)));
    }

    [HttpPost("{bookingId:long}/cancel")]
    public async Task<IActionResult> Cancel(long bookingId, CancellationToken ct)
    {
        // ownership check
        var mine = await db.QueryAsync("dbo.usp_TableBooking_List", new SpParams()
            .Add("@UserId", User.UserId())
            .Add("@PageSize", 100), ct);

        if (!User.IsAdmin() && mine.All(b => b.Long("bookingId") != bookingId))
            return NotFound(ApiResponse.Fail("Booking nahi mili."));

        var row = await db.QuerySingleAsync("dbo.usp_TableBooking_UpdateStatus", new SpParams()
            .Add("@BookingId", bookingId)
            .Add("@NewStatus", "CANCELLED")
            .Add("@HandledByUserId", User.UserId()), ct);

        var affected = row?.Int("affectedRows") ?? 0;
        var message = row?.Str("message") ?? "Cancel nahi ho saka.";

        return affected > 0 ? Ok(ApiResponse.Ok(message)) : BadRequest(ApiResponse.Fail(message));
    }
}

/// <summary>Hall / party hall booking (birthday, anniversary, corporate).</summary>
[ApiController]
[Route("api/halls")]
public sealed class HallsController(Db db, ILogger<HallsController> logger) : ControllerBase
{
    /// <summary>Public hall listing - city, capacity aur budget se filter.</summary>
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> List([FromQuery] HallFilter f, CancellationToken ct)
    {
        var rows = await db.QueryAsync("dbo.usp_Hall_List", new SpParams()
            .AddIfNotNull("@RestaurantId", f.RestaurantId)
            .AddIfNotNull("@City", f.City)
            .AddIfNotNull("@MinGuestCapacity", f.MinGuestCapacity)
            .AddIfNotNull("@MaxBudgetPerPlate", f.MaxBudgetPerPlate)
            .Add("@IncludeInactive", false), ct);

        return Ok(ApiResponse.Ok(rows));
    }

    [HttpGet("{hallId:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> Detail(int hallId, CancellationToken ct)
    {
        var sets = await db.QueryMultipleAsync("dbo.usp_Hall_GetById",
            new SpParams().Add("@HallId", hallId), maxResultSets: 2, ct: ct);

        var hall = sets.Count > 0 ? sets[0].FirstOrDefault() : null;
        if (hall is null)
            return NotFound(ApiResponse.Fail("Hall nahi mila."));

        return Ok(ApiResponse.Ok(new
        {
            hall,
            busySlots = sets.Count > 1 ? sets[1] : []
        }));
    }

    /// <summary>Slot free hai ya nahi.</summary>
    [HttpPost("availability")]
    [AllowAnonymous]
    public async Task<IActionResult> Availability([FromBody] HallAvailabilityRequest req, CancellationToken ct)
    {
        if (!TimeOnly.TryParse(req.StartTime, out var start) || !TimeOnly.TryParse(req.EndTime, out var end))
            return BadRequest(ApiResponse.Fail("Time 'HH:mm' format me do."));

        var sets = await db.QueryMultipleAsync("dbo.usp_HallBooking_CheckAvailability", new SpParams()
            .Add("@HallId", req.HallId)
            .Add("@EventDate", req.EventDate.ToDateTime(TimeOnly.MinValue))
            .Add("@StartTime", start.ToTimeSpan())
            .Add("@EndTime", end.ToTimeSpan()), maxResultSets: 2, ct: ct);

        var check = sets.Count > 0 ? sets[0].FirstOrDefault() : null;

        return Ok(ApiResponse.Ok(new
        {
            isAvailable = check?.Bool("isAvailable") ?? false,
            message = check?.Str("message"),
            busySlots = sets.Count > 1 ? sets[1] : []
        }));
    }

    /// <summary>
    /// Booking se pehle price estimate - plate amount, decoration, cake,
    /// GST aur 30% advance sab breakdown me.
    /// </summary>
    [HttpPost("quote")]
    [Authorize]
    public async Task<IActionResult> Quote([FromBody] HallQuoteRequest req, CancellationToken ct)
    {
        var row = await db.QuerySingleAsync("dbo.usp_HallBooking_Quote", new SpParams()
            .Add("@HallId", req.HallId)
            .Add("@GuestCount", req.GuestCount)
            .Add("@CakeRequired", req.CakeRequired)
            .AddIfNotNull("@CakeWeightKg", req.CakeWeightKg)
            .AddIfNotNull("@DecorationTheme", req.DecorationTheme)
            .AddIfNotNull("@CouponCode", req.CouponCode?.Trim().ToUpperInvariant())
            .Add("@UserId", User.UserId()), ct);

        if (row is null)
            return BadRequest(ApiResponse.Fail("Quote generate nahi ho saka."));

        return row.Bool("isValid")
            ? Ok(ApiResponse.Ok(row, row.Str("message")))
            : BadRequest(ApiResponse.Fail(row.Str("message") ?? "Quote valid nahi hai."));
    }

    [HttpPost("bookings")]
    [Authorize]
    public async Task<IActionResult> Book([FromBody] HallBookingRequest req, CancellationToken ct)
    {
        if (!TimeOnly.TryParse(req.StartTime, out var start) || !TimeOnly.TryParse(req.EndTime, out var end))
            return BadRequest(ApiResponse.Fail("Time 'HH:mm' format me do."));

        var parameters = new SpParams()
            .Add("@HallId", req.HallId)
            .Add("@UserId", User.UserId())
            .Add("@EventType", req.EventType.Trim())
            .Add("@ContactName", req.ContactName.Trim())
            .Add("@ContactPhone", req.ContactPhone.Trim())
            .Add("@EventDate", req.EventDate.ToDateTime(TimeOnly.MinValue))
            .Add("@StartTime", start.ToTimeSpan())
            .Add("@EndTime", end.ToTimeSpan())
            .Add("@GuestCount", req.GuestCount)
            .AddIfNotNull("@DecorationTheme", req.DecorationTheme?.Trim())
            .Add("@CakeRequired", req.CakeRequired)
            .AddIfNotNull("@CakeFlavour", req.CakeFlavour?.Trim())
            .AddIfNotNull("@CakeWeightKg", req.CakeWeightKg)
            .AddIfNotNull("@MenuPreference", req.MenuPreference)
            .AddIfNotNull("@SpecialRequest", req.SpecialRequest?.Trim())
            .AddIfNotNull("@CouponCode", req.CouponCode?.Trim().ToUpperInvariant())
            .Out("@BookingId", SqlDbType.BigInt)
            .Out("@Message", SqlDbType.NVarChar, 400);

        var result = await db.ExecuteWithOutputAsync("dbo.usp_HallBooking_Create", parameters, ct);

        var bookingId = result.Outputs.Long("BookingId");
        var message = result.Outputs.Str("Message") ?? "Booking nahi ho saki.";

        if (bookingId <= 0)
            return BadRequest(ApiResponse.Fail(message));

        logger.LogInformation("Hall booking {BookingId} ({EventType}) by user {UserId}",
            bookingId, req.EventType, User.UserId());

        return Ok(ApiResponse.Ok(result.First(), message));
    }

    [HttpGet("bookings/my")]
    [Authorize]
    public async Task<IActionResult> MyBookings([FromQuery] BookingFilter f, CancellationToken ct)
    {
        var rows = await db.QueryAsync("dbo.usp_HallBooking_List", new SpParams()
            .Add("@UserId", User.UserId())
            .AddIfNotNull("@RestaurantId", f.RestaurantId)
            .AddIfNotNull("@HallId", f.HallId)
            .AddIfNotNull("@Status", f.Status)
            .AddIfNotNull("@EventType", f.EventType)
            .AddIfNotNull("@FromDate", f.FromDate?.ToDateTime(TimeOnly.MinValue))
            .AddIfNotNull("@ToDate", f.ToDate?.ToDateTime(TimeOnly.MinValue))
            .AddIfNotNull("@Search", f.Search)
            .Add("@PageNumber", f.PageNumber)
            .Add("@PageSize", f.PageSize), ct);

        return Ok(ApiResponse.Ok(PagedResult<Row>.FromRows(rows, f.PageNumber, f.PageSize)));
    }

    [HttpPost("bookings/{bookingId:long}/cancel")]
    [Authorize]
    public async Task<IActionResult> CancelBooking(long bookingId, CancellationToken ct)
    {
        var mine = await db.QueryAsync("dbo.usp_HallBooking_List", new SpParams()
            .Add("@UserId", User.UserId())
            .Add("@PageSize", 100), ct);

        if (!User.IsAdmin() && mine.All(b => b.Long("bookingId") != bookingId))
            return NotFound(ApiResponse.Fail("Booking nahi mili."));

        var row = await db.QuerySingleAsync("dbo.usp_HallBooking_UpdateStatus", new SpParams()
            .Add("@BookingId", bookingId)
            .Add("@NewStatus", "CANCELLED")
            .Add("@HandledByUserId", User.UserId()), ct);

        var affected = row?.Int("affectedRows") ?? 0;
        var message = row?.Str("message") ?? "Cancel nahi ho saka.";

        return affected > 0 ? Ok(ApiResponse.Ok(message)) : BadRequest(ApiResponse.Fail(message));
    }
}
