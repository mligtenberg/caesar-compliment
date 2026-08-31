internal interface IRecipientsRepository
{
    Task InitializeAsync();

    IReadOnlyList<Recipient> Search(string? term, string? viewerEmail, IReadOnlySet<string> excludedRecipientIds);
}
