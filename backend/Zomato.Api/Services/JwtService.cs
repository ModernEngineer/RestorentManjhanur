using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Zomato.Api.Services;

public sealed class JwtSettings
{
    public string Key { get; set; } = "";
    public string Issuer { get; set; } = "ZomatoCloneApi";
    public string Audience { get; set; } = "ZomatoCloneClient";
    public int AccessTokenMinutes { get; set; } = 120;
    public int RefreshTokenDays { get; set; } = 7;
}

public sealed record TokenPair(
    string AccessToken,
    string RefreshToken,
    DateTime AccessTokenExpiresAt,
    DateTime RefreshTokenExpiresAt);

public sealed class JwtService(IOptions<JwtSettings> options)
{
    private readonly JwtSettings _s = options.Value;

    public TokenPair CreateTokens(int userId, string fullName, string email, string role)
    {
        var accessExpiry = DateTime.UtcNow.AddMinutes(_s.AccessTokenMinutes);
        var refreshExpiry = DateTime.UtcNow.AddDays(_s.RefreshTokenDays);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Name, fullName),
            new(ClaimTypes.Email, email),
            new(ClaimTypes.Role, role),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_s.Key));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _s.Issuer,
            audience: _s.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: accessExpiry,
            signingCredentials: creds);

        return new TokenPair(
            new JwtSecurityTokenHandler().WriteToken(token),
            GenerateRefreshToken(),
            accessExpiry,
            refreshExpiry);
    }

    public static string GenerateRefreshToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
}
