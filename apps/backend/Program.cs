using System.Security.Claims;
using Azure.Core;
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

builder.Services.AddMemoryCache();

builder.Services.AddSingleton<TokenCredential>(_ =>
{
    // Local dev authenticates Graph with an app registration's client secret (set via
    // `dotnet user-secrets`, never committed). Deployed environments have no secret at
    // all: this app registration trusts the web app's own system-assigned managed
    // identity as a federated credential (configured out of band via Azure CLI, since
    // the app registration and the managed identity live in different tenants - see
    // infra/README.md), so the managed identity's own token is used as the client
    // assertion to obtain tokens for this app registration instead.
    var tenantId = builder.Configuration["backend:tenantId"];
    var clientId = builder.Configuration["backend:clientId"];
    var clientSecret = builder.Configuration["backend:clientSecret"];
    if (!string.IsNullOrEmpty(clientSecret))
    {
        return new ClientSecretCredential(tenantId, clientId, clientSecret);
    }

    var managedIdentity = new ManagedIdentityCredential(ManagedIdentityId.SystemAssigned);
    return new ClientAssertionCredential(tenantId, clientId, async (ct) =>
    {
        var token = await managedIdentity.GetTokenAsync(
            new TokenRequestContext(["api://AzureADTokenExchange/.default"]), ct);
        return token.Token;
    });
});
builder.Services.AddHttpClient<IAvatarService, EntraAvatarService>(client =>
{
    client.BaseAddress = new Uri("https://graph.microsoft.com/v1.0/");
});
builder.Services.AddHttpClient<IUserLookupService, EntraUserLookupService>(client =>
{
    client.BaseAddress = new Uri("https://graph.microsoft.com/v1.0/");
});

builder.Services.AddSingleton<IComplimentsRepository, ComplimentsRepository>();
builder.Services.AddSingleton<IRecipientsRepository, RecipientsRepository>();
builder.Services.AddSingleton<IRolesRepository, RolesRepository>();

var app = builder.Build();

await app.Services.GetRequiredService<IComplimentsRepository>().InitializeAsync();
await app.Services.GetRequiredService<IRecipientsRepository>().InitializeAsync();
await app.Services.GetRequiredService<IRolesRepository>().InitializeAsync();

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

userPages.MapGet("/suggestions/avatar/{id}", async (string id, IRecipientsRepository recipients, IAvatarService avatars, ILogger<Program> logger) =>
{
    var upn = recipients.GetUpnById(id);
    if (upn is null) return Results.NotFound();

    try
    {
        var photo = await avatars.GetAvatarAsync(upn);
        return photo is null ? Results.NotFound() : Results.Bytes(photo.Value.Bytes, photo.Value.ContentType);
    }
    catch (GraphUnavailableException ex)
    {
        logger.LogError(ex, "Failed to fetch avatar for recipient {RecipientId} from Microsoft Graph.", id);
        return Results.StatusCode(StatusCodes.Status502BadGateway);
    }
})
.WithName("GetRecipientAvatar");

userPages.MapPost("/compliments", async (ComplimentRequest compliment, ClaimsPrincipal user, IComplimentsRepository compliments) =>
{
    await compliments.UpsertAsync(user.GetObjectId(), user.GetDisplayName(), compliment);

    return Results.NoContent();
})
.WithName("PostCompliment");

userPages.MapGet("/compliments/mine", async (ClaimsPrincipal user, IComplimentsRepository compliments) =>
{
    var compliment = await compliments.GetBySenderIdAsync(user.GetObjectId());

    return compliment is null ? Results.NotFound() : Results.Ok(compliment);
})
.WithName("GetMyCompliment");

userPages.MapGet("/myrole", async (ClaimsPrincipal user, IRolesRepository roles) =>
{
    var role = await roles.GetRoleAsync(user.GetObjectId());

    return Results.Ok(role ?? "user");
})
.WithName("GetMyRole");

// Only admins may manage role assignments - callers must already have an "admin" row
// in the Roles table themselves, checked on every request in these groups.
async ValueTask<object?> RequireAdmin(Microsoft.AspNetCore.Http.EndpointFilterInvocationContext context, Microsoft.AspNetCore.Http.EndpointFilterDelegate next)
{
    var user = context.HttpContext.User;
    var roles = context.HttpContext.RequestServices.GetRequiredService<IRolesRepository>();
    var role = await roles.GetRoleAsync(user.GetObjectId());

    return role == "admin" ? await next(context) : Results.Forbid();
}

