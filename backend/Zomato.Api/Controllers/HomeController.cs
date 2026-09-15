namespace Zomato.Api.Controllers;

/// <summary>
/// Home page ka poora feed ek hi call me - cuisines, top rated, nearby,
/// live offers, happy customers (testimonials), counters aur cities.
/// </summary>
[ApiController]
[Route("api/home")]
[AllowAnonymous]
public sealed class HomeController(Db db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Feed(
        [FromQuery] string? city,
        [FromQuery] decimal? lat,
        [FromQuery] decimal? lng,
        CancellationToken ct)
    {
        var sets = await db.QueryMultipleAsync("dbo.usp_Home_Sections", new SpParams()
            .AddIfNotNull("@City", city)
            .AddIfNotNull("@UserLat", lat)
            .AddIfNotNull("@UserLng", lng), maxResultSets: 7, ct: ct);

        return Ok(ApiResponse.Ok(new
        {
            cuisines = Set(sets, 0),
            topRated = Set(sets, 1),
            nearby = Set(sets, 2),
            offers = Set(sets, 3),
            testimonials = Set(sets, 4),
            counters = Set(sets, 5).FirstOrDefault(),
            cities = Set(sets, 6)
        }));
    }

    /// <summary>Happy customers section (standalone).</summary>
    [HttpGet("testimonials")]
    public async Task<IActionResult> Testimonials([FromQuery] int? topN, CancellationToken ct) =>
        Ok(ApiResponse.Ok(await db.QueryAsync("dbo.usp_Testimonial_List",
            new SpParams().Add("@IncludeInactive", false).AddIfNotNull("@TopN", topN), ct)));

    /// <summary>
    /// Public settings - WhatsApp number, site name, currency, GST %.
    /// Frontend ka WhatsApp floating button isi se number leta hai.
    /// </summary>
    [HttpGet("settings")]
    public async Task<IActionResult> Settings(CancellationToken ct)
    {
        var rows = await db.QueryAsync("dbo.usp_Setting_GetAll", null, ct);

        var map = rows.ToDictionary(
            r => r.Str("settingKey") ?? "",
            r => r.Str("settingValue"),
            StringComparer.OrdinalIgnoreCase);

        return Ok(ApiResponse.Ok(map));
    }

    private static List<Row> Set(List<List<Row>> sets, int i) => i < sets.Count ? sets[i] : [];
}
