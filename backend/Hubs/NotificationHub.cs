using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace backend.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?
            .FindFirst(ClaimTypes.NameIdentifier)?.Value;

        var role = Context.User?
            .FindFirst(ClaimTypes.Role)?.Value;

        Console.WriteLine("SignalR Connected UserId: " + userId);
        Console.WriteLine("SignalR Role: " + role);

        if (!string.IsNullOrEmpty(userId))
        {
            // ✅ Individual user group
            await Groups.AddToGroupAsync(
                Context.ConnectionId,
                $"User_{userId}");

            // ✅ All users group
            await Groups.AddToGroupAsync(
                Context.ConnectionId,
                "User");
        }

        if (!string.IsNullOrEmpty(role))
        {
            // ✅ Role group (Admin / User)
            await Groups.AddToGroupAsync(
                Context.ConnectionId,
                role);
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.User?
            .FindFirst(ClaimTypes.NameIdentifier)?.Value;

        Console.WriteLine("SignalR Disconnected UserId: " + userId);

        await base.OnDisconnectedAsync(exception);
    }
}