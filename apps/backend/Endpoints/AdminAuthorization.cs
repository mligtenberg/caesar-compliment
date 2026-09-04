using Microsoft.Identity.Web;

internal static class AdminAuthorization
{
    // Only admins may call endpoints behind this filter - callers must already have
    // an "admin" row in the Roles table themselves, checked on every request.
    public static async ValueTask<object?> RequireAdmin(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var user = context.HttpContext.User;
        var roles = context.HttpContext.RequestServices.GetRequiredService<IRolesRepository>();
        var role = await roles.GetRoleAsync(user.GetObjectId());

        return role == "admin" ? await next(context) : Results.Forbid();
    }
}
