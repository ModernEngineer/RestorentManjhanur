using Zomato.Api.Models;

namespace Zomato.Api.Controllers;

/// <summary>
/// Menu management - Admin sab restaurants ka, Employee sirf apne assigned
/// restaurants ka (aur wahan bhi CanManageMenu = 1 hone par).
/// Food item ki image badalne ka endpoint bhi yahin hai.
/// </summary>
[ApiController]
[Route("api/manage/menu")]
[Authorize(Roles = AppRoles.AdminOrEmployee)]
public sealed class ManageMenuController(
    Db db,
    AccessGuard guard,
    FileStorageService files,
    ILogger<ManageMenuController> logger) : ControllerBase
{
    /* =========================== FOOD ITEMS =========================== */

    [HttpGet("items")]
    public async Task<IActionResult> Items([FromQuery] FoodItemFilter f, CancellationToken ct)
    {
        // Employee bina restaurantId ke list na maange - scope zaroori hai
        if (f.RestaurantId is null && !User.IsAdmin())
            return BadRequest(ApiResponse.Fail("restaurantId dena zaroori hai."));

        if (f.RestaurantId is not null)
        {
            var access = await guard.CanManageAsync(User, f.RestaurantId.Value, ManagePermission.Menu, ct);
            if (!access.Allowed) return Forbid403(access.Reason!);
        }

        var rows = await db.QueryAsync("dbo.usp_FoodItem_List", new SpParams()
            .AddIfNotNull("@RestaurantId", f.RestaurantId)
            .AddIfNotNull("@CategoryId", f.CategoryId)
            .AddIfNotNull("@Search", f.Search)
            .Add("@VegOnly", f.VegOnly)
            .Add("@NonVegOnly", f.NonVegOnly)
            .Add("@Bestseller", f.Bestseller)
            .Add("@OnlyOffers", f.OnlyOffers)
            .AddIfNotNull("@MinPrice", f.MinPrice)
            .AddIfNotNull("@MaxPrice", f.MaxPrice)
            .Add("@IncludeInactive", f.IncludeInactive)
            .Add("@SortBy", f.SortBy)
            .Add("@PageNumber", f.PageNumber)
            .Add("@PageSize", f.PageSize), ct);

        return Ok(ApiResponse.Ok(PagedResult<Row>.FromRows(rows, f.PageNumber, f.PageSize)));
    }

    [HttpGet("items/{foodItemId:int}")]
    public async Task<IActionResult> GetItem(int foodItemId, CancellationToken ct)
    {
        var item = await db.QuerySingleAsync("dbo.usp_FoodItem_GetById",
            new SpParams().Add("@FoodItemId", foodItemId), ct);

        if (item is null)
            return NotFound(ApiResponse.Fail("Item nahi mila."));

        var access = await guard.CanManageAsync(User, item.Int("restaurantId"), ManagePermission.Menu, ct);
        if (!access.Allowed) return Forbid403(access.Reason!);

        return Ok(ApiResponse.Ok(item));
    }

    [HttpPost("items")]
    public async Task<IActionResult> SaveItem([FromBody] FoodItemRequest req, CancellationToken ct)
    {
        var access = await guard.CanManageAsync(User, req.RestaurantId, ManagePermission.Menu, ct);
        if (!access.Allowed) return Forbid403(access.Reason!);

        if (req.DiscountPrice is not null && req.DiscountPrice >= req.Price)
            return BadRequest(ApiResponse.Fail("Discount price, normal price se kam honi chahiye."));

        var row = await db.QuerySingleAsync("dbo.usp_FoodItem_Save", new SpParams()
            .Add("@FoodItemId", req.FoodItemId)
            .Add("@RestaurantId", req.RestaurantId)
            .AddIfNotNull("@CategoryId", req.CategoryId)
            .Add("@Name", req.Name.Trim())
            .AddIfNotNull("@Description", req.Description?.Trim())
            .Add("@Price", req.Price)
            .AddIfNotNull("@DiscountPrice", req.DiscountPrice)
            .AddIfNotNull("@ImageUrl", req.ImageUrl)
            .Add("@IsVeg", req.IsVeg)
            .Add("@IsBestseller", req.IsBestseller)
            .Add("@IsAvailable", req.IsAvailable)
            .AddIfNotNull("@ServesCount", req.ServesCount)
            .Add("@DisplayOrder", req.DisplayOrder)
            .Add("@IsActive", req.IsActive), ct);

        var itemId = row?.Int("foodItemId") ?? -1;
        var message = row?.Str("message") ?? "Save nahi ho saka.";

        return itemId > 0
            ? Ok(ApiResponse.Ok(row, "Item save ho gaya."))
            : BadRequest(ApiResponse.Fail(message));
    }

    /// <summary>
    /// Food item ki image badalna - URL se.
    /// (File upload ke liye POST items/{id}/image/upload use karo.)
    /// </summary>
    [HttpPut("items/{foodItemId:int}/image")]
    public async Task<IActionResult> UpdateItemImage(
        int foodItemId,
        [FromBody] UpdateImageRequest req,
        CancellationToken ct)
    {
        var item = await db.QuerySingleAsync("dbo.usp_FoodItem_GetById",
            new SpParams().Add("@FoodItemId", foodItemId), ct);

        if (item is null)
            return NotFound(ApiResponse.Fail("Item nahi mila."));

        var access = await guard.CanManageAsync(User, item.Int("restaurantId"), ManagePermission.Menu, ct);
        if (!access.Allowed) return Forbid403(access.Reason!);

        var row = await db.QuerySingleAsync("dbo.usp_FoodItem_UpdateImage", new SpParams()
            .Add("@FoodItemId", foodItemId)
            .Add("@ImageUrl", req.ImageUrl.Trim()), ct);

        return Ok(ApiResponse.Ok(row, "Image update ho gayi."));
    }

    /// <summary>
    /// Food item ki image badalna - file upload karke. Ek hi call me upload
    /// hoti hai aur DB me set ho jaati hai; purani uploaded file delete ho jaati hai.
    /// </summary>
    [HttpPost("items/{foodItemId:int}/image/upload")]
    [RequestSizeLimit(FileStorageService.MaxBytes + 1024)]
    public async Task<IActionResult> UploadItemImage(
        int foodItemId,
        IFormFile file,
        CancellationToken ct)
    {
        var item = await db.QuerySingleAsync("dbo.usp_FoodItem_GetById",
            new SpParams().Add("@FoodItemId", foodItemId), ct);

        if (item is null)
            return NotFound(ApiResponse.Fail("Item nahi mila."));

        var access = await guard.CanManageAsync(User, item.Int("restaurantId"), ManagePermission.Menu, ct);
        if (!access.Allowed) return Forbid403(access.Reason!);

        var (ok, error) = FileStorageService.Validate(file, "food");
        if (!ok) return BadRequest(ApiResponse.Fail(error!));

        var oldImage = item.Str("imageUrl");
        var stored = await files.SaveAsync(file, "food", ct);

        var row = await db.QuerySingleAsync("dbo.usp_FoodItem_UpdateImage", new SpParams()
            .Add("@FoodItemId", foodItemId)
            .Add("@ImageUrl", stored.Url), ct);

        // Purani image hamari hi upload thi to hata do (external URL chhod do)
        files.TryDelete(oldImage);

        logger.LogInformation("Food item {ItemId} ki image badli gayi -> {Url} (by user {UserId})",
            foodItemId, stored.Url, User.UserId());

        return Ok(ApiResponse.Ok(new
        {
            item = row,
            imageUrl = stored.Url,
            sizeBytes = stored.SizeBytes
        }, "Image upload aur update ho gayi."));
    }

    [HttpPut("items/{foodItemId:int}/availability")]
    public async Task<IActionResult> ToggleAvailability(
        int foodItemId,
        [FromBody] ToggleRequest req,
        CancellationToken ct)
    {
        var item = await db.QuerySingleAsync("dbo.usp_FoodItem_GetById",
            new SpParams().Add("@FoodItemId", foodItemId), ct);

        if (item is null)
            return NotFound(ApiResponse.Fail("Item nahi mila."));

        var access = await guard.CanManageAsync(User, item.Int("restaurantId"), ManagePermission.Menu, ct);
        if (!access.Allowed) return Forbid403(access.Reason!);

        await db.ExecuteAsync("dbo.usp_FoodItem_ToggleAvailability", new SpParams()
            .Add("@FoodItemId", foodItemId)
            .Add("@IsAvailable", req.IsActive), ct);

        return Ok(ApiResponse.Ok(req.IsActive ? "Item available kar diya." : "Item out-of-stock kar diya."));
    }

    [HttpDelete("items/{foodItemId:int}")]
    public async Task<IActionResult> DeleteItem(int foodItemId, CancellationToken ct)
    {
        var item = await db.QuerySingleAsync("dbo.usp_FoodItem_GetById",
            new SpParams().Add("@FoodItemId", foodItemId), ct);

        if (item is null)
            return NotFound(ApiResponse.Fail("Item nahi mila."));

        var access = await guard.CanManageAsync(User, item.Int("restaurantId"), ManagePermission.Menu, ct);
        if (!access.Allowed) return Forbid403(access.Reason!);

        await db.ExecuteAsync("dbo.usp_FoodItem_Delete", new SpParams().Add("@FoodItemId", foodItemId), ct);

        return Ok(ApiResponse.Ok("Item delete ho gaya (purane orders me record bacha rahega)."));
    }

    /// <summary>Ek item, poore restaurant ya ek category par bulk % discount.</summary>
    [HttpPost("items/bulk-discount")]
    public async Task<IActionResult> BulkDiscount([FromBody] BulkDiscountRequest req, CancellationToken ct)
    {
        if (req.FoodItemId is null && req.RestaurantId is null)
            return BadRequest(ApiResponse.Fail("FoodItemId ya RestaurantId me se ek dena zaroori hai."));

        var restaurantId = req.RestaurantId;

        if (restaurantId is null && req.FoodItemId is not null)
        {
            var item = await db.QuerySingleAsync("dbo.usp_FoodItem_GetById",
                new SpParams().Add("@FoodItemId", req.FoodItemId.Value), ct);

            if (item is null) return NotFound(ApiResponse.Fail("Item nahi mila."));
            restaurantId = item.Int("restaurantId");
        }

        var access = await guard.CanManageAsync(User, restaurantId!.Value, ManagePermission.Menu, ct);
        if (!access.Allowed) return Forbid403(access.Reason!);

        var row = await db.QuerySingleAsync("dbo.usp_FoodItem_SetDiscount", new SpParams()
            .AddIfNotNull("@FoodItemId", req.FoodItemId)
            .Add("@RestaurantId", restaurantId.Value)
            .AddIfNotNull("@CategoryId", req.CategoryId)
            .Add("@DiscountPercent", req.DiscountPercent)
            .AddIfNotNull("@MaxPrice", req.MaxPrice), ct);

        var affected = row?.Int("affectedRows") ?? -1;
        var message = row?.Str("message") ?? "Discount apply nahi hua.";

        return affected >= 0
            ? Ok(ApiResponse.Ok(new { affectedItems = affected }, $"{affected} items par discount apply ho gaya."))
            : BadRequest(ApiResponse.Fail(message));
    }

    /* =========================== CATEGORIES =========================== */

    [HttpGet("categories")]
    public async Task<IActionResult> Categories([FromQuery] int? restaurantId, CancellationToken ct) =>
        Ok(ApiResponse.Ok(await db.QueryAsync("dbo.usp_FoodCategory_List",
            new SpParams().AddIfNotNull("@RestaurantId", restaurantId), ct)));

    [HttpPost("categories")]
    public async Task<IActionResult> SaveCategory([FromBody] FoodCategoryRequest req, CancellationToken ct)
    {
        // Global category (RestaurantId = null) sirf admin bana sakta hai
        if (req.RestaurantId is null && !User.IsAdmin())
            return Forbid403("Global category sirf admin bana sakta hai.");

        if (req.RestaurantId is not null)
        {
            var access = await guard.CanManageAsync(User, req.RestaurantId.Value, ManagePermission.Menu, ct);
            if (!access.Allowed) return Forbid403(access.Reason!);
        }

        var row = await db.QuerySingleAsync("dbo.usp_FoodCategory_Save", new SpParams()
            .Add("@CategoryId", req.CategoryId)
            .AddIfNotNull("@RestaurantId", req.RestaurantId)
            .Add("@Name", req.Name.Trim())
            .Add("@DisplayOrder", req.DisplayOrder)
            .Add("@IsActive", req.IsActive), ct);

        return Ok(ApiResponse.Ok(row, "Category save ho gayi."));
    }

    [HttpDelete("categories/{categoryId:int}")]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<IActionResult> DeleteCategory(int categoryId, CancellationToken ct)
    {
        var row = await db.QuerySingleAsync("dbo.usp_FoodCategory_Delete",
            new SpParams().Add("@CategoryId", categoryId), ct);

        var affected = row?.Int("affectedRows") ?? 0;
        var message = row?.Str("message") ?? "Delete nahi ho saka.";

        return affected > 0
            ? Ok(ApiResponse.Ok(message))
            : BadRequest(ApiResponse.Fail(message));
    }

    private ObjectResult Forbid403(string reason) =>
        StatusCode(StatusCodes.Status403Forbidden, ApiResponse.Fail(reason));
}
