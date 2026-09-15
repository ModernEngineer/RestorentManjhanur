using System.Data;
using Zomato.Api.Models;

namespace Zomato.Api.Controllers;

[ApiController]
[Route("api/orders")]
[Authorize]
public sealed class OrdersController(Db db, ILogger<OrdersController> logger) : ControllerBase
{
    /* ========================== PLACE ORDER =========================== */

    /// <summary>
    /// Order place karta hai. Prices DB se hi liye jaate hain (client ki
    /// bheji hui price ignore hoti hai), 15 km radius aur coupon dono
    /// SP ke andar validate hote hain.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Place([FromBody] PlaceOrderRequest req, CancellationToken ct)
    {
        var itemsTable = BuildOrderItemsTable(req.Items);

        var parameters = new SpParams()
            .Add("@UserId", User.UserId())
            .Add("@RestaurantId", req.RestaurantId)
            .AddIfNotNull("@AddressId", req.AddressId)
            .AddTvp("@Items", itemsTable, "dbo.OrderItemTableType")
            .AddIfNotNull("@CouponCode", req.CouponCode?.Trim().ToUpperInvariant())
            .Add("@PaymentMode", req.PaymentMode.ToUpperInvariant())
            .Add("@OrderType", req.OrderType.ToUpperInvariant())
            .AddIfNotNull("@CustomerNote", req.CustomerNote?.Trim())
            .Out("@OrderId", SqlDbType.BigInt)
            .Out("@Message", SqlDbType.NVarChar, 400);

        var result = await db.ExecuteWithOutputAsync("dbo.usp_Order_Create", parameters, ct);

        var orderId = result.Outputs.Long("OrderId");
        var message = result.Outputs.Str("Message") ?? "Order place nahi ho saka.";

        if (orderId <= 0)
        {
            logger.LogWarning("Order create fail (user {UserId}): {Message}", User.UserId(), message);
            return BadRequest(ApiResponse.Fail(message));
        }

        logger.LogInformation("Order {OrderId} placed by user {UserId}", orderId, User.UserId());

        var summary = result.First();
        return Ok(ApiResponse.Ok(summary, message));
    }

    /* ============================ MY ORDERS =========================== */

    [HttpGet("my")]
    public async Task<IActionResult> MyOrders([FromQuery] OrderFilter f, CancellationToken ct)
    {
        var rows = await db.QueryAsync("dbo.usp_Order_List", new SpParams()
            .Add("@UserId", User.UserId())
            .AddIfNotNull("@RestaurantId", f.RestaurantId)
            .AddIfNotNull("@Status", f.Status)
            .AddIfNotNull("@PaymentStatus", f.PaymentStatus)
            .AddIfNotNull("@Search", f.Search)
            .AddIfNotNull("@FromDate", f.FromDate?.ToDateTime(TimeOnly.MinValue))
            .AddIfNotNull("@ToDate", f.ToDate?.ToDateTime(TimeOnly.MinValue))
            .Add("@PageNumber", f.PageNumber)
            .Add("@PageSize", f.PageSize), ct);

        return Ok(ApiResponse.Ok(PagedResult<Row>.FromRows(rows, f.PageNumber, f.PageSize)));
    }

    /* =========================== ORDER DETAIL ========================= */

    [HttpGet("{orderId:long}")]
    public async Task<IActionResult> Detail(long orderId, CancellationToken ct)
    {
        // Customer sirf apna order dekh sakta hai; admin/employee sab dekh sakte hain
        var restrictToOwner = !User.IsAdmin() && !User.IsEmployee();

        var sets = await db.QueryMultipleAsync("dbo.usp_Order_GetById", new SpParams()
            .Add("@OrderId", orderId)
            .Add("@ForUserId", User.UserId())
            .Add("@RestrictToUser", restrictToOwner), maxResultSets: 4, ct: ct);

        var order = sets.Count > 0 ? sets[0].FirstOrDefault() : null;
        if (order is null)
            return NotFound(ApiResponse.Fail("Order nahi mila (ya aapke paas access nahi hai)."));

        return Ok(ApiResponse.Ok(new
        {
            order,
            items = Set(sets, 1),
            timeline = Set(sets, 2),
            payments = Set(sets, 3)
        }));
    }

    /* ============================= CANCEL ============================= */

