namespace Zomato.Api.Services;

public sealed record StoredFile(string Url, string FileName, long SizeBytes);

/// <summary>
/// Image uploads - admin panel me food/restaurant/hall ki photo badalne ke liye.
/// Files wwwroot/uploads/&lt;folder&gt;/ me jaati hain aur relative URL wapas milta hai.
/// </summary>
public sealed class FileStorageService(IWebHostEnvironment env, ILogger<FileStorageService> logger)
{
    public const long MaxBytes = 5 * 1024 * 1024;   // 5 MB

    private static readonly HashSet<string> AllowedExtensions =
        new(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif" };

    private static readonly HashSet<string> AllowedContentTypes =
        new(StringComparer.OrdinalIgnoreCase)
        { "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif" };

    private static readonly HashSet<string> AllowedFolders =
        new(StringComparer.OrdinalIgnoreCase) { "food", "restaurants", "halls", "profiles", "reviews" };

    public static (bool Ok, string? Error) Validate(IFormFile? file, string folder)
    {
        if (file is null || file.Length == 0)
            return (false, "Koi file select nahi ki gayi.");

        if (file.Length > MaxBytes)
            return (false, $"File 5 MB se badi nahi ho sakti (aapki file {file.Length / 1024 / 1024.0:0.#} MB hai).");

        if (!AllowedFolders.Contains(folder))
            return (false, $"Folder '{folder}' allowed nahi hai. Allowed: {string.Join(", ", AllowedFolders)}");

        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(ext) || !AllowedExtensions.Contains(ext))
            return (false, "Sirf jpg, jpeg, png, webp, gif, avif images allowed hain.");

        if (!AllowedContentTypes.Contains(file.ContentType))
            return (false, $"Content type '{file.ContentType}' allowed nahi hai.");

        return (true, null);
    }

    public async Task<StoredFile> SaveAsync(IFormFile file, string folder, CancellationToken ct = default)
    {
        var (ok, error) = Validate(file, folder);
        if (!ok) throw new InvalidOperationException(error);

        var webRoot = env.WebRootPath;
        if (string.IsNullOrWhiteSpace(webRoot))
        {
            webRoot = Path.Combine(env.ContentRootPath, "wwwroot");
            Directory.CreateDirectory(webRoot);
        }

        var targetDir = Path.Combine(webRoot, "uploads", folder);
        Directory.CreateDirectory(targetDir);

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var fileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid():N}{ext}";
        var fullPath = Path.Combine(targetDir, fileName);

        await using (var stream = new FileStream(fullPath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        {
            await file.CopyToAsync(stream, ct);
        }

        var url = $"/uploads/{folder}/{fileName}";
        logger.LogInformation("Image saved: {Url} ({Bytes} bytes)", url, file.Length);

        return new StoredFile(url, fileName, file.Length);
    }

    /// <summary>
    /// Purani uploaded image delete karta hai. Sirf /uploads/ ke andar ki
    /// files delete hoti hain - bahar ka path aaya to false.
    /// </summary>
    public bool TryDelete(string? url)
    {
        if (string.IsNullOrWhiteSpace(url) || !url.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase))
            return false;

        var webRoot = env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot");
        var relative = url.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.GetFullPath(Path.Combine(webRoot, relative));

        var uploadsRoot = Path.GetFullPath(Path.Combine(webRoot, "uploads"));
        if (!fullPath.StartsWith(uploadsRoot, StringComparison.OrdinalIgnoreCase))
        {
            logger.LogWarning("Delete blocked - path uploads folder ke bahar hai: {Url}", url);
            return false;
        }

        if (!File.Exists(fullPath)) return false;

        try
        {
            File.Delete(fullPath);
            logger.LogInformation("Image deleted: {Url}", url);
            return true;
        }
        catch (IOException ex)
        {
            logger.LogWarning(ex, "Image delete fail hui: {Url}", url);
            return false;
        }
    }
}
