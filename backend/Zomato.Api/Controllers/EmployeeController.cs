using Zomato.Api.Models;

namespace Zomato.Api.Controllers;

/// <summary>
/// Employee panel - apna dashboard, assigned restaurants aur apni deliveries.
/// </summary>
[ApiController]
[Route("api/employee")]
[Authorize(Roles = AppRoles.AdminOrEmployee)]
public sealed class EmployeeController(Db db, AccessGuard guard) : ControllerBase
{
    /// <summary>
    /// Employee dashboard - sirf uske assigned restaurants ka data:
    /// KPI, per-restaurant snapshot aur aaj ke pending orders.
    /// </summary>
    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard(CancellationToken ct)
    {
        var sets = await db.QueryMultipleAsync("dbo.usp_Dashboard_EmployeeStats",
            new SpParams().Add("@UserId", User.UserId()), maxResultSets: 3, ct: ct);

        return Ok(ApiResponse.Ok(new
        {
            kpi = Set(sets, 0).FirstOrDefault(),
            restaurants = Set(sets, 1),
            pendingOrders = Set(sets, 2)
        }));
    }

    /// <summary>Mujhe kaunse restaurants assign hue hain (aur kya permissions hain).</summary>
    [HttpGet("my-restaurants")]
    public async Task<IActionResult> MyRestaurants(CancellationToken ct) =>
        Ok(ApiResponse.Ok(await guard.GetAssignmentsAsync(User.UserId(), ct)));

    /// <summary>Mujhe assign ki gayi deliveries.</summary>
    [HttpGet("my-deliveries")]
    public async Task<IActionResult> MyDeliveries(
        [FromQuery] string? status,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var rows = await db.QueryAsync("dbo.usp_Order_List", new SpParams()
            .Add("@DeliveryEmployeeId", User.UserId())
            .AddIfNotNull("@Status", status?.ToUpperInvariant())
            .Add("@PageNumber", pageNumber)
            .Add("@PageSize", Math.Clamp(pageSize, 1, 100)), ct);

        return Ok(ApiResponse.Ok(PagedResult<Row>.FromRows(rows, pageNumber, pageSize)));
    }

    /// <summary>
    /// Delivery employee apni assigned delivery ko OUT_FOR_DELIVERY /
    /// DELIVERED mark kar sakta hai.
    /// </summary>
    [HttpPut("my-deliveries/{orderId:long}/status")]
    public async Task<IActionResult> UpdateMyDelivery(
        long orderId,
        [FromBody] UpdateOrderStatusRequest req,
        CancellationToken ct)
    {
        var status = req.Status.Trim().ToUpperInvariant();

        if (status is not ("OUT_FOR_DELIVERY" or "DELIVERED"))
            return BadRequest(ApiResponse.Fail(
                "Delivery partner sirf OUT_FOR_DELIVERY ya DELIVERED set kar sakta hai."));

        var order = await db.QuerySingleAsync("dbo.usp_Order_GetById", new SpParams()
            .Add("@OrderId", orderId)
            .Add("@RestrictToUser", false), ct);

        if (order is null)
            return NotFound(ApiResponse.Fail("Order nahi mila."));

        if (!User.IsAdmin() && order.Get<int?>("deliveryEmployeeId") != User.UserId())
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse.Fail("Ye delivery aapko assign nahi hui hai."));

        var row = await db.QuerySingleAsync("dbo.usp_Order_UpdateStatus", new SpParams()
            .Add("@OrderId", orderId)
            .Add("@NewStatus", status)
            .AddIfNotNull("@Remarks", req.Remarks?.Trim())
            .Add("@ChangedByUserId", User.UserId()), ct);

        var affected = row?.Int("affectedRows") ?? 0;
        var message = row?.Str("message") ?? "Update nahi hua.";

        return affected > 0 ? Ok(ApiResponse.Ok(message)) : BadRequest(ApiResponse.Fail(message));
    }

    private static List<Row> Set(List<List<Row>> sets, int i) => i < sets.Count ? sets[i] : [];
}
