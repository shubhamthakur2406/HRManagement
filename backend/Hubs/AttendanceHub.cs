using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

[Authorize]
public class AttendanceHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var role = Context.User?.FindFirst(ClaimTypes.Role)?.Value;

        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"User_{userId}");

            Console.WriteLine($"User {userId} connected to AttendanceHub");
        }

        if (role == "Admin")
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, "Admins");

            Console.WriteLine($"Admin connected: {userId}");
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception exception)
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (!string.IsNullOrEmpty(userId))
        {
            Console.WriteLine($"User {userId} disconnected from AttendanceHub");
        }

        await base.OnDisconnectedAsync(exception);
    }
}