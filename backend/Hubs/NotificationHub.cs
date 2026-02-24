using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace backend.Hubs
{
    [Authorize]
    public class NotificationHub : Hub
    {
        public override async Task OnConnectedAsync()
        {
            var role = Context.User?.FindFirst(ClaimTypes.Role)?.Value;

            if (role == "User")
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, "User");
            }

            await base.OnConnectedAsync();
        }
    }
}