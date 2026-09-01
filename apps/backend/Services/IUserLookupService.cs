internal record GraphUser(string Id, string DisplayName, string? Mail, string? UserPrincipalName);

internal interface IUserLookupService
{
    Task<IReadOnlyList<GraphUser>> SearchAsync(string query);

    Task<GraphUser?> GetByIdAsync(string id);
}
