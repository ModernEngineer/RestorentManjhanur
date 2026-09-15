using Zomato.Api.Models;

namespace Zomato.Api.Controllers;

[ApiController]
[Route("api/restaurants")]
[AllowAnonymous]
public sealed class RestaurantsController(Db db) : ControllerBase
{
    /// <summary>
    /// Zomato jaisi listing - saare filters, sorting, distance aur pagination.
    /// lat/lng bhejo to distance, delivery fee aur 15 km ka deliverable flag milega.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] RestaurantFilter f, CancellationToken ct)
    {
        var rows = await db.QueryAsync("dbo.usp_Restaurant_Search", new SpParams()
            .AddIfNotNull("@Search", f.Search)
            .AddIfNotNull("@City", f.City)
            .AddIfNotNull("@Locality", f.Locality)
            .AddIfNotNull("@CuisineIds", f.CuisineIds)
            .AddIfNotNull("@MinRating", f.MinRating)
            .AddIfNotNull("@MinCostForTwo", f.MinCostForTwo)
            .AddIfNotNull("@MaxCostForTwo", f.MaxCostForTwo)
            .Add("@PureVegOnly", f.PureVegOnly)
            .Add("@OutdoorSeating", f.OutdoorSeating)
            .Add("@PetFriendly", f.PetFriendly)
            .Add("@ServesAlcohol", f.ServesAlcohol)
            .Add("@OpenNow", f.OpenNow)
            .Add("@HasOffers", f.HasOffers)
            .Add("@HasTableBooking", f.HasTableBooking)
            .Add("@HasHallBooking", f.HasHallBooking)
            .AddIfNotNull("@UserLat", f.Lat)
            .AddIfNotNull("@UserLng", f.Lng)
            .AddIfNotNull("@MaxDistanceKm", f.MaxDistanceKm)
            .Add("@OnlyDeliverable", f.OnlyDeliverable)
            .Add("@SortBy", f.SortBy)
            .Add("@PageNumber", f.PageNumber)
            .Add("@PageSize", f.PageSize), ct);

        return Ok(ApiResponse.Ok(PagedResult<Row>.FromRows(rows, f.PageNumber, f.PageSize)));
    }

    /// <summary>Slug se detail page ka poora data (menu, reviews, halls, offers).</summary>
    [HttpGet("{slug}")]
    public async Task<IActionResult> GetBySlug(
        string slug,
        [FromQuery] decimal? lat,
        [FromQuery] decimal? lng,
        CancellationToken ct)
    {
        var sets = await db.QueryMultipleAsync("dbo.usp_Restaurant_GetDetail", new SpParams()
            .Add("@Slug", slug)
            .AddIfNotNull("@UserLat", lat)
            .AddIfNotNull("@UserLng", lng), maxResultSets: 8, ct: ct);

        var restaurant = sets.Count > 0 ? sets[0].FirstOrDefault() : null;
        if (restaurant is null)
            return NotFound(ApiResponse.Fail($"'{slug}' naam ka restaurant nahi mila."));

        return Ok(ApiResponse.Ok(new
        {
            restaurant,
            cuisines = Set(sets, 1),
            categories = Set(sets, 2),
            menu = Set(sets, 3),
            reviews = Set(sets, 4),
            halls = Set(sets, 5),
            offers = Set(sets, 6),
            ratingBreakdown = Set(sets, 7)
        }));
    }

    [HttpGet("id/{restaurantId:int}")]
    public async Task<IActionResult> GetById(
        int restaurantId,
        [FromQuery] decimal? lat,
        [FromQuery] decimal? lng,
        CancellationToken ct)
    {
        var sets = await db.QueryMultipleAsync("dbo.usp_Restaurant_GetDetail", new SpParams()
            .Add("@RestaurantId", restaurantId)
            .AddIfNotNull("@UserLat", lat)
            .AddIfNotNull("@UserLng", lng), maxResultSets: 8, ct: ct);

        var restaurant = sets.Count > 0 ? sets[0].FirstOrDefault() : null;
        if (restaurant is null)
            return NotFound(ApiResponse.Fail("Restaurant nahi mila."));

        return Ok(ApiResponse.Ok(new
        {
            restaurant,
            cuisines = Set(sets, 1),
            categories = Set(sets, 2),
            menu = Set(sets, 3),
            reviews = Set(sets, 4),
            halls = Set(sets, 5),
            offers = Set(sets, 6),
            ratingBreakdown = Set(sets, 7)
        }));
    }

    /// <summary>
    /// 15 km delivery rule ka check - address select karte time frontend
    /// isi se pata karta hai ki delivery hogi ya nahi.
    /// </summary>
    [HttpGet("{restaurantId:int}/deliverable")]
    public async Task<IActionResult> CheckDeliverable(
        int restaurantId,
        [FromQuery] decimal lat,
        [FromQuery] decimal lng,
        CancellationToken ct)
    {
        if (lat is < -90 or > 90 || lng is < -180 or > 180)
            return BadRequest(ApiResponse.Fail("Latitude/longitude valid nahi hai."));

        var row = await db.QuerySingleAsync("dbo.usp_CheckDeliverable", new SpParams()
            .Add("@RestaurantId", restaurantId)
            .Add("@Lat", lat)
            .Add("@Lng", lng), ct);

        return row is null
            ? NotFound(ApiResponse.Fail("Restaurant nahi mila."))
            : Ok(ApiResponse.Ok(row));
    }

    [HttpGet("cuisines")]
    public async Task<IActionResult> Cuisines(CancellationToken ct) =>
        Ok(ApiResponse.Ok(await db.QueryAsync("dbo.usp_Cuisine_List", null, ct)));

    [HttpGet("localities")]
    public async Task<IActionResult> Localities([FromQuery] string? city, CancellationToken ct) =>
        Ok(ApiResponse.Ok(await db.QueryAsync("dbo.usp_Locality_List",
            new SpParams().AddIfNotNull("@City", city), ct)));

    /// <summary>Global dish search - home page ke search bar ke liye.</summary>
    [HttpGet("dishes/search")]
    public async Task<IActionResult> SearchDishes(
        [FromQuery] string q,
        [FromQuery] string? city,
        [FromQuery] decimal? lat,
        [FromQuery] decimal? lng,
        [FromQuery] int topN = 20,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
            return BadRequest(ApiResponse.Fail("Search me kam se kam 2 characters likho."));

        var rows = await db.QueryAsync("dbo.usp_FoodItem_Search", new SpParams()
            .Add("@Search", q.Trim())
            .AddIfNotNull("@City", city)
            .AddIfNotNull("@UserLat", lat)
            .AddIfNotNull("@UserLng", lng)
            .Add("@TopN", Math.Clamp(topN, 1, 50)), ct);

        return Ok(ApiResponse.Ok(rows));
    }

    private static List<Row> Set(List<List<Row>> sets, int i) => i < sets.Count ? sets[i] : [];
}
