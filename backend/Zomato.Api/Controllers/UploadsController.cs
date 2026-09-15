namespace Zomato.Api.Controllers;

/// <summary>
/// Generic image upload. Upload karke URL milta hai, jise phir kisi bhi
/// save/update call me ImageUrl ki tarah bhej sakte ho.
/// (Food item ke liye direct one-shot endpoint bhi hai:
///  POST /api/manage/menu/items/{id}/image/upload)
/// </summary>
[ApiController]
[Route("api/uploads")]
[Authorize(Roles = AppRoles.AdminOrEmployee)]
public sealed class UploadsController(FileStorageService files) : ControllerBase
{
    /// <summary>folder: food | restaurants | halls | profiles | reviews</summary>
    [HttpPost("{folder}")]
    [RequestSizeLimit(FileStorageService.MaxBytes + 1024)]
    public async Task<IActionResult> Upload(string folder, IFormFile file, CancellationToken ct)
    {
        var (ok, error) = FileStorageService.Validate(file, folder);
        if (!ok) return BadRequest(ApiResponse.Fail(error!));

        var stored = await files.SaveAsync(file, folder, ct);

        return Ok(ApiResponse.Ok(new
        {
            url = stored.Url,
            fileName = stored.FileName,
            sizeBytes = stored.SizeBytes
        }, "Image upload ho gayi."));
    }

    /// <summary>Apni profile photo - koi bhi logged-in user.</summary>
    [HttpPost("profile-photo")]
    [Authorize]
    [RequestSizeLimit(FileStorageService.MaxBytes + 1024)]
    public async Task<IActionResult> UploadProfilePhoto(IFormFile file, CancellationToken ct)
    {
        var (ok, error) = FileStorageService.Validate(file, "profiles");
        if (!ok) return BadRequest(ApiResponse.Fail(error!));

        var stored = await files.SaveAsync(file, "profiles", ct);
        return Ok(ApiResponse.Ok(new { url = stored.Url }, "Profile photo upload ho gayi."));
    }

    /// <summary>Uploaded image delete (sirf admin).</summary>
    [HttpDelete]
    [Authorize(Roles = AppRoles.Admin)]
    public IActionResult Delete([FromQuery] string url)
    {
        if (string.IsNullOrWhiteSpace(url))
            return BadRequest(ApiResponse.Fail("url query parameter zaroori hai."));

        return files.TryDelete(url)
            ? Ok(ApiResponse.Ok("Image delete ho gayi."))
            : NotFound(ApiResponse.Fail("File nahi mili ya /uploads/ ke bahar hai."));
    }
}
