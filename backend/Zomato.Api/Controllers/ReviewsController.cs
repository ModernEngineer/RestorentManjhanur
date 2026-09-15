using Zomato.Api.Models;

namespace Zomato.Api.Controllers;

[ApiController]
[Route("api/reviews")]
public sealed class ReviewsController(Db db) : ControllerBase
{
    /// <summary>Restaurant page ke reviews (public).</summary>
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> List(
        [FromQuery] int? restaurantId,
        [FromQuery] decimal? minRating,
        [FromQuery] string sortBy = "newest",
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken ct = default)
    {
        var rows = await db.QueryAsync("dbo.usp_Review_List", new SpParams()
            .AddIfNotNull("@RestaurantId", restaurantId)
            .AddIfNotNull("@MinRating", minRating)
            .Add("@IsApproved", true)
            .Add("@SortBy", sortBy)
            .Add("@PageNumber", pageNumber)
            .Add("@PageSize", Math.Clamp(pageSize, 1, 50)), ct);

        return Ok(ApiResponse.Ok(PagedResult<Row>.FromRows(rows, pageNumber, pageSize)));
    }

    /// <summary>Apne diye hue reviews.</summary>
    [HttpGet("my")]
    [Authorize]
    public async Task<IActionResult> My(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken ct = default)
    {
        var rows = await db.QueryAsync("dbo.usp_Review_List", new SpParams()
            .Add("@UserId", User.UserId())
            .Add("@SortBy", "newest")
            .Add("@PageNumber", pageNumber)
            .Add("@PageSize", Math.Clamp(pageSize, 1, 50)), ct);

        return Ok(ApiResponse.Ok(PagedResult<Row>.FromRows(rows, pageNumber, pageSize)));
    }

    /// <summary>
    /// Review add karta hai. OrderId bheja to sirf DELIVERED order par
    /// allowed hai (verified review), aur ek order par ek hi review.
    /// </summary>
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Add([FromBody] ReviewRequest req, CancellationToken ct)
    {
        var row = await db.QuerySingleAsync("dbo.usp_Review_Add", new SpParams()
            .Add("@RestaurantId", req.RestaurantId)
            .Add("@UserId", User.UserId())
            .AddIfNotNull("@OrderId", req.OrderId)
            .Add("@Rating", req.Rating)
            .AddIfNotNull("@FoodRating", req.FoodRating)
            .AddIfNotNull("@ServiceRating", req.ServiceRating)
            .AddIfNotNull("@Title", req.Title?.Trim())
            .AddIfNotNull("@Comment", req.Comment?.Trim())
            .AddIfNotNull("@ImageUrl", req.ImageUrl), ct);

        if (row is null)
            return BadRequest(ApiResponse.Fail("Review add nahi ho saka."));

        var reviewId = row.Long("reviewId");
        var message = row.Str("message") ?? "";

        return reviewId > 0
            ? Ok(ApiResponse.Ok(row, message))
            : BadRequest(ApiResponse.Fail(message));
    }

    [HttpPost("{reviewId:long}/like")]
    [Authorize]
    public async Task<IActionResult> Like(long reviewId, CancellationToken ct)
    {
        var row = await db.QuerySingleAsync("dbo.usp_Review_Like",
            new SpParams().Add("@ReviewId", reviewId), ct);

        return row is null
            ? NotFound(ApiResponse.Fail("Review nahi mila."))
            : Ok(ApiResponse.Ok(row));
    }
}
