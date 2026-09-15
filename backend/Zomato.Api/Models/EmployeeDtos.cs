using System.ComponentModel.DataAnnotations;

namespace Zomato.Api.Models;

public sealed class EmployeeFilter
{
    public string? Search { get; set; }
    public int? RestaurantId { get; set; }
    public string? Designation { get; set; }
    public bool? IsActive { get; set; }

    /// <summary>true = jinko koi restaurant assign nahi hua</summary>
    public bool Unassigned { get; set; }

    [Range(1, int.MaxValue)] public int PageNumber { get; set; } = 1;
    [Range(1, 100)] public int PageSize { get; set; } = 20;
}

public sealed class EmployeeRequest : IValidatableObject
{
    public int UserId { get; set; }

    [Required][StringLength(120, MinimumLength = 2)] public string FullName { get; set; } = "";

    [Required][EmailAddress][StringLength(160)] public string Email { get; set; } = "";

    [Phone][StringLength(20)] public string? Phone { get; set; }

    /// <summary>Naye employee ke liye zaroori; update par khaali chhodo to password same rehta hai.</summary>
    [StringLength(100, MinimumLength = 8)]
    public string? Password { get; set; }

    [StringLength(500)] public string? ProfileImage { get; set; }
    public bool IsActive { get; set; } = true;

    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (UserId <= 0 && string.IsNullOrWhiteSpace(Password))
            yield return new ValidationResult("Naye employee ke liye password zaroori hai.", [nameof(Password)]);
    }
}

/// <summary>
/// "Kisko kaunsa restaurant dena hai" - ye request wahi karti hai.
/// </summary>
public sealed class AssignRestaurantRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "Employee select karo.")]
    public int UserId { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "Restaurant select karo.")]
    public int RestaurantId { get; set; }

    /// <summary>Manager | Supervisor | Chef | Waiter | DeliveryBoy | Banquet Manager | Menu Manager</summary>
    [Required][StringLength(80)] public string Designation { get; set; } = "Manager";

    public bool CanManageMenu { get; set; }
    public bool CanManageOrder { get; set; } = true;
    public bool CanManageBooking { get; set; }
}

public sealed class RestaurantAdminFilter
{
    public string? Search { get; set; }
    public string? City { get; set; }
    public bool? IsActive { get; set; }
    [Range(1, int.MaxValue)] public int PageNumber { get; set; } = 1;
    [Range(1, 100)] public int PageSize { get; set; } = 20;
}

public sealed class SettingRequest
{
    [Required][StringLength(80)] public string SettingKey { get; set; } = "";
    [Required][StringLength(500)] public string SettingValue { get; set; } = "";
    [StringLength(300)] public string? Description { get; set; }
}

public sealed class ToggleRequest
{
    public bool IsActive { get; set; }
}
