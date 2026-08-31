using System.Security.Claims;
using Azure.Data.Tables;
using Azure.Identity;
using Azure.Storage.Blobs;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Identity.Web;


var builder = WebApplication.CreateBuilder(args);

// Local dev shares Entra IDs and URLs with the frontend via one file instead of
// keeping them in sync by hand across appsettings.Development.json and
// environment.development.ts. Deployed environments get AzureAd/Frontend
// config from real app settings (which take precedence over appsettings.json but
// were already loaded above, so we only fold this in for Development).
if (builder.Environment.IsDevelopment())
{
    var sharedConfigPath = Path.Combine(builder.Environment.ContentRootPath, "..", "..", "config", "local.json");
    builder.Configuration.AddJsonFile(sharedConfigPath, optional: true, reloadOnChange: false);
}


// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// AddMicrosoftIdentityWebApi needs "Instance" alongside TenantId/ClientId, but
// Instance lives under AzureAd (it's a fixed endpoint, not per-app-registration,
// so it isn't duplicated into the "backend" section of config/local.json).
builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
{
    ["backend:Instance"] = builder.Configuration["AzureAd:Instance"],
});

var authenticationBuilder = builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme);
authenticationBuilder.AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("backend"));
authenticationBuilder.AddScheme<ApiKeyAuthenticationSchemeOptions, ApiKeyAuthenticationHandler>(
    ApiKeyAuthenticationDefaults.AuthenticationScheme, _ => { });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(ApiKeyAuthenticationDefaults.AuthenticationScheme, policy =>
        policy
            .AddAuthenticationSchemes(ApiKeyAuthenticationDefaults.AuthenticationScheme)
            .RequireAuthenticatedUser());
});

var frontendOrigin = builder.Configuration["Frontend:Origin"] ?? "http://localhost:4200";
var dashboardOrigin = builder.Configuration["Dashboard:Origin"] ?? "http://localhost:4201";
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(frontendOrigin, dashboardOrigin).AllowAnyHeader().AllowAnyMethod());
});

builder.Services.AddSingleton(_ =>
{
    // Local debugging targets Azurite via a connection string (see docker-compose.yml).
    // Deployed environments have no storage key/connection string at all - they
    // authenticate with the backend's own system-assigned managed identity.
    var connectionString = builder.Configuration["Storage:ConnectionString"];
    if (!string.IsNullOrEmpty(connectionString))
    {
        return new TableServiceClient(connectionString);
    }

    var accountName = builder.Configuration["Storage:AccountName"];
    var credential = new ManagedIdentityCredential(ManagedIdentityId.SystemAssigned);

    return new TableServiceClient(new Uri($"https://{accountName}.table.core.windows.net"), credential);
});

builder.Services.AddSingleton(_ =>
{
    var connectionString = builder.Configuration["Storage:ConnectionString"];
    if (!string.IsNullOrEmpty(connectionString))
    {
        return new BlobServiceClient(connectionString);
    }

    var accountName = builder.Configuration["Storage:AccountName"];
    var credential = new ManagedIdentityCredential(ManagedIdentityId.SystemAssigned);

    return new BlobServiceClient(new Uri($"https://{accountName}.blob.core.windows.net"), credential);
});

builder.Services.AddSingleton<IComplimentsRepository, ComplimentsRepository>();
builder.Services.AddSingleton<IRecipientsRepository, RecipientsRepository>();

var app = builder.Build();

await app.Services.GetRequiredService<IComplimentsRepository>().InitializeAsync();
await app.Services.GetRequiredService<IRecipientsRepository>().InitializeAsync();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

// Area 1: pages the signed-in user interacts with directly, secured by their Entra ID token.
var userPages = app.MapGroup("/").RequireAuthorization();

userPages.MapGet("/suggestions", async (
    string? term,
    ClaimsPrincipal user,
    IRecipientsRepository recipients,
    IComplimentsRepository compliments) =>
{
    var complimented = await compliments.GetComplimentedRecipientIdsAsync();
    return Results.Ok(recipients.Search(term, user.Identity?.Name, complimented));
})
.WithName("GetSuggestions");

userPages.MapPost("/compliments", async (ComplimentRequest compliment, ClaimsPrincipal user, IComplimentsRepository compliments) =>
{
    await compliments.UpsertAsync(user.GetObjectId(), compliment);

    return Results.NoContent();
})
.WithName("PostCompliment");

userPages.MapGet("/compliments/mine", async (ClaimsPrincipal user, IComplimentsRepository compliments) =>
{
    var compliment = await compliments.GetBySenderIdAsync(user.GetObjectId());

    return compliment is null ? Results.NotFound() : Results.Ok(compliment);
})
.WithName("GetMyCompliment");

// Area 2: server-to-server access (e.g. the dashboard), secured by a shared API key
// instead of a user sign-in.
var external = app.MapGroup("/external").RequireAuthorization(ApiKeyAuthenticationDefaults.AuthenticationScheme);

external.MapGet("/compliments", async (IComplimentsRepository compliments) =>
    Results.Ok(await compliments.GetAllAsync()))
.WithName("GetAll");

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}

record Recipient(string Id, string Name, string JobTitle);

record ComplimentRequest(string RecipientId, string RecipientName, string CardName, string Text);
