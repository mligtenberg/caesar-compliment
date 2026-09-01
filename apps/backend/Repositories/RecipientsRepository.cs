using System.Text;
using Azure.Storage.Blobs;

internal class RecipientsRepository : IRecipientsRepository
{
    private const string ContainerName = "recipients";
    private const string BlobName = "mijncaesar_users.csv";

    private readonly BlobContainerClient _container;
    private readonly string _localCsvPath;
    private IReadOnlyList<RecipientRow> _recipients = [];
    private IReadOnlyDictionary<string, string> _upnById = new Dictionary<string, string>();

    public RecipientsRepository(BlobServiceClient blobServiceClient, IHostEnvironment environment)
    {
        _container = blobServiceClient.GetBlobContainerClient(ContainerName);
        _localCsvPath = Path.Combine(environment.ContentRootPath, "..", "..", BlobName);
    }

    public async Task InitializeAsync()
    {
        var blob = _container.GetBlobClient(BlobName);

        // Local dev has no deploy step to seed the container - upload the CSV checked
        // into the repo root to Azurite the first time the app starts against it.
        if (!await blob.ExistsAsync() && File.Exists(_localCsvPath))
        {
            await _container.CreateIfNotExistsAsync();
            await blob.UploadAsync(_localCsvPath);
        }

        if (!await blob.ExistsAsync()) return;

        using var stream = await blob.OpenReadAsync();
        using var reader = new StreamReader(stream);

        await reader.ReadLineAsync(); // header: id,name,email,username,upn,company,team,klantteam

        var recipients = new List<RecipientRow>();
        string? line;
        while ((line = await reader.ReadLineAsync()) is not null)
        {
            var fields = ParseCsvLine(line);
            if (fields.Length < 6) continue;

            var companies = SplitToSet(fields[5], ',');
            var teams = fields.Length > 6 ? SplitToSet(fields[6], ';') : [];
            var klantTeams = fields.Length > 7 ? SplitToSet(fields[7], ';') : [];

            recipients.Add(new RecipientRow(fields[0], fields[1], fields[2], fields[3], fields[4], fields[5], companies, teams, klantTeams));
        }

        _recipients = recipients;
        _upnById = recipients.ToDictionary(r => r.Id, r => r.Upn);
    }

    public string? GetUpnById(string id) => _upnById.GetValueOrDefault(id);

    public IReadOnlyList<Recipient> Search(string? term, string? viewerEmail, IReadOnlySet<string> excludedRecipientIds)
    {
        // The signed-in account's domain doesn't reliably match the CSV's - people move
        // between the group's companies (e.g. caesar.nl vs garansys.nl) and keep signing
        // in with their old account. The part before the "@" is unique across every
        // domain in the group though, so match it against the CSV's own username column.
        var viewerLocalPart = LocalPart(viewerEmail);

        var trimmed = term?.Trim() ?? "";
        var matches = _recipients.Where(r =>
            !string.Equals(r.Username, viewerLocalPart, StringComparison.OrdinalIgnoreCase) &&
            !excludedRecipientIds.Contains(r.Id) &&
            (trimmed.Length == 0 || r.Name.Contains(trimmed, StringComparison.OrdinalIgnoreCase)));

        var viewer = viewerLocalPart is null
            ? null
            : _recipients.FirstOrDefault(r => string.Equals(r.Username, viewerLocalPart, StringComparison.OrdinalIgnoreCase));

        return matches
            .OrderBy(r => RelevanceTier(r, viewer))
            .ThenBy(r => r.Name, StringComparer.OrdinalIgnoreCase)
            .Take(5)
            .Select(r => new Recipient(r.Id, r.Name, r.JobTitle, $"/suggestions/avatar/{r.Id}"))
            .ToArray();
    }

    private static string? LocalPart(string? email)
    {
        if (string.IsNullOrEmpty(email)) return null;

        var at = email.IndexOf('@');
        return at < 0 ? email : email[..at];
    }

    // Colleagues sharing a klantteam (client engagement) rank above colleagues on the
    // same internal Caesar team, who rank above colleagues from the same company, who
    // rank above everyone else.
    private static int RelevanceTier(RecipientRow candidate, RecipientRow? viewer)
    {
        if (viewer is null) return 3;
        if (candidate.KlantTeams.Overlaps(viewer.KlantTeams)) return 0;
        if (candidate.Teams.Overlaps(viewer.Teams)) return 1;
        if (candidate.Companies.Overlaps(viewer.Companies)) return 2;
        return 3;
    }

    private static HashSet<string> SplitToSet(string value, char separator) =>
        value.Split(separator, StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

    private sealed record RecipientRow(
        string Id,
        string Name,
        string Email,
        string Username,
        string Upn,
        string JobTitle,
        IReadOnlySet<string> Companies,
        IReadOnlySet<string> Teams,
        IReadOnlySet<string> KlantTeams);

    // MijnCaesar exports company names containing commas as quoted fields
    // (e.g. "Caesar Experts, Cloud Republic"), so a plain string.Split(',') would
    // split those rows into the wrong number of columns.
    private static string[] ParseCsvLine(string line)
    {
        var fields = new List<string>();
        var current = new StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < line.Length; i++)
        {
            var c = line[i];
            if (inQuotes)
            {
                if (c == '"' && i + 1 < line.Length && line[i + 1] == '"')
                {
                    current.Append('"');
                    i++;
                }
                else if (c == '"')
                {
                    inQuotes = false;
                }
                else
                {
                    current.Append(c);
                }
            }
            else if (c == '"')
            {
                inQuotes = true;
            }
            else if (c == ',')
            {
                fields.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }

        fields.Add(current.ToString());
        return fields.ToArray();
    }
}
