using System.Data;
using Zomato.Api.Models;

namespace Zomato.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(
    Db db,
    JwtService jwt,
    PasswordService passwords,
    IOptions<JwtSettings> jwtOptions,
    ILogger<AuthController> logger) : ControllerBase
{
    private readonly JwtSettings _jwtSettings = jwtOptions.Value;

    /* ============================ REGISTER ============================ */

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req, CancellationToken ct)
    {
        var (strongEnough, passwordError) = PasswordService.Validate(req.Password);
        if (!strongEnough)
            return BadRequest(ApiResponse.Fail(passwordError!));

        var parameters = new SpParams()
            .Add("@FullName", req.FullName.Trim())
            .Add("@Email", req.Email.Trim().ToLowerInvariant())
            .AddIfNotNull("@Phone", req.Phone?.Trim())
            .Add("@PasswordHash", passwords.Hash(req.Password))
            .Add("@RoleName", AppRoles.Customer)
            .Out("@NewUserId", SqlDbType.Int);

        var result = await db.ExecuteWithOutputAsync("dbo.usp_User_Register", parameters, ct);
        var newUserId = result.Outputs.Int("NewUserId");

        if (newUserId == 0)
            return Conflict(ApiResponse.Fail("Ye email pehle se registered hai. Login kar lo."));

        if (newUserId < 0)
            return StatusCode(500, ApiResponse.Fail("Role configuration me problem hai. Admin se contact karo."));

        logger.LogInformation("Naya customer register hua: {UserId}", newUserId);

        var auth = await IssueTokensAsync(newUserId, req.FullName.Trim(),
                                          req.Email.Trim().ToLowerInvariant(), AppRoles.Customer,
                                          req.Phone, null, ct);

        return Ok(ApiResponse.Ok(auth, "Account ban gaya. Welcome!"));
    }

    /* ============================== LOGIN ============================= */

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest req, CancellationToken ct)
    {
        var user = await db.QuerySingleAsync("dbo.usp_User_GetByEmail",
            new SpParams().Add("@Email", req.Email.Trim().ToLowerInvariant()), ct);

        // Email milti hai ya nahi, ye leak na ho - message dono case me same
        const string invalid = "Email ya password galat hai.";

        if (user is null)
            return Unauthorized(ApiResponse.Fail(invalid));

        if (!passwords.Verify(req.Password, user.Str("passwordHash") ?? ""))
            return Unauthorized(ApiResponse.Fail(invalid));

        if (!user.Bool("isActive"))
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse.Fail("Aapka account deactivate hai. Admin se contact karo."));

        var auth = await IssueTokensAsync(
            user.Int("userId"),
            user.Str("fullName") ?? "",
            user.Str("email") ?? "",
            user.Str("roleName") ?? AppRoles.Customer,
            user.Str("phone"),
            user.Str("profileImage"),
            ct);

        return Ok(ApiResponse.Ok(auth, $"Welcome back, {auth.FullName}!"));
    }

    /* ============================= REFRESH ============================ */

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequest req, CancellationToken ct)
    {
        var stored = await db.QuerySingleAsync("dbo.usp_RefreshToken_Validate",
            new SpParams().Add("@Token", req.RefreshToken), ct);

        if (stored is null)
            return Unauthorized(ApiResponse.Fail("Refresh token invalid ya expire ho gaya. Dobara login karo."));

        // purana token revoke, naya issue (rotation)
        await db.ExecuteAsync("dbo.usp_RefreshToken_Revoke",
            new SpParams().Add("@Token", req.RefreshToken), ct);

        var auth = await IssueTokensAsync(
            stored.Int("userId"),
            stored.Str("fullName") ?? "",
            stored.Str("email") ?? "",
            stored.Str("roleName") ?? AppRoles.Customer,
            null, null, ct);

        return Ok(ApiResponse.Ok(auth, "Token refresh ho gaya."));
    }

    /* ============================= LOGOUT ============================= */

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout([FromBody] RefreshTokenRequest? req, CancellationToken ct)
    {
        var parameters = new SpParams().Add("@UserId", User.UserId());
        if (!string.IsNullOrWhiteSpace(req?.RefreshToken))
            parameters.Add("@Token", req.RefreshToken);

        await db.ExecuteAsync("dbo.usp_RefreshToken_Revoke", parameters, ct);
        return Ok(ApiResponse.Ok("Logout ho gaya."));
    }

    /* ================================ ME ============================== */

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var sets = await db.QueryMultipleAsync("dbo.usp_User_GetById",
            new SpParams().Add("@UserId", User.UserId()), maxResultSets: 2, ct: ct);

        var user = sets.Count > 0 ? sets[0].FirstOrDefault() : null;
        if (user is null)
            return NotFound(ApiResponse.Fail("User nahi mila."));

        return Ok(ApiResponse.Ok(new
        {
            user,
            assignedRestaurants = sets.Count > 1 ? sets[1] : []
        }));
    }

    /* ============================= PROFILE ============================ */

    [HttpPut("profile")]
    [Authorize]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest req, CancellationToken ct)
    {
        await db.ExecuteAsync("dbo.usp_User_UpdateProfile", new SpParams()
            .Add("@UserId", User.UserId())
            .Add("@FullName", req.FullName.Trim())
            .AddIfNotNull("@Phone", req.Phone?.Trim())
            .AddIfNotNull("@ProfileImage", req.ProfileImage), ct);

        return Ok(ApiResponse.Ok("Profile update ho gaya."));
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req, CancellationToken ct)
    {
        var (strongEnough, passwordError) = PasswordService.Validate(req.NewPassword);
        if (!strongEnough)
            return BadRequest(ApiResponse.Fail(passwordError!));

        var email = User.Email();
        if (string.IsNullOrWhiteSpace(email))
            return Unauthorized(ApiResponse.Fail("Token me email nahi mila. Dobara login karo."));

        var user = await db.QuerySingleAsync("dbo.usp_User_GetByEmail",
            new SpParams().Add("@Email", email), ct);

        if (user is null || !passwords.Verify(req.CurrentPassword, user.Str("passwordHash") ?? ""))
            return BadRequest(ApiResponse.Fail("Current password galat hai."));

        await db.ExecuteAsync("dbo.usp_User_ChangePassword", new SpParams()
            .Add("@UserId", User.UserId())
            .Add("@NewPasswordHash", passwords.Hash(req.NewPassword)), ct);

        return Ok(ApiResponse.Ok("Password change ho gaya. Sabhi devices se logout kar diya gaya."));
    }

    /* ============================ ADDRESSES =========================== */

    [HttpGet("addresses")]
    [Authorize]
    public async Task<IActionResult> Addresses(CancellationToken ct)
    {
        var rows = await db.QueryAsync("dbo.usp_Address_ListByUser",
            new SpParams().Add("@UserId", User.UserId()), ct);

        return Ok(ApiResponse.Ok(rows));
    }

    [HttpPost("addresses")]
    [Authorize]
    public async Task<IActionResult> SaveAddress([FromBody] AddressRequest req, CancellationToken ct)
    {
        var row = await db.QuerySingleAsync("dbo.usp_Address_Save", new SpParams()
            .Add("@AddressId", req.AddressId)
            .Add("@UserId", User.UserId())
            .Add("@Label", req.Label)
            .Add("@AddressLine", req.AddressLine.Trim())
            .AddIfNotNull("@Landmark", req.Landmark?.Trim())
            .Add("@City", req.City.Trim())
            .AddIfNotNull("@Pincode", req.Pincode?.Trim())
            .Add("@Latitude", req.Latitude)
            .Add("@Longitude", req.Longitude)
            .Add("@IsDefault", req.IsDefault), ct);

        return Ok(ApiResponse.Ok(row, "Address save ho gaya."));
    }

    [HttpDelete("addresses/{addressId:int}")]
    [Authorize]
    public async Task<IActionResult> DeleteAddress(int addressId, CancellationToken ct)
    {
        var row = await db.QuerySingleAsync("dbo.usp_Address_Delete", new SpParams()
            .Add("@AddressId", addressId)
            .Add("@UserId", User.UserId()), ct);

        return row?.Int("affectedRows") > 0
            ? Ok(ApiResponse.Ok("Address delete ho gaya."))
            : NotFound(ApiResponse.Fail("Address nahi mila."));
    }

    /* ============================= helpers ============================ */

    private async Task<AuthResponse> IssueTokensAsync(
        int userId, string fullName, string email, string role,
        string? phone, string? profileImage, CancellationToken ct)
    {
        var tokens = jwt.CreateTokens(userId, fullName, email, role);

        await db.ExecuteAsync("dbo.usp_RefreshToken_Save", new SpParams()
            .Add("@UserId", userId)
            .Add("@Token", tokens.RefreshToken)
            .Add("@ExpiresAt", tokens.RefreshTokenExpiresAt), ct);

        // Employee ko uske assigned restaurants bhi chahiye (panel me dikhane ke liye)
        var assigned = role == AppRoles.Employee
            ? await db.QueryAsync("dbo.usp_Employee_GetAssignments",
                  new SpParams().Add("@UserId", userId), ct)
            : [];

        return new AuthResponse(
            userId, fullName, email, phone, role, profileImage,
            tokens.AccessToken, tokens.RefreshToken, tokens.AccessTokenExpiresAt,
            assigned);
    }
}
