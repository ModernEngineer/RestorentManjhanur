<#
    run_database.ps1
    ----------------
    Saari SQL files sahi order me chalata hai.

    WARNING: 01_Schema.sql saari tables DROP karke dobara banata hai.
             Existing data chala jayega. Sirf fresh setup / reset ke liye.

    Usage:
        # default instance dhoondh kar chalao
        .\run_database.ps1

        # apna server explicitly do
        .\run_database.ps1 -Server "localhost\SQLEXPRESS"

        # SQL authentication
        .\run_database.ps1 -Server "localhost" -SqlUser "sa" -SqlPassword "yourPassword"

        # sirf stored procedures refresh karo (schema/data chhod do)
        .\run_database.ps1 -SkipSchema -SkipSeed
#>

[CmdletBinding()]
param(
    [string] $Server,
    [string] $SqlUser,
    [string] $SqlPassword,
    [switch] $SkipSchema,
    [switch] $SkipSeed
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# ---------------------------------------------------------------- server
if (-not $Server) {
    Write-Host "Server nahi diya - local instances dhoondh raha hoon..." -ForegroundColor DarkGray

    $candidates = @('localhost')
    Get-Service -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like 'MSSQL$*' -and $_.Status -eq 'Running' } |
        ForEach-Object { $candidates += "localhost\" + $_.Name.Split('$')[1] }

    foreach ($c in $candidates) {
        & sqlcmd -S $c -E -C -l 5 -Q "SELECT 1" *> $null
        if ($LASTEXITCODE -eq 0) { $Server = $c; break }
    }

    if (-not $Server) {
        throw "Koi SQL Server instance reachable nahi mila. -Server parameter se naam do."
    }
}

Write-Host "Server : $Server" -ForegroundColor Cyan

# --------------------------------------------------------------- auth args
$authArgs = if ($SqlUser) { @('-U', $SqlUser, '-P', $SqlPassword) } else { @('-E') }

# ----------------------------------------------------------------- files
$files = @(
    '01_Schema.sql',
    '02_Functions.sql',
    '03_SP_Auth.sql',
    '04_SP_Restaurants.sql',
    '05_SP_Menu.sql',
    '06_SP_Orders.sql',
    '07_SP_Bookings.sql',
    '08_SP_Admin.sql',
    '09_SeedData.sql'
)

if ($SkipSchema) { $files = $files | Where-Object { $_ -ne '01_Schema.sql' } }
if ($SkipSeed)   { $files = $files | Where-Object { $_ -ne '09_SeedData.sql' } }

if (-not $SkipSchema) {
    Write-Host ""
    Write-Host "WARNING: 01_Schema.sql saari tables drop karega - existing data mit jayega." -ForegroundColor Yellow
    $confirm = Read-Host "Continue? (y/N)"
    if ($confirm -ne 'y' -and $confirm -ne 'Y') {
        Write-Host "Cancelled." -ForegroundColor Yellow
        exit 1
    }
}

# ------------------------------------------------------------------- run
$failed = @()

foreach ($f in $files) {
    $path = Join-Path $scriptDir $f
    if (-not (Test-Path $path)) {
        Write-Host "  SKIP  $f (file nahi mili)" -ForegroundColor DarkYellow
        continue
    }

    Write-Host ("  RUN   " + $f.PadRight(26)) -NoNewline

    $output = & sqlcmd -S $Server @authArgs -C -b -f 65001 -i $path 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK" -ForegroundColor Green
    }
    else {
        Write-Host "FAILED" -ForegroundColor Red
        $failed += $f
        $output | Select-String -Pattern 'Msg |Level ' | Select-Object -First 5 |
            ForEach-Object { Write-Host "        $_" -ForegroundColor Red }
    }
}

# ---------------------------------------------------------------- summary
Write-Host ""

if ($failed.Count -gt 0) {
    Write-Host "Ye files fail hui: $($failed -join ', ')" -ForegroundColor Red
    exit 1
}

$summary = & sqlcmd -S $Server @authArgs -C -d ZomatoCloneDb -h -1 -W -Q @"
SET NOCOUNT ON;
SELECT 'Tables     : ' + CAST(COUNT(*) AS varchar(10)) FROM sys.tables;
SELECT 'Procedures : ' + CAST(COUNT(*) AS varchar(10)) FROM sys.procedures;
SELECT 'Functions  : ' + CAST(COUNT(*) AS varchar(10)) FROM sys.objects WHERE type IN ('FN','IF','TF');
SELECT 'Restaurants: ' + CAST(COUNT(*) AS varchar(10)) FROM dbo.Restaurants;
SELECT 'Food items : ' + CAST(COUNT(*) AS varchar(10)) FROM dbo.FoodItems;
SELECT 'Users      : ' + CAST(COUNT(*) AS varchar(10)) FROM dbo.Users;
"@ 2>&1

Write-Host "Database ready:" -ForegroundColor Green
$summary | Where-Object { $_ -match ':' } | ForEach-Object { Write-Host "  $_" }

Write-Host ""
Write-Host "Login (password: Pass@123)" -ForegroundColor Cyan
Write-Host "  Admin    : admin@foodmitra.in"
Write-Host "  Employee : rahul.emp@foodmitra.in"
Write-Host "  Customer : ananya@example.com"
Write-Host ""
Write-Host "Connection string ke liye backend/Zomato.Api/appsettings.json me Server=$Server rakho." -ForegroundColor DarkGray
