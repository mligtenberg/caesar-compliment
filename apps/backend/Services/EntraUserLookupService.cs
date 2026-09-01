using System.Net.Http.Headers;
using System.Net.Http.Json;
using Azure.Core;

internal class EntraUserLookupService(HttpClient httpClient, TokenCredential credential) : IUserLookupService
{
    private static readonly TokenRequestContext GraphScope = new(["https://graph.microsoft.com/.default"]);
    private const int MaxResults = 10;

    public async Task<IReadOnlyList<GraphUser>> SearchAsync(string query)
    {
        // $search does a "starts with" match across the given properties and, unlike
        // $filter, ranks results - it's Graph's supported way to back an autocomplete.
        var escaped = query.Replace("\"", "");
        var search = $"\"displayName:{escaped}\" OR \"mail:{escaped}\" OR \"userPrincipalName:{escaped}\"";
        var url = $"users?$search={Uri.EscapeDataString(search)}&$select=id,displayName,mail,userPrincipalName&$top={MaxResults}";

        HttpResponseMessage response;
        try
        {
            var token = await credential.GetTokenAsync(GraphScope, CancellationToken.None);

            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.Token);
            // $search requires Graph's advanced query support.
            request.Headers.Add("ConsistencyLevel", "eventual");

            response = await httpClient.SendAsync(request);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            throw new GraphUnavailableException("Could not reach Microsoft Graph to search for a user.", ex);
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
            {
                throw new GraphUnavailableException(
                    $"Microsoft Graph returned {(int)response.StatusCode} searching for a user.");
            }

            var payload = await response.Content.ReadFromJsonAsync<GraphUserSearchResponse>();

            return payload?.Value?
                .Select(u => new GraphUser(u.Id, u.DisplayName, u.Mail, u.UserPrincipalName))
                .ToArray() ?? [];
        }
    }

    private sealed record GraphUserSearchResponse(List<GraphUserDto>? Value);

    private sealed record GraphUserDto(string Id, string DisplayName, string? Mail, string? UserPrincipalName);
}
