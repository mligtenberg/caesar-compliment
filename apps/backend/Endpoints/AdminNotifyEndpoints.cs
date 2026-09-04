internal static class AdminNotifyEndpoints
{
    public static void MapAdminNotifyEndpoints(this IEndpointRouteBuilder app)
    {
        var adminNotify = app.MapGroup("/admin/notify").AddEndpointFilter(AdminAuthorization.RequireAdmin);

        adminNotify.MapPost("/", async (
            IAppStateRepository appState,
            IComplimentsRepository compliments,
            IRecipientsRepository recipients,
            IMailService mail,
            ReceivedComplimentMail template,
            ILogger<Program> logger) =>
        {
            // The mail tells people their compliment is waiting for them, so it only makes
            // sense once the app itself is handing compliments out.
            if (await appState.GetStateAsync() != "Receive")
            {
                return Results.BadRequest("Mails can only be sent while the app state is Receive.");
            }

            var recipientIds = await compliments.GetComplimentedRecipientIdsAsync();

            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            var sent = 0;
            var withoutAddress = 0;
            var failed = 0;

            foreach (var recipientId in recipientIds)
            {
                var address = recipients.GetEmailById(recipientId);
                if (string.IsNullOrWhiteSpace(address))
                {
                    withoutAddress++;
                    logger.LogWarning("No mail address known for recipient {RecipientId}, skipping.", recipientId);
                    continue;
                }

                var firstName = recipients.GetFirstNameById(recipientId) ?? "collega";

                try
                {
                    await mail.SendAsync(address, ReceivedComplimentMail.Subject, template.BuildBody(firstName), template.InlineImages());
                    sent++;
                }
                catch (Exception ex) when (ex is GraphUnavailableException or InvalidOperationException)
                {
                    failed++;
                    logger.LogError(ex, "Failed to mail recipient {RecipientId}.", recipientId);
                }
            }

            stopwatch.Stop();
            logger.LogInformation(
                "Mailed {Sent} compliment mails ({Failed} failed) in {Seconds:0.0}s.",
                sent, failed, stopwatch.Elapsed.TotalSeconds);

            return Results.Ok(new NotifyResult(sent, withoutAddress, failed, Math.Round(stopwatch.Elapsed.TotalSeconds, 1)));
        })
        .WithName("NotifyRecipients");
    }
}

record NotifyResult(int Sent, int WithoutAddress, int Failed, double Seconds);
