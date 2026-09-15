using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);

/* ======================== Configuration binding ======================== */

builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<PaymentSettings>(builder.Configuration.GetSection("Payment"));

var jwtSettings = builder.Configuration.GetSection("Jwt").Get<JwtSettings>() ?? new JwtSettings();

if (string.IsNullOrWhiteSpace(jwtSettings.Key) || Encoding.UTF8.GetByteCount(jwtSettings.Key) < 32)
{
    throw new InvalidOperationException(
        "Jwt:Key missing ya bahut chhoti hai. appsettings.json me kam se kam 32 bytes " +
        "(32+ characters) ki secret key set karo. Production me User Secrets / " +
        "environment variable use karo, file me plain key na rakho.");
}

/* ============================== Services =============================== */

builder.Services.AddSingleton<Db>();
builder.Services.AddSingleton<JwtService>();
builder.Services.AddSingleton<PasswordService>();
builder.Services.AddSingleton<FileStorageService>();
builder.Services.AddScoped<AccessGuard>();

/* ---- Payment gateway: appsettings ke Payment:Provider se decide hota hai ---- */
var paymentSettings = builder.Configuration.GetSection("Payment").Get<PaymentSettings>()
                      ?? new PaymentSettings();

if (paymentSettings.Provider.Equals("RAZORPAY", StringComparison.OrdinalIgnoreCase))
{
    if (string.IsNullOrWhiteSpace(paymentSettings.KeyId) ||
        string.IsNullOrWhiteSpace(paymentSettings.KeySecret))
    {
        throw new InvalidOperationException(
            "Payment:Provider = RAZORPAY hai par keys missing hain.\n" +
            "Key id appsettings.json me daalo aur secret User Secrets me:\n" +
            "  dotnet user-secrets set \"Payment:KeySecret\" \"<your_key_secret>\"");
    }

    builder.Services.AddRazorpayHttpClient(paymentSettings);
    builder.Services.AddSingleton<IPaymentGateway, RazorpayGateway>();
}
else
{
    builder.Services.AddSingleton<IPaymentGateway, MockPaymentGateway>();
}

builder.Services
    .AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        o.JsonSerializerOptions.NumberHandling = JsonNumberHandling.AllowReadingFromString;
    });

/* ---- Model validation errors bhi same ApiResponse shape me bhejo ---- */
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var errors = context.ModelState
            .Where(kv => kv.Value?.Errors.Count > 0)
            .SelectMany(kv => kv.Value!.Errors.Select(e =>
                string.IsNullOrWhiteSpace(e.ErrorMessage)
                    ? $"{kv.Key}: invalid value"
                    : e.ErrorMessage))
            .Distinct()
            .ToList();

        return new BadRequestObjectResult(
            ApiResponse<object?>.Fail("Input me kuch galat hai.", errors));
    };
});

/* ------------------------------- CORS -------------------------------- */
const string CorsPolicy = "FrontendPolicy";

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? ["http://localhost:5173", "http://localhost:4173"];

builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicy, policy => policy
        .WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

/* ----------------------------- JWT auth ------------------------------ */
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
        options.SaveToken = true;

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidAudience = jwtSettings.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.Key)),
            ClockSkew = TimeSpan.FromSeconds(30)
        };

        // 401 / 403 bhi ApiResponse shape me
        options.Events = new JwtBearerEvents
        {
            OnChallenge = async context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/json";

                await context.Response.WriteAsJsonAsync(
                    ApiResponse.Fail("Login zaroori hai (ya token expire ho gaya)."));
            },
            OnForbidden = async context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                context.Response.ContentType = "application/json";

                await context.Response.WriteAsJsonAsync(
                    ApiResponse.Fail("Is action ki permission aapke paas nahi hai."));
            }
        };
    });

builder.Services.AddAuthorization();

/* ------------------------------ Swagger ------------------------------ */
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "FoodMitra API",
        Version = "v1",
        Description =
            "Zomato-style food delivery API. ADO.NET + SQL Server stored procedures, " +
            "JWT auth (Admin / Employee / Customer), 15 km delivery radius, " +
            "orders, coupons, table booking, hall booking aur payments."
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Sirf token paste karo (\"Bearer \" likhne ki zaroorat nahi)."
    });

    options.AddSecurityRequirement(_ => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("Bearer")] = new List<string>()
    });
});

/* -------------------- Global exception handler ----------------------- */
builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var feature = context.Features.Get<IExceptionHandlerFeature>();
        var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();

        logger.LogError(feature?.Error, "Unhandled exception on {Method} {Path}",
            context.Request.Method, context.Request.Path);

        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";

        // Development me asli error message dikhao, production me generic
        var message = app.Environment.IsDevelopment() && feature?.Error is not null
            ? feature.Error.Message
            : "Server par kuch galat ho gaya. Thodi der me try karo.";

        await context.Response.WriteAsJsonAsync(ApiResponse.Fail(message));
    });
});

/* ------------------------------ Pipeline ----------------------------- */

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(o =>
    {
        o.SwaggerEndpoint("/swagger/v1/swagger.json", "FoodMitra API v1");
        o.DocumentTitle = "FoodMitra API";
    });
}
else
{
    app.UseHttpsRedirection();
}

// wwwroot/uploads/** se images serve hoti hain
app.UseStaticFiles();

app.UseCors(CorsPolicy);

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

/* --------------------------- Health check ---------------------------- */
app.MapGet("/api/health", async (Db db, CancellationToken ct) =>
{
    try
    {
        var row = await db.QuerySingleAsync("dbo.usp_Setting_GetAll", null, ct);

        return Results.Ok(ApiResponse.Ok(new
        {
            status = "healthy",
            database = "connected",
            settingsLoaded = row is not null,
            serverTimeUtc = DateTime.UtcNow
        }));
    }
    catch (Exception ex)
    {
        return Results.Json(
            ApiResponse.Fail($"Database connect nahi ho raha: {ex.Message}"),
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }
})
.WithName("HealthCheck")
.AllowAnonymous();

app.Run();
