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
                c.HideFromDashboard,
                c.Mailed));

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

        adminCompliments.MapPost("/{senderId}/mail", async (
            string senderId,
            IAppStateRepository appState,
            IComplimentsRepository compliments,
            IRecipientsRepository recipients,
            IMailService mail,
            ReceivedComplimentMail template,
            ILogger<Program> logger) =>
        {
            // Same as the bulk notify job, mailing a single compliment only makes sense
            // once the app is actually handing compliments out.
            if (await appState.GetStateAsync() != "Receive")
            {
                return Results.BadRequest("Mails can only be sent while the app state is Receive.");
            }

            var compliment = await compliments.GetBySenderIdAsync(senderId);
            if (compliment is null) return Results.NotFound();

            if (await compliments.IsMailedAsync(senderId))
            {
                return Results.BadRequest("This compliment has already been mailed.");
            }

            var address = recipients.GetEmailById(compliment.RecipientId);
            if (string.IsNullOrWhiteSpace(address))
            {
                return Results.BadRequest("No mail address known for this recipient.");
            }

            var firstName = recipients.GetFirstNameById(compliment.RecipientId) ?? "collega";

            try
            {
                await mail.SendAsync(address, ReceivedComplimentMail.Subject, template.BuildBody(firstName), template.InlineImages());
            }
            catch (Exception ex) when (ex is GraphUnavailableException or InvalidOperationException)
            {
                logger.LogError(ex, "Failed to mail recipient {RecipientId} for compliment {SenderId}.", compliment.RecipientId, senderId);
                return Results.Problem("Failed to send mail.", statusCode: StatusCodes.Status502BadGateway);
            }

            // Marks every compliment for this recipient as mailed, not just this one - the
            // mail points at their whole received-compliments page, so one send covers all.
            await compliments.MarkMailedAsync(compliment.RecipientId);

            return Results.NoContent();
        })
        .WithName("MailCompliment");
    }
}

record AdminCompliment(string SenderId, string SenderName, string RecipientId, string RecipientName, string Text, bool HideFromDashboard, bool Mailed);
