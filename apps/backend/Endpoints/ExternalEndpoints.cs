internal static class ExternalEndpoints
{
    public static void MapExternalEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/compliments", async (IComplimentsRepository compliments, IRecipientsRepository recipients) =>
        {
            var all = await compliments.GetAllAsync();

            // The dashboard reel currently only shows a first name, sourced from the
            // recipients CSV rather than the sender-supplied full name stored on the
            // compliment - falls back to splitting that name if the recipient isn't found
            // (e.g. removed since). RecipientDisplayName carries the full stored name
            // alongside it for future dashboard work that needs the whole name.
            var result = all
                .Where(c => !c.HideFromDashboard)
                .Select(c => new DashboardCompliment(
                c.SenderId,
                c.RecipientId,
                recipients.GetFirstNameById(c.RecipientId) ?? c.RecipientName.Split(' ')[0],
                c.RecipientName,
                c.CardName,
                c.Text,
                c.HideFromDashboard));

            return Results.Ok(result);
        })
        .WithName("GetAll");

        // The dashboard drives part of its UI off the app state (the QR call-to-action),
        // and can't reach the user-authenticated GET /appstate with just its API key.
        app.MapGet("/appstate", async (IAppStateRepository appState) =>
            Results.Ok(await appState.GetStateAsync()))
        .WithName("GetAppStateExternal");
    }
}

record DashboardCompliment(string SenderId, string RecipientId, string RecipientName, string RecipientDisplayName, string CardName, string Text, bool HideFromDashboard);
