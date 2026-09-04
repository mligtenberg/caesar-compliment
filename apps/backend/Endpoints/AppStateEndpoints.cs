internal static class AppStateEndpoints
{
    private static readonly string[] ValidStates = ["Open", "Locked", "Receive"];

    public static void MapAppStateEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/appstate", async (IAppStateRepository appState) =>
            Results.Ok(await appState.GetStateAsync()))
        .WithName("GetAppState");

        var adminAppState = app.MapGroup("/admin/appstate").AddEndpointFilter(AdminAuthorization.RequireAdmin);

        adminAppState.MapPost("/", async (AppStateRequest request, IAppStateRepository appState) =>
        {
            if (!ValidStates.Contains(request.State)) return Results.BadRequest("Invalid app state.");

            await appState.SetStateAsync(request.State);

            return Results.NoContent();
        })
        .WithName("SetAppState");
    }
}

record AppStateRequest(string State);
