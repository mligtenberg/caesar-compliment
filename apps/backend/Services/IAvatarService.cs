internal readonly record struct AvatarPhoto(byte[] Bytes, string ContentType);

internal interface IAvatarService
{
    Task<AvatarPhoto?> GetAvatarAsync(string upn);
}
