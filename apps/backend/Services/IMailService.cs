internal record InlineImage(string ContentId, string FileName, string ContentType, byte[] Bytes);

internal interface IMailService
{
    Task SendAsync(string toAddress, string subject, string htmlBody, IReadOnlyList<InlineImage> inlineImages);
}
