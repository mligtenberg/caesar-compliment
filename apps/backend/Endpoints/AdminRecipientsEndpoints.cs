internal static class AdminRecipientsEndpoints
{
    public static void MapAdminRecipientsEndpoints(this IEndpointRouteBuilder app)
    {
        var adminRecipients = app.MapGroup("/admin/recipients").AddEndpointFilter(AdminAuthorization.RequireAdmin);

        adminRecipients.MapGet("/count", (IRecipientsRepository recipients) =>
            Results.Ok(new RecipientsCount(recipients.Count())))
        .WithName("GetRecipientsCount");
    }
}

record RecipientsCount(int Count);
