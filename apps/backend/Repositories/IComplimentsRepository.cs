internal interface IComplimentsRepository
{
    Task InitializeAsync();

    Task<ComplimentRequest?> GetBySenderIdAsync(string senderId);

    Task<IReadOnlySet<string>> GetComplimentedRecipientIdsAsync();

    Task<IReadOnlyList<Compliment>> GetAllAsync();

    Task<IReadOnlyList<Compliment>> GetReceivedByRecipientIdAsync(string recipientId);

    Task UpsertAsync(string senderId, string senderName, ComplimentRequest compliment);

    Task HideAsync(string senderId);

    Task DeleteAsync(string senderId);
}

record Compliment(string SenderId, string SenderName, string RecipientId, string RecipientName, string CardName, string Text, bool HideFromDashboard);
