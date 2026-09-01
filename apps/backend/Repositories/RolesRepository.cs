using Azure.Data.Tables;

internal class RolesRepository : IRolesRepository
{
    private const string PartitionKey = "role";

    private readonly TableClient _table;

    public RolesRepository(TableServiceClient tableServiceClient)
    {
        _table = tableServiceClient.GetTableClient("Roles");
    }

    public Task InitializeAsync() => _table.CreateIfNotExistsAsync();

    public async Task<string?> GetRoleAsync(string objectId)
    {
        var response = await _table.GetEntityIfExistsAsync<TableEntity>(PartitionKey, objectId);
        return response.HasValue ? response.Value!.GetString("Role") : null;
    }

    public async Task<IReadOnlyList<RoleAssignment>> GetAllAsync()
    {
        var assignments = new List<RoleAssignment>();

        await foreach (var entity in _table.QueryAsync<TableEntity>(filter: $"PartitionKey eq '{PartitionKey}'"))
        {
            assignments.Add(new RoleAssignment(entity.RowKey, entity.GetString("Role") ?? "", entity.GetString("DisplayName") ?? ""));
        }

        return assignments;
    }

    public async Task AssignRoleAsync(string objectId, string role, string displayName)
    {
        var entity = new TableEntity(PartitionKey, objectId)
        {
            { "Role", role },
            { "DisplayName", displayName },
        };

        await _table.UpsertEntityAsync(entity);
    }

    public async Task RemoveRoleAsync(string objectId)
    {
        await _table.DeleteEntityAsync(PartitionKey, objectId);
    }
}
