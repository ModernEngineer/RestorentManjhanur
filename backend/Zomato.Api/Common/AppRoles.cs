using System.Security.Claims;

namespace Zomato.Api.Common;

public static class AppRoles
{
    public const string Admin = "Admin";
    public const string Employee = "Employee";
    public const string Customer = "Customer";

    public const string AdminOrEmployee = Admin + "," + Employee;

    public static readonly string[] All = [Admin, Employee, Customer];

    public static bool IsValid(string? role) =>
        role is not null && All.Contains(role, StringComparer.OrdinalIgnoreCase);
}

public static class ClaimsPrincipalExtensions
{
    public static int UserId(this ClaimsPrincipal user)
    {
        var raw = user.FindFirstValue(ClaimTypes.NameIdentifier)
               ?? user.FindFirstValue("sub");

        return int.TryParse(raw, out var id) ? id : 0;
    }

    public static string? Email(this ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.Email);

    public static string? FullName(this ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.Name);

    public static string? Role(this ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.Role);

    public static bool IsAdmin(this ClaimsPrincipal user) =>
        string.Equals(user.Role(), AppRoles.Admin, StringComparison.OrdinalIgnoreCase);

    public static bool IsEmployee(this ClaimsPrincipal user) =>
        string.Equals(user.Role(), AppRoles.Employee, StringComparison.OrdinalIgnoreCase);
}
