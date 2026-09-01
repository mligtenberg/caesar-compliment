internal interface IRecipientsRepository
{
    Task InitializeAsync();

    IReadOnlyList<Recipient> Search(string? term, string? viewerEmail, IReadOnlySet<string> excludedRecipientIds);

    IReadOnlyList<Recipient> SearchForAdmin(string? term, IReadOnlySet<string> excludedRecipientIds);

    string? GetUpnById(string id);

    string? GetFirstNameById(string id);
}
