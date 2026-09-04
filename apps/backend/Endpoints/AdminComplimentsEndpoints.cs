internal static class AdminComplimentsEndpoints
{
    public static void MapAdminComplimentsEndpoints(this IEndpointRouteBuilder app)
    {
        var adminCompliments = app.MapGroup("/admin/compliments").AddEndpointFilter(AdminAuthorization.RequireAdmin);

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
    }
}

record AdminCompliment(string SenderId, string SenderName, string RecipientId, string RecipientName, string Text, bool HideFromDashboard);
