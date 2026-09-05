using System.Net.Http.Headers;
using System.Net.Http.Json;
using Azure.Core;

// Sends mail with the app registration's own Mail.Send application permission, which
// always sends "as" a mailbox rather than as the signed-in admin - the mailbox to use
// comes from Mail:Sender configuration (complimentje@caesar.nl).
internal class GraphMailService(HttpClient httpClient, TokenCredential credential, IConfiguration configuration) : IMailService
{
    private static readonly TokenRequestContext GraphScope = new(["https://graph.microsoft.com/.default"]);

    public async Task SendAsync(string toAddress, string subject, string htmlBody, IReadOnlyList<InlineImage> inlineImages)
    {
         var sender = configuration["Mail:Sender"];
        if (string.IsNullOrWhiteSpace(sender))
        {
            throw new InvalidOperationException("No Mail:Sender mailbox is configured to send compliment mails from.");
        }

        var payload = new
        {
            message = new
            {
                subject,
                body = new { contentType = "HTML", content = htmlBody },
                toRecipients = new[] { new { emailAddress = new { address = toAddress } } },
                // Inline images travel with the message instead of being hosted somewhere
                // public, so the heading renders even before a recipient allows remote images.
                attachments = inlineImages.Select(image => new Dictionary<string, object?>
                {
                    ["@odata.type"] = "#microsoft.graph.fileAttachment",
                    ["name"] = image.FileName,
                    ["contentType"] = image.ContentType,
                    ["contentBytes"] = Convert.ToBase64String(image.Bytes),
                    ["contentId"] = image.ContentId,
                    ["isInline"] = true,
                }).ToArray(),
            },
            // Kept on so the shared mailbox has a record of who was mailed and when.
            saveToSentItems = true,
        };

        HttpResponseMessage response;
        try
        {
            var token = await credential.GetTokenAsync(GraphScope, CancellationToken.None);

            using var request = new HttpRequestMessage(
                HttpMethod.Post, $"users/{Uri.EscapeDataString(sender)}/sendMail")
            {
                Content = JsonContent.Create(payload),
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.Token);

            response = await httpClient.SendAsync(request);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            throw new GraphUnavailableException("Could not reach Microsoft Graph to send a mail.", ex);
        }

        using (response)
        {
            if (response.IsSuccessStatusCode) return;

            var detail = await response.Content.ReadAsStringAsync();
            throw new GraphUnavailableException(
                $"Microsoft Graph returned {(int)response.StatusCode} sending a mail: {detail}");
        }
    }
}
