using System.Text;

internal static class AdminRecipientsEndpoints
{
    public static void MapAdminRecipientsEndpoints(this IEndpointRouteBuilder app)
    {
        var adminRecipients = app.MapGroup("/admin/recipients").AddEndpointFilter(AdminAuthorization.RequireAdmin);

        adminRecipients.MapGet("/count", (IRecipientsRepository recipients) =>
            Results.Ok(new RecipientsCount(recipients.Count())))
        .WithName("GetRecipientsCount");

        adminRecipients.MapGet("/without-compliment.csv", async (IRecipientsRepository recipients, IComplimentsRepository compliments) =>
        {
            var complimented = await compliments.GetComplimentedRecipientIdsAsync();

            var csv = new StringBuilder("naam,email,bedrijf,team,klantteam\r\n");
            foreach (var r in recipients.GetAllExcept(complimented))
            {
                csv.AppendJoin(',', new[] { r.Name, r.Email, r.Company, r.Team, r.KlantTeam }.Select(CsvEscape)).Append("\r\n");
            }

            // BOM so Excel reads names with accents as UTF-8.
            var bytes = new UTF8Encoding(true).GetPreamble().Concat(Encoding.UTF8.GetBytes(csv.ToString())).ToArray();
            return Results.File(bytes, "text/csv", "geen-compliment-ontvangen.csv");
        })
        .WithName("ExportRecipientsWithoutCompliment");
    }

    // Quote fields containing separators, and neutralise spreadsheet formulas.
    private static string CsvEscape(string value)
    {
        if (value.Length > 0 && "=+-@".Contains(value[0])) value = "'" + value;
        return value.IndexOfAny([',', '"', '\r', '\n']) >= 0 ? $"\"{value.Replace("\"", "\"\"")}\"" : value;
    }
}

record RecipientsCount(int Count);
