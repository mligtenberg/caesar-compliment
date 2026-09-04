internal static class AdminSendEndpoints
{
    public static void MapAdminSendEndpoints(this IEndpointRouteBuilder app)
    {
        var adminSend = app.MapGroup("/admin/send").AddEndpointFilter(AdminAuthorization.RequireAdmin);

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
    }
}
