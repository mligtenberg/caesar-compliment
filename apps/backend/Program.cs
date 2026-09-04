using Azure.Core;
using Azure.Data.Tables;
using Azure.Identity;
using Azure.Monitor.OpenTelemetry.AspNetCore;
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

// Local dev has no Application Insights resource (and no connection string set for
// one), so only wire it up when deployed. When enabled, this instruments ASP.NET Core
// requests, outgoing HttpClient calls (Graph), Azure SDK calls (Table/Blob storage)
// and ILogger logs automatically - no manual tracing/logging calls needed elsewhere.
var appInsightsConnectionString = builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"];
if (!string.IsNullOrEmpty(appInsightsConnectionString))
{
    builder.Services.AddOpenTelemetry().UseAzureMonitor(options =>
    {
        options.ConnectionString = appInsightsConnectionString;
    });
}

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
        Console.WriteLine($"Token: {token.Token}");
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
builder.Services.AddHttpClient<IMailService, GraphMailService>(client =>
{
    client.BaseAddress = new Uri("https://graph.microsoft.com/v1.0/");
});

builder.Services.AddSingleton<IComplimentsRepository, ComplimentsRepository>();
builder.Services.AddSingleton<IRecipientsRepository, RecipientsRepository>();
builder.Services.AddSingleton<IRolesRepository, RolesRepository>();
builder.Services.AddSingleton<IAppStateRepository, AppStateRepository>();
builder.Services.AddSingleton<ReceivedComplimentMail>();

var app = builder.Build();

await app.Services.GetRequiredService<IComplimentsRepository>().InitializeAsync();
await app.Services.GetRequiredService<IRecipientsRepository>().InitializeAsync();
await app.Services.GetRequiredService<IRolesRepository>().InitializeAsync();
await app.Services.GetRequiredService<IAppStateRepository>().InitializeAsync();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

// Area 1: pages the signed-in user interacts with directly, secured by their Entra ID token.
var userPages = app.MapGroup("/").RequireAuthorization();

userPages.MapSuggestionsEndpoints();
userPages.MapComplimentsEndpoints();
userPages.MapRolesEndpoints();
userPages.MapAppStateEndpoints();
userPages.MapAdminComplimentsEndpoints();
userPages.MapAdminSendEndpoints();
userPages.MapAdminNotifyEndpoints();

// Area 2: server-to-server access (e.g. the dashboard), secured by a shared API key
// instead of a user sign-in.
var external = app.MapGroup("/external").RequireAuthorization(ApiKeyAuthenticationDefaults.AuthenticationScheme);

external.MapExternalEndpoints();

app.Run();
