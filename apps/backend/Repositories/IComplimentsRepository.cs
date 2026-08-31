internal interface IComplimentsRepository
{
    Task InitializeAsync();

    Task<ComplimentRequest?> GetBySenderIdAsync(string senderId);

    Task<IReadOnlySet<string>> GetComplimentedRecipientIdsAsync();

    Task<IReadOnlyList<Compliment>> GetAllAsync();

    Task UpsertAsync(string senderId, ComplimentRequest compliment);
}

record Compliment(string SenderId, string RecipientId, string RecipientName, string CardName, string Text);