    /// <summary>Customer apna order cancel kar sakta hai (delivery shuru hone se pehle).</summary>
    [HttpPost("{orderId:long}/cancel")]
    public async Task<IActionResult> Cancel(long orderId, [FromBody] CancelOrderRequest? req, CancellationToken ct)
    {
        var owner = await db.QuerySingleAsync("dbo.usp_Order_GetById", new SpParams()
            .Add("@OrderId", orderId)
            .Add("@ForUserId", User.UserId())
            .Add("@RestrictToUser", !User.IsAdmin()), ct);

        if (owner is null)
            return NotFound(ApiResponse.Fail("Order nahi mila."));

        var row = await db.QuerySingleAsync("dbo.usp_Order_UpdateStatus", new SpParams()
            .Add("@OrderId", orderId)
            .Add("@NewStatus", "CANCELLED")
            .Add("@Remarks", string.IsNullOrWhiteSpace(req?.Remarks)
                ? "Customer ne cancel kiya"
                : req.Remarks.Trim())
            .Add("@ChangedByUserId", User.UserId()), ct);

        var affected = row?.Int("affectedRows") ?? 0;
        var message = row?.Str("message") ?? "Cancel nahi ho saka.";

        return affected > 0
            ? Ok(ApiResponse.Ok(message))
            : BadRequest(ApiResponse.Fail(message));
    }

    /* ============================ RE-ORDER ============================ */

    /// <summary>Purane order ke items wapas cart me dalne ke liye.</summary>
    [HttpGet("{orderId:long}/reorder")]
    public async Task<IActionResult> Reorder(long orderId, CancellationToken ct)
    {
        var sets = await db.QueryMultipleAsync("dbo.usp_Order_GetById", new SpParams()
            .Add("@OrderId", orderId)
            .Add("@ForUserId", User.UserId())
            .Add("@RestrictToUser", true), maxResultSets: 2, ct: ct);

        var order = sets.Count > 0 ? sets[0].FirstOrDefault() : null;
        if (order is null)
            return NotFound(ApiResponse.Fail("Order nahi mila."));

        var items = Set(sets, 1);

        // Jo items ab available nahi hain, unhe flag kar do
        var menu = await db.QueryAsync("dbo.usp_FoodItem_List", new SpParams()
            .Add("@RestaurantId", order.Int("restaurantId"))
            .Add("@PageSize", 100), ct);

        var availableIds = menu
            .Where(m => m.Bool("isAvailable"))
            .Select(m => m.Int("foodItemId"))
            .ToHashSet();

        var cart = items.Select(i => new
        {
            foodItemId = i.Int("foodItemId"),
            name = i.Str("itemName"),
            image = i.Str("itemImage"),
            quantity = i.Int("quantity"),
            isAvailable = availableIds.Contains(i.Int("foodItemId"))
        }).ToList();

        return Ok(ApiResponse.Ok(new
        {
            restaurantId = order.Int("restaurantId"),
            restaurantName = order.Str("restaurantName"),
            restaurantSlug = order.Str("restaurantSlug"),
            items = cart,
            unavailableCount = cart.Count(c => !c.isAvailable)
        }));
    }

    /* ============================= COUPONS ============================ */

    [HttpPost("validate-coupon")]
    public async Task<IActionResult> ValidateCoupon([FromBody] ValidateCouponRequest req, CancellationToken ct)
    {
        var row = await db.QuerySingleAsync("dbo.usp_Coupon_Validate", new SpParams()
            .Add("@Code", req.Code.Trim().ToUpperInvariant())
            .Add("@UserId", User.UserId())
            .AddIfNotNull("@RestaurantId", req.RestaurantId)
            .Add("@OrderAmount", req.OrderAmount)
            .Add("@AppliesTo", req.AppliesTo.ToUpperInvariant()), ct);

        if (row is null)
            return BadRequest(ApiResponse.Fail("Coupon check nahi ho saka."));

        var isValid = row.Bool("isValid");
        var message = row.Str("message") ?? "";

        return isValid
            ? Ok(ApiResponse.Ok(row, message))
            : BadRequest(ApiResponse.Fail(message));
    }

    [HttpGet("coupons")]
    [AllowAnonymous]
    public async Task<IActionResult> AvailableCoupons(
        [FromQuery] int? restaurantId,
        [FromQuery] string? appliesTo,
        CancellationToken ct)
    {
        var rows = await db.QueryAsync("dbo.usp_Coupon_ListActive", new SpParams()
            .AddIfNotNull("@RestaurantId", restaurantId)
            .AddIfNotNull("@AppliesTo", appliesTo?.ToUpperInvariant()), ct);

        return Ok(ApiResponse.Ok(rows));
    }

    /* ============================= helpers ============================ */

    internal static DataTable BuildOrderItemsTable(IEnumerable<CartItemRequest> items)
    {
        var table = new DataTable();
        table.Columns.Add("FoodItemId", typeof(int));
        table.Columns.Add("Quantity", typeof(int));
        table.Columns.Add("Notes", typeof(string));

        foreach (var i in items)
            table.Rows.Add(i.FoodItemId, i.Quantity, (object?)i.Notes ?? DBNull.Value);

        return table;
    }

    private static List<Row> Set(List<List<Row>> sets, int i) => i < sets.Count ? sets[i] : [];
}
