using System.Security.Claims;
using Microsoft.Identity.Web;

internal static class ComplimentsEndpoints
{
    public static void MapComplimentsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/compliments", async (ComplimentRequest compliment, ClaimsPrincipal user, IComplimentsRepository compliments, IAppStateRepository appState) =>
        {
            if (await appState.GetStateAsync() != "Open") return Results.StatusCode(StatusCodes.Status423Locked);

            await compliments.UpsertAsync(user.GetObjectId(), user.GetDisplayName(), compliment);

            return Results.NoContent();
        })
        .WithName("PostCompliment");

        app.MapGet("/compliments/mine", async (ClaimsPrincipal user, IComplimentsRepository compliments) =>
        {
            var compliment = await compliments.GetBySenderIdAsync(user.GetObjectId());

            return compliment is null ? Results.NotFound() : Results.Ok(compliment);
        })
        .WithName("GetMyCompliment");

        app.MapGet("/compliments/received", async (
            ClaimsPrincipal user,
            IComplimentsRepository compliments,
            IRecipientsRepository recipients,
            IAppStateRepository appState) =>
        {
            if (await appState.GetStateAsync() != "Receive") return Results.StatusCode(StatusCodes.Status423Locked);

            var recipientId = recipients.GetIdByViewerEmail(user.Identity?.Name);
            if (recipientId is null) return Results.Ok(Array.Empty<ReceivedCompliment>());

            var received = await compliments.GetReceivedByRecipientIdAsync(recipientId);

            return Results.Ok(received.Select(c => new ReceivedCompliment(c.SenderName, c.RecipientName, c.CardName, c.Text)));
        })
        .WithName("GetReceivedCompliments");
    }
}

record ComplimentRequest(string RecipientId, string RecipientName, string CardName, string Text, bool HideFromDashboard = false);

record ReceivedCompliment(string SenderName, string RecipientName, string CardName, string Text);
