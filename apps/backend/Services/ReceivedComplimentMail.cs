// Builds the "je hebt een complimentje" mail from the HTML template next to the app,
// which is authored (and previewable) as a standalone file in Emails/.
internal class ReceivedComplimentMail(IHostEnvironment environment, IConfiguration configuration)
{
    public const string Subject = "Iemand heeft je een complimentje gegeven";

    private readonly string _templateDirectory = Path.Combine(environment.ContentRootPath, "Emails");

    private string? _template;
    private InlineImage? _heading;

    public string BuildBody(string firstName)
    {
        _template ??= File.ReadAllText(Path.Combine(_templateDirectory, "received-compliment.html"));

        var url = (configuration["Frontend:Origin"] ?? "https://complimentje.caesar.nl").TrimEnd('/');

        return _template
            .Replace("{{firstName}}", System.Net.WebUtility.HtmlEncode(firstName))
            .Replace("{{complimentUrl}}", url)
            // The visible fallback link reads better without the scheme in front of it.
            .Replace("{{complimentUrlLabel}}", url.Replace("https://", "").Replace("http://", ""));
    }

    public IReadOnlyList<InlineImage> InlineImages()
    {
        _heading ??= new InlineImage(
            "heading",
            "heading.png",
            "image/png",
            File.ReadAllBytes(Path.Combine(_templateDirectory, "heading.png")));

        return [_heading];
    }
}
