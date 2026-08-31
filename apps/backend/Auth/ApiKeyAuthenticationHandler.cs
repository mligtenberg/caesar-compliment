using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

internal static class ApiKeyAuthenticationDefaults
{
    public const string AuthenticationScheme = "ApiKey";
}

internal class ApiKeyAuthenticationSchemeOptions : AuthenticationSchemeOptions;

// Server-to-server callers (e.g. the dashboard) don't sign in via Entra ID - they
// authenticate with a static key shared out of band instead.
internal class ApiKeyAuthenticationHandler(
    IOptionsMonitor<ApiKeyAuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IConfiguration configuration)
    : AuthenticationHandler<ApiKeyAuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string HeaderName = "X-Api-Key";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(HeaderName, out var providedKey))
        {
            return Task.FromResult(AuthenticateResult.Fail($"Missing {HeaderName} header."));
        }

        var configuredKey = configuration["ApiKey"];
        if (string.IsNullOrEmpty(configuredKey) || providedKey != configuredKey)
        {
            return Task.FromResult(AuthenticateResult.Fail("Invalid API key."));
        }

        var identity = new ClaimsIdentity(Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}