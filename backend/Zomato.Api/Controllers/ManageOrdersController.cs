using Zomato.Api.Models;

namespace Zomato.Api.Controllers;

/// <summary>
/// Order management - Admin sab dekhta hai, Employee sirf apne assigned
/// restaurants ke orders (SP ke @ForEmployeeId se scope hota hai).
/// </summary>
[ApiController]
[Route("api/manage/orders")]
[Authorize(Roles = AppRoles.AdminOrEmployee)]
public sealed class ManageOrdersController(
    Db db,
    AccessGuard guard,
    ILogger<ManageOrdersController> logger) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] OrderFilter f, CancellationToken ct)
    {
        var parameters = new SpParams()
            .AddIfNotNull("@RestaurantId", f.RestaurantId)
            .AddIfNotNull("@Status", f.Status?.ToUpperInvariant())
            .AddIfNotNull("@PaymentStatus", f.PaymentStatus?.ToUpperInvariant())
            .AddIfNotNull("@Search", f.Search)
            .AddIfNotNull("@FromDate", f.FromDate?.ToDateTime(TimeOnly.MinValue))
            .AddIfNotNull("@ToDate", f.ToDate?.ToDateTime(TimeOnly.MinValue))
            .AddIfNotNull("@DeliveryEmployeeId", f.DeliveryEmployeeId)
            .Add("@PageNumber", f.PageNumber)
            .Add("@PageSize", f.PageSize);

        // Employee ka scope SP ke andar lag jaata hai
        if (!User.IsAdmin())
            parameters.Add("@ForEmployeeId", User.UserId());

        var rows = await db.QueryAsync("dbo.usp_Order_List", parameters, ct);
        return Ok(ApiResponse.Ok(PagedResult<Row>.FromRows(rows, f.PageNumber, f.PageSize)));
    }

    [HttpGet("{orderId:long}")]
    public async Task<IActionResult> Detail(long orderId, CancellationToken ct)
    {
        var sets = await db.QueryMultipleAsync("dbo.usp_Order_GetById", new SpParams()
            .Add("@OrderId", orderId)
            .Add("@RestrictToUser", false), maxResultSets: 4, ct: ct);

        var order = sets.Count > 0 ? sets[0].FirstOrDefault() : null;
        if (order is null)
            return NotFound(ApiResponse.Fail("Order nahi mila."));

        var access = await guard.CanManageAsync(User, order.Int("restaurantId"), ManagePermission.Order, ct);
        if (!access.Allowed) return Forbid403(access.Reason!);

        return Ok(ApiResponse.Ok(new
        {
            order,
            items = Set(sets, 1),
            timeline = Set(sets, 2),
            payments = Set(sets, 3)
        }));
    }

    /// <summary>
    /// Order status aage badhana. Valid transitions SP enforce karti hai:
    /// PLACED -> CONFIRMED/REJECTED, CONFIRMED -> PREPARING,
    /// PREPARING -> OUT_FOR_DELIVERY, OUT_FOR_DELIVERY -> DELIVERED.
    /// </summary>
    [HttpPut("{orderId:long}/status")]
    public async Task<IActionResult> UpdateStatus(
        long orderId,
        [FromBody] UpdateOrderStatusRequest req,
        CancellationToken ct)
    {
        var status = req.Status.Trim().ToUpperInvariant();

        if (!OrderConstants.OrderStatuses.Contains(status))
            return BadRequest(ApiResponse.Fail(
                $"Status '{status}' valid nahi hai. Allowed: {string.Join(", ", OrderConstants.OrderStatuses)}"));

        var order = await db.QuerySingleAsync("dbo.usp_Order_GetById", new SpParams()
            .Add("@OrderId", orderId)
            .Add("@RestrictToUser", false), ct);

        if (order is null)
            return NotFound(ApiResponse.Fail("Order nahi mila."));

        var access = await guard.CanManageAsync(User, order.Int("restaurantId"), ManagePermission.Order, ct);
        if (!access.Allowed) return Forbid403(access.Reason!);

        var row = await db.QuerySingleAsync("dbo.usp_Order_UpdateStatus", new SpParams()
            .Add("@OrderId", orderId)
            .Add("@NewStatus", status)
            .AddIfNotNull("@Remarks", req.Remarks?.Trim())
            .Add("@ChangedByUserId", User.UserId()), ct);

        var affected = row?.Int("affectedRows") ?? 0;
        var message = row?.Str("message") ?? "Status update nahi hua.";

        if (affected == 0)
            return BadRequest(ApiResponse.Fail(message));

        logger.LogInformation("Order {OrderId} -> {Status} by user {UserId}", orderId, status, User.UserId());
        return Ok(ApiResponse.Ok(message));
    }

    /// <summary>Delivery partner assign karna (usi restaurant ka employee hona chahiye).</summary>
    [HttpPut("{orderId:long}/assign-delivery")]
    public async Task<IActionResult> AssignDelivery(
        long orderId,
        [FromBody] AssignDeliveryRequest req,
        CancellationToken ct)
    {
        var order = await db.QuerySingleAsync("dbo.usp_Order_GetById", new SpParams()
            .Add("@OrderId", orderId)
            .Add("@RestrictToUser", false), ct);

        if (order is null)
            return NotFound(ApiResponse.Fail("Order nahi mila."));

        var access = await guard.CanManageAsync(User, order.Int("restaurantId"), ManagePermission.Order, ct);
        if (!access.Allowed) return Forbid403(access.Reason!);

        var row = await db.QuerySingleAsync("dbo.usp_Order_AssignDelivery", new SpParams()
            .Add("@OrderId", orderId)
            .Add("@DeliveryEmployeeId", req.DeliveryEmployeeId)
            .Add("@AssignedByUserId", User.UserId()), ct);

        var affected = row?.Int("affectedRows") ?? 0;
        var message = row?.Str("message") ?? "Assign nahi ho saka.";

        return affected > 0 ? Ok(ApiResponse.Ok(message)) : BadRequest(ApiResponse.Fail(message));
    }

    /// <summary>Kis restaurant par kaunse delivery employees hain.</summary>
    [HttpGet("delivery-staff")]
    public async Task<IActionResult> DeliveryStaff([FromQuery] int restaurantId, CancellationToken ct)
    {
        var access = await guard.CanManageAsync(User, restaurantId, ManagePermission.Order, ct);
        if (!access.Allowed) return Forbid403(access.Reason!);

        var rows = await db.QueryAsync("dbo.usp_Employee_List", new SpParams()
            .Add("@RestaurantId", restaurantId)
            .Add("@IsActive", true)
            .Add("@PageSize", 100), ct);

        return Ok(ApiResponse.Ok(rows));
    }

    private ObjectResult Forbid403(string reason) =>
        StatusCode(StatusCodes.Status403Forbidden, ApiResponse.Fail(reason));

    private static List<Row> Set(List<List<Row>> sets, int i) => i < sets.Count ? sets[i] : [];
}
