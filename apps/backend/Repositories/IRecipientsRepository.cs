internal interface IRecipientsRepository
{
    Task InitializeAsync();

    IReadOnlyList<Recipient> Search(string? term, string? viewerEmail, IReadOnlySet<string> complimentedRecipientIds);

    IReadOnlyList<Recipient> SearchForAdmin(string? term, IReadOnlySet<string> excludedRecipientIds);

    IReadOnlyList<RecipientExportRow> GetAllExcept(IReadOnlySet<string> excludedRecipientIds);

    string? GetUpnById(string id);

    string? GetFirstNameById(string id);

    string? GetEmailById(string id);

    string? GetIdByViewerEmail(string? viewerEmail);

    int Count();
}

record RecipientExportRow(string Name, string Email, string Company, string Team, string KlantTeam);

record Recipient(string Id, string Name, string JobTitle, string? AvatarUrl, bool HasCompliment = false);
