namespace Zomato.Api.Services;

/// <summary>BCrypt based password hashing (work factor 12).</summary>
public sealed class PasswordService
{
    private const int WorkFactor = 12;

    public string Hash(string plainPassword) =>
        BCrypt.Net.BCrypt.HashPassword(plainPassword, WorkFactor);

    public bool Verify(string plainPassword, string storedHash)
    {
        if (string.IsNullOrWhiteSpace(storedHash)) return false;

        try
        {
            return BCrypt.Net.BCrypt.Verify(plainPassword, storedHash);
        }
        catch (BCrypt.Net.SaltParseException)
        {
            // DB me invalid/placeholder hash pada hai
            return false;
        }
    }

    /// <summary>Basic strength check - register/change-password me use hota hai.</summary>
    public static (bool Ok, string? Error) Validate(string? password)
    {
        if (string.IsNullOrWhiteSpace(password))
            return (false, "Password zaroori hai.");
        if (password.Length < 8)
            return (false, "Password kam se kam 8 characters ka hona chahiye.");
        if (!password.Any(char.IsLetter))
            return (false, "Password me kam se kam ek letter hona chahiye.");
        if (!password.Any(char.IsDigit))
            return (false, "Password me kam se kam ek number hona chahiye.");

        return (true, null);
    }
}
