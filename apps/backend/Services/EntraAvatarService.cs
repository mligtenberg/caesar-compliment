using System.Net;
using System.Net.Http.Headers;
using Azure.Core;
using Microsoft.Extensions.Caching.Memory;

internal class EntraAvatarService(HttpClient httpClient, TokenCredential credential, IMemoryCache cache) : IAvatarService
{
    private static readonly TokenRequestContext GraphScope = new(["https://graph.microsoft.com/.default"]);
    private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(12);

    public async Task<AvatarPhoto?> GetAvatarAsync(string upn)
    {
        if (cache.TryGetValue(upn, out AvatarPhoto? cached)) return cached;

        var photo = await FetchAvatarAsync(upn);
        cache.Set(upn, photo, CacheDuration);
        return photo;
    }

    private async Task<AvatarPhoto?> FetchAvatarAsync(string upn)
    {
        HttpResponseMessage response;
        try
        {
            var token = await credential.GetTokenAsync(GraphScope, CancellationToken.None);

            using var request = new HttpRequestMessage(
                HttpMethod.Get, $"users/{Uri.EscapeDataString(upn)}/photos/64x64/$value");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.Token);

            response = await httpClient.SendAsync(request);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            throw new GraphUnavailableException("Could not reach Microsoft Graph to fetch an avatar.", ex);
        }

        using (response)
        {
            if (response.StatusCode == HttpStatusCode.NotFound) return null;
            if (!response.IsSuccessStatusCode)
            {
                throw new GraphUnavailableException(
                    $"Microsoft Graph returned {(int)response.StatusCode} fetching an avatar.");
            }

            var bytes = await response.Content.ReadAsByteArrayAsync();
            var contentType = response.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
            return new AvatarPhoto(bytes, contentType);
        }
    }
}
