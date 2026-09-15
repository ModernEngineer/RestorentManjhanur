/*
 * HashGen - seed data ke liye BCrypt password hash banata hai.
 *
 * Usage:
 *   dotnet run --project backend/Tools/HashGen -- "Pass@123"
 *   dotnet run --project backend/Tools/HashGen -- "Pass@123" --verify "$2a$12$..."
 *
 * Output hash ko database/09_SeedData.sql me @Pwd ki value ki jagah paste karo.
 */

const int WorkFactor = 12;

var password = args.Length > 0 ? args[0] : "Pass@123";

if (args.Length >= 3 && args[1] is "--verify" or "-v")
{
    var ok = BCrypt.Net.BCrypt.Verify(password, args[2]);
    Console.WriteLine(ok ? "VERIFIED: hash is sahi" : "FAILED: hash match nahi hua");
    return ok ? 0 : 1;
}

var hash = BCrypt.Net.BCrypt.HashPassword(password, WorkFactor);

// Self-check: jo hash banaya, wo verify bhi hona chahiye
var selfCheck = BCrypt.Net.BCrypt.Verify(password, hash);

Console.WriteLine($"Password   : {password}");
Console.WriteLine($"WorkFactor : {WorkFactor}");
Console.WriteLine($"Hash       : {hash}");
Console.WriteLine($"SelfVerify : {(selfCheck ? "OK" : "FAILED")}");

return selfCheck ? 0 : 1;
