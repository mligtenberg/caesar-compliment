using Azure.Data.Tables;

internal class AppStateRepository : IAppStateRepository
{
    private const string PartitionKey = "state";
    private const string RowKey = "current";
    private const string DefaultState = "Open";

    private readonly TableClient _table;

    public AppStateRepository(TableServiceClient tableServiceClient)
    {
        _table = tableServiceClient.GetTableClient("AppState");
    }

    public Task InitializeAsync() => _table.CreateIfNotExistsAsync();

    public async Task<string> GetStateAsync()
    {
        var response = await _table.GetEntityIfExistsAsync<TableEntity>(PartitionKey, RowKey);
        return response.HasValue ? response.Value!.GetString("State") ?? DefaultState : DefaultState;
    }

    public async Task SetStateAsync(string state)
    {
        var entity = new TableEntity(PartitionKey, RowKey)
        {
            { "State", state },
        };

        await _table.UpsertEntityAsync(entity);
    }
}