var adminPages = userPages.MapGroup("/roles").AddEndpointFilter(RequireAdmin);

adminPages.MapGet("/", async (ClaimsPrincipal _, IRolesRepository roles) =>
    Results.Ok(await roles.GetAllAsync()))
.WithName("GetAllRoles");

adminPages.MapGet("/search", async (string query, IUserLookupService lookup, ILogger<Program> logger) =>
{
    if (string.IsNullOrWhiteSpace(query)) return Results.Ok(Array.Empty<GraphUser>());

    try
    {
        return Results.Ok(await lookup.SearchAsync(query));
    }
    catch (GraphUnavailableException ex)
    {
        logger.LogError(ex, "Failed to search for user {Query} in Microsoft Graph.", query);
        return Results.StatusCode(StatusCodes.Status502BadGateway);
    }
})
.WithName("SearchUsers");

adminPages.MapGet("/avatar/{objectId}", async (string objectId, IAvatarService avatars, ILogger<Program> logger) =>
{
    try
    {
        var photo = await avatars.GetAvatarAsync(objectId);
        return photo is null ? Results.NotFound() : Results.Bytes(photo.Value.Bytes, photo.Value.ContentType);
    }
    catch (GraphUnavailableException ex)
    {
        logger.LogError(ex, "Failed to fetch avatar for {ObjectId} from Microsoft Graph.", objectId);
        return Results.StatusCode(StatusCodes.Status502BadGateway);
    }
})
.WithName("GetUserAvatar");

adminPages.MapPost("/", async (ClaimsPrincipal _, RoleAssignment assignment, IRolesRepository roles) =>
{
    await roles.AssignRoleAsync(assignment.ObjectId, assignment.Role, assignment.DisplayName);

    return Results.NoContent();
})
.WithName("AssignRole");

adminPages.MapDelete("/{objectId}", async (ClaimsPrincipal user, string objectId, IRolesRepository roles) =>
{
    if (objectId == user.GetObjectId()) return Results.BadRequest("Admins cannot remove their own role assignment.");

    await roles.RemoveRoleAsync(objectId);

    return Results.NoContent();
})
.WithName("RemoveRole");

var adminCompliments = userPages.MapGroup("/admin/compliments").AddEndpointFilter(RequireAdmin);

adminCompliments.MapGet("/", async (IComplimentsRepository compliments) =>
{
    var all = await compliments.GetAllAsync();

    var result = all.Select(c => new AdminCompliment(
        c.SenderId,
        c.SenderName,
        c.RecipientId,
        c.RecipientName,
        c.Text,
        c.HideFromDashboard));

    return Results.Ok(result);
})
.WithName("GetAllCompliments");

adminCompliments.MapPost("/{senderId}/hide", async (string senderId, IComplimentsRepository compliments) =>
{
    await compliments.HideAsync(senderId);

    return Results.NoContent();
})
.WithName("HideCompliment");

adminCompliments.MapDelete("/{senderId}", async (string senderId, IComplimentsRepository compliments) =>
{
    await compliments.DeleteAsync(senderId);

    return Results.NoContent();
})
.WithName("DeleteCompliment");

var adminSend = userPages.MapGroup("/admin/send").AddEndpointFilter(RequireAdmin);

adminSend.MapGet("/recipients", async (string? term, IRecipientsRepository recipients, IComplimentsRepository compliments) =>
{
    var complimented = await compliments.GetComplimentedRecipientIdsAsync();
    return Results.Ok(recipients.SearchForAdmin(term, complimented));
})
.WithName("SearchRecipientsForAdminSend");

adminSend.MapPost("/", async (ComplimentRequest compliment, IComplimentsRepository compliments) =>
{
    // Admin-sent compliments aren't tied to a real Entra user, so RowKey (which is
    // normally the sender's own object id and enforces "one compliment per sender")
    // is instead a synthetic, always-unique id per send.
    var senderId = $"adminsend-{DateTime.UtcNow:yyyyMMddHHmmssfff}";
    await compliments.UpsertAsync(senderId, "Admin Send", compliment);

    return Results.NoContent();
})
.WithName("SendAdminCompliment");

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

record Recipient(string Id, string Name, string JobTitle, string? AvatarUrl);

record ComplimentRequest(string RecipientId, string RecipientName, string CardName, string Text, bool HideFromDashboard = false);

record AdminCompliment(string SenderId, string SenderName, string RecipientId, string RecipientName, string Text, bool HideFromDashboard);
