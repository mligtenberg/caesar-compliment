internal interface IRolesRepository
{
    Task InitializeAsync();

    Task<string?> GetRoleAsync(string objectId);

    Task<IReadOnlyList<RoleAssignment>> GetAllAsync();

    Task AssignRoleAsync(string objectId, string role, string displayName);

    Task RemoveRoleAsync(string objectId);
}

record RoleAssignment(string ObjectId, string Role, string DisplayName);
