using System.Security.Claims;

internal static class SuggestionsEndpoints
{
    public static void MapSuggestionsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/suggestions", async (
            string? term,
            ClaimsPrincipal user,
            IRecipientsRepository recipients,
            IComplimentsRepository compliments) =>
        {
            var complimented = await compliments.GetComplimentedRecipientIdsAsync();
            return Results.Ok(recipients.Search(term, user.Identity?.Name, complimented));
        })
        .WithName("GetSuggestions");

        app.MapGet("/suggestions/avatar/{id}", async (string id, IRecipientsRepository recipients, IAvatarService avatars, ILogger<Program> logger) =>
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
    }
}
