using System.ComponentModel.DataAnnotations;

namespace Zomato.Api.Models;

public sealed class RegisterRequest
{
    [Required(ErrorMessage = "Naam zaroori hai.")]
    [StringLength(120, MinimumLength = 2)]
    public string FullName { get; set; } = "";

    [Required(ErrorMessage = "Email zaroori hai.")]
    [EmailAddress(ErrorMessage = "Email valid nahi hai.")]
    [StringLength(160)]
    public string Email { get; set; } = "";

    [Phone(ErrorMessage = "Phone number valid nahi hai.")]
    [StringLength(20)]
    public string? Phone { get; set; }

    [Required(ErrorMessage = "Password zaroori hai.")]
    [StringLength(100, MinimumLength = 8, ErrorMessage = "Password kam se kam 8 characters ka ho.")]
    public string Password { get; set; } = "";
}

public sealed class LoginRequest
{
    [Required(ErrorMessage = "Email zaroori hai.")]
    [EmailAddress]
    public string Email { get; set; } = "";

    [Required(ErrorMessage = "Password zaroori hai.")]
    public string Password { get; set; } = "";
}

public sealed class RefreshTokenRequest
{
    [Required]
    public string RefreshToken { get; set; } = "";
}

public sealed class ChangePasswordRequest
{
    [Required] public string CurrentPassword { get; set; } = "";

    [Required]
    [StringLength(100, MinimumLength = 8, ErrorMessage = "Naya password kam se kam 8 characters ka ho.")]
    public string NewPassword { get; set; } = "";
}

public sealed class UpdateProfileRequest
{
    [Required][StringLength(120, MinimumLength = 2)] public string FullName { get; set; } = "";
    [Phone][StringLength(20)] public string? Phone { get; set; }
    [StringLength(500)] public string? ProfileImage { get; set; }
}

public sealed class AddressRequest
{
    public int AddressId { get; set; }

    [Required][StringLength(40)] public string Label { get; set; } = "Home";
    [Required][StringLength(300, MinimumLength = 5)] public string AddressLine { get; set; } = "";
    [StringLength(160)] public string? Landmark { get; set; }
    [Required][StringLength(80)] public string City { get; set; } = "";
    [StringLength(10)] public string? Pincode { get; set; }

    [Range(-90, 90, ErrorMessage = "Latitude -90 se 90 ke beech honi chahiye.")]
    public decimal Latitude { get; set; }

    [Range(-180, 180, ErrorMessage = "Longitude -180 se 180 ke beech honi chahiye.")]
    public decimal Longitude { get; set; }

    public bool IsDefault { get; set; }
}

public sealed record AuthResponse(
    int UserId,
    string FullName,
    string Email,
    string? Phone,
    string Role,
    string? ProfileImage,
    string AccessToken,
    string RefreshToken,
    DateTime AccessTokenExpiresAt,
    List<Row> AssignedRestaurants);
