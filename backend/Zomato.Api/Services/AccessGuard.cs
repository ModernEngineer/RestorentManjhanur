using System.Security.Claims;

namespace Zomato.Api.Services;

public enum ManagePermission { Menu, Order, Booking }

public sealed record AccessCheck(bool Allowed, string? Reason)
{
    public static readonly AccessCheck Yes = new(true, null);
    public static AccessCheck No(string reason) => new(false, reason);
}

/// <summary>
/// Employee sirf apne assigned restaurants par kaam kar sakta hai, aur wahan
/// bhi sirf un permissions ke saath jo admin ne di hain. Admin ko sab allowed.
/// </summary>
public sealed class AccessGuard(Db db)
{
    /// <summary>Kya ye user is restaurant par ye kaam kar sakta hai?</summary>
    public async Task<AccessCheck> CanManageAsync(
        ClaimsPrincipal user,
        int restaurantId,
        ManagePermission permission,
        CancellationToken ct = default)
    {
        if (user.IsAdmin()) return AccessCheck.Yes;

        if (!user.IsEmployee())
            return AccessCheck.No("Ye action sirf admin ya employee kar sakta hai.");

        var assignments = await GetAssignmentsAsync(user.UserId(), ct);
        var assignment = assignments.FirstOrDefault(a => a.Int("restaurantId") == restaurantId);

        if (assignment is null)
            return AccessCheck.No("Ye restaurant aapko assign nahi hai.");

        var hasPermission = permission switch
        {
            ManagePermission.Menu => assignment.Bool("canManageMenu"),
            ManagePermission.Order => assignment.Bool("canManageOrder"),
            ManagePermission.Booking => assignment.Bool("canManageBooking"),
            _ => false
        };

        return hasPermission
            ? AccessCheck.Yes
            : AccessCheck.No($"Aapke paas is restaurant par {permission} manage karne ki permission nahi hai.");
    }

    /// <summary>
    /// Employee ke liye restaurant-scope nikalta hai. Admin ke liye null
    /// (matlab koi restriction nahi).
    /// </summary>
    public async Task<int[]?> AllowedRestaurantIdsAsync(ClaimsPrincipal user, CancellationToken ct = default)
    {
        if (user.IsAdmin()) return null;

        var assignments = await GetAssignmentsAsync(user.UserId(), ct);
        return assignments.Select(a => a.Int("restaurantId")).ToArray();
    }

    public Task<List<Row>> GetAssignmentsAsync(int userId, CancellationToken ct = default) =>
        db.QueryAsync("dbo.usp_Employee_GetAssignments", new SpParams().Add("@UserId", userId), ct);
}
