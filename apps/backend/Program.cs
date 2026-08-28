using System;
using System.Linq;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using Azure.Core;
using Azure.Identity;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Identity.Web;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAd"));
builder.Services.AddAuthorization();

var frontendOrigin = builder.Configuration["Frontend:Origin"] ?? "http://localhost:4200";
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(frontendOrigin).AllowAnyHeader().AllowAnyMethod());
});

// Backend app registration has no client secret. Instead it trusts two federated
// credential subjects: the developer's Azure CLI login (local dev) and the backend's
// own system-assigned managed identity (deployed). Whichever is available mints the
// client assertion used to obtain app-only Graph tokens for this app registration.
builder.Services.AddSingleton<TokenCredential>(_ =>
{
    var assertionSource = new ChainedTokenCredential(
        new ManagedIdentityCredential(ManagedIdentityId.SystemAssigned),
        new AzureCliCredential());

    return new ClientAssertionCredential(
        builder.Configuration["Graph:TenantId"],
        builder.Configuration["Graph:ClientId"],
        async (ct) =>
        {
            var token = await assertionSource.GetTokenAsync(
                new TokenRequestContext(["api://AzureADTokenExchange/.default"]), ct);
            return token.Token;
        });
});

builder.Services.AddHttpClient("Graph", client =>
{
    client.BaseAddress = new Uri("https://graph.microsoft.com/v1.0/");
});

var app = builder.Build();

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

app.MapGet("/suggestions", async (
    string? term,
    IHttpClientFactory httpClientFactory,
    TokenCredential graphCredential,
    ClaimsPrincipal user) =>
{
    var accessToken = await graphCredential.GetTokenAsync(
        new TokenRequestContext(["https://graph.microsoft.com/.default"]), default);

    var client = httpClientFactory.CreateClient("Graph");
    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken.Token);
    client.DefaultRequestHeaders.Add("ConsistencyLevel", "eventual");

    var trimmed = term?.Trim() ?? "";
    // Fetch one extra so we still return up to 5 after filtering the signed-in user out.
    var url = trimmed.Length > 0
        ? $"users?$search=\"displayName:{Uri.EscapeDataString(trimmed)}\"&$select=id,displayName,department&$top=6"
        : "users?$select=id,displayName,department&$top=6&$orderby=displayName";

    var response = await client.GetAsync(url);
    if (!response.IsSuccessStatusCode) return Results.Ok(Array.Empty<Recipient>());

    var data = await response.Content.ReadFromJsonAsync<GraphUsersResponse>();
    var ownId = user.GetObjectId();

    var suggestions = (data?.Value ?? [])
        .Where(u => !string.IsNullOrEmpty(u.DisplayName) && u.Id != ownId)
        .Take(5)
        .Select(u => new Recipient(u.Id, u.DisplayName ?? "", u.Department ?? ""))
        .ToArray();

    return Results.Ok(suggestions);
})
.RequireAuthorization()
.WithName("GetSuggestions");

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}

record Recipient(string Id, string Name, string Department);

record GraphUser(string Id, string? DisplayName, string? Department);

record GraphUsersResponse(GraphUser[]? Value);
