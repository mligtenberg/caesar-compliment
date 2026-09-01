using Azure.Data.Tables;

internal class ComplimentsRepository : IComplimentsRepository
{
    private readonly TableClient _table;

    public ComplimentsRepository(TableServiceClient tableServiceClient)
    {
        _table = tableServiceClient.GetTableClient("Compliments");
    }

    public Task InitializeAsync() => _table.CreateIfNotExistsAsync();

    public async Task<ComplimentRequest?> GetBySenderIdAsync(string senderId)
    {
        var response = await _table.GetEntityIfExistsAsync<TableEntity>(CurrentPartitionKey(), senderId);
        if (!response.HasValue) return null;

        var entity = response.Value!;
        return new ComplimentRequest(
            ReadRecipientId(entity),
            entity.GetString("RecipientName"),
            entity.GetString("CardName"),
            entity.GetString("Text"),
            entity.GetBoolean("HideFromDashboard") ?? false);
    }

    public async Task<IReadOnlySet<string>> GetComplimentedRecipientIdsAsync()
    {
        var recipientIds = new HashSet<string>();

        await foreach (var entity in _table.QueryAsync<TableEntity>(
            filter: $"PartitionKey eq '{CurrentPartitionKey()}'",
            select: ["RecipientId"]))
        {
            recipientIds.Add(ReadRecipientId(entity));
        }

        return recipientIds;
    }

    public async Task<IReadOnlyList<Compliment>> GetAllAsync()
    {
        var compliments = new List<Compliment>();

        await foreach (var entity in _table.QueryAsync<TableEntity>(
            filter: $"PartitionKey eq '{CurrentPartitionKey()}'"))
        {
            compliments.Add(new Compliment(
                entity.RowKey,
                ReadRecipientId(entity),
                entity.GetString("RecipientName"),
                entity.GetString("CardName"),
                entity.GetString("Text"),
                entity.GetBoolean("HideFromDashboard") ?? false));
        }

        return compliments;
    }

    // RecipientIds used to be Entra object GUIDs and are now numeric MijnCaesar ids, but
    // some entities written before that change may still have been stored with a
    // numeric EDM type instead of a string - read leniently instead of assuming Edm.String.
    private static string ReadRecipientId(TableEntity entity) =>
        entity["RecipientId"]?.ToString() ?? "";

    public async Task UpsertAsync(string senderId, ComplimentRequest compliment)
    {
        var entity = new TableEntity(CurrentPartitionKey(), senderId)
        {
            { "RecipientId", compliment.RecipientId },
            { "RecipientName", compliment.RecipientName },
            { "CardName", compliment.CardName },
            { "Text", compliment.Text },
            { "HideFromDashboard", compliment.HideFromDashboard },
        };

        await _table.UpsertEntityAsync(entity);
    }

    // Compliments reset every year, so the year is the partition key across the whole table.
    private static string CurrentPartitionKey() => DateTime.UtcNow.Year.ToString();
}
