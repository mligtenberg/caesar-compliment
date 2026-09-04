using System.Security.Claims;
using Microsoft.Identity.Web;

internal static class RolesEndpoints
{
    public static void MapRolesEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/myrole", async (ClaimsPrincipal user, IRolesRepository roles) =>
        {
            var role = await roles.GetRoleAsync(user.GetObjectId());

            return Results.Ok(role ?? "user");
        })
        .WithName("GetMyRole");

        var adminPages = app.MapGroup("/roles").AddEndpointFilter(AdminAuthorization.RequireAdmin);

        adminPages.MapGet("/", async (ClaimsPrincipal _, IRolesRepository roles) =>
            Results.Ok(await roles.GetAllAsync()))
        .WithName("GetAllRoles");

        adminPages.MapGet("/search", async (string query, IUserLookupService lookup, ILogger<Program> logger) =>
        {
            if (string.IsNullOrWhiteSpace(query)) return Results.Ok(Array.Empty<GraphUser>());

            try
            {
                return Results.Ok(await lookup.SearchAsync(query));
            }
            catch (GraphUnavailableException ex)
            {
                logger.LogError(ex, "Failed to search for user {Query} in Microsoft Graph.", query);
                return Results.StatusCode(StatusCodes.Status502BadGateway);
            }
        })
        .WithName("SearchUsers");

        adminPages.MapGet("/avatar/{objectId}", async (string objectId, IAvatarService avatars, ILogger<Program> logger) =>
        {
            try
            {
                var photo = await avatars.GetAvatarAsync(objectId);
                return photo is null ? Results.NotFound() : Results.Bytes(photo.Value.Bytes, photo.Value.ContentType);
            }
            catch (GraphUnavailableException ex)
            {
                logger.LogError(ex, "Failed to fetch avatar for {ObjectId} from Microsoft Graph.", objectId);
                return Results.StatusCode(StatusCodes.Status502BadGateway);
            }
        })
        .WithName("GetUserAvatar");

        adminPages.MapPost("/", async (ClaimsPrincipal _, RoleAssignment assignment, IRolesRepository roles) =>
        {
            await roles.AssignRoleAsync(assignment.ObjectId, assignment.Role, assignment.DisplayName);

            return Results.NoContent();
        })
        .WithName("AssignRole");

        adminPages.MapDelete("/{objectId}", async (ClaimsPrincipal user, string objectId, IRolesRepository roles) =>
        {
            if (objectId == user.GetObjectId()) return Results.BadRequest("Admins cannot remove their own role assignment.");

            await roles.RemoveRoleAsync(objectId);

            return Results.NoContent();
        })
        .WithName("RemoveRole");
    }
}
