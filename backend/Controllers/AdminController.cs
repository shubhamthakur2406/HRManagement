using backend.Data;
using backend.DTOs;
using backend.Hubs;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;


[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly AuthDbContext _context;
    private readonly IHubContext<NotificationHub> _hub;

    public AdminController(AuthDbContext context,
                           IHubContext<NotificationHub> hub)
    {
        _context = context;
        _hub = hub;
    }

    [HttpPost("notifications")]
    public async Task<IActionResult> CreateNotification(NotificationDto dto)
    {
        var notification = new Notification
        {
            Title       = dto.Title,
            Message     = dto.Message,
            RedirectUrl = dto.RedirectUrl,
            CreatedAt   = DateTime.UtcNow,
            SendToAll   = dto.SendToAll,
            IsDeleted   = false
        };

        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync();

        var targetUsers = new HashSet<int>();

        if (dto.UserIds != null && dto.UserIds.Any())
        {
            foreach (var userId in dto.UserIds)
            {
                _context.NotificationUsers.Add(new NotificationUser
                {
                    NotificationId = notification.Id,
                    UserId         = userId
                });
                targetUsers.Add(userId);
            }
        }

        if (dto.DepartmentIds != null && dto.DepartmentIds.Any())
        {
            foreach (var deptId in dto.DepartmentIds)
            {
                _context.NotificationDepartments.Add(new NotificationDepartment
                {
                    NotificationId = notification.Id,
                    DepartmentId   = deptId
                });

                var deptUsers = await _context.Users
                    .Where(u => u.DepartmentId == deptId)
                    .Select(u => u.Id)
                    .ToListAsync();

                foreach (var userId in deptUsers)
                    targetUsers.Add(userId);
            }
        }

        await _context.SaveChangesAsync();

        var userNames = dto.UserIds != null && dto.UserIds.Any()
            ? await _context.Users.Where(u => dto.UserIds.Contains(u.Id)).Select(u => u.FullName).ToListAsync()
            : new List<string>();

        var departmentNames = dto.DepartmentIds != null && dto.DepartmentIds.Any()
            ? await _context.Departments.Where(d => dto.DepartmentIds.Contains(d.Id)).Select(d => d.DepartmentName).ToListAsync()
            : new List<string>();

        var response = new
        {
            id              = notification.Id,
            title           = notification.Title,
            message         = notification.Message,
            redirectUrl     = notification.RedirectUrl,
            createdAt       = notification.CreatedAt,
            sendToAll       = notification.SendToAll,
            userIds         = dto.UserIds ?? new List<int>(),
            departmentIds   = dto.DepartmentIds ?? new List<int>(),
            userNames,
            departmentNames
        };

        try
        {
            if (dto.SendToAll)
                await _hub.Clients.Group("User").SendAsync("ReceiveNotification", response);
            else
                foreach (var userId in targetUsers)
                    await _hub.Clients.Group($"User_{userId}").SendAsync("ReceiveNotification", response);

            await _hub.Clients.All.SendAsync("ReceiveNotification", response);
        }
        catch (Exception ex)
        {
            Console.WriteLine("SignalR Error: " + ex.Message);
        }

        return Ok(response);
    }

    [HttpPut("notifications/{id}")]
    public async Task<IActionResult> UpdateNotification(int id, NotificationDto dto)
    {
        var notification = await _context.Notifications
            .FirstOrDefaultAsync(n => n.Id == id && !n.IsDeleted);

        if (notification == null)
            return NotFound("Notification not found");

        notification.Title       = dto.Title;
        notification.Message     = dto.Message;
        notification.RedirectUrl = dto.RedirectUrl;
        notification.SendToAll   = dto.SendToAll;

        // ── Remove old recipients ──────────────────────────────────────────
        var oldUsers = _context.NotificationUsers.Where(x => x.NotificationId == id);
        var oldDepts = _context.NotificationDepartments.Where(x => x.NotificationId == id);
        _context.NotificationUsers.RemoveRange(oldUsers);
        _context.NotificationDepartments.RemoveRange(oldDepts);
        await _context.SaveChangesAsync();

        // ── Add new recipients ─────────────────────────────────────────────
        if (!dto.SendToAll)
        {
            if (dto.UserIds != null)
                foreach (var userId in dto.UserIds)
                    _context.NotificationUsers.Add(new NotificationUser { NotificationId = id, UserId = userId });

            if (dto.DepartmentIds != null)
                foreach (var deptId in dto.DepartmentIds)
                    _context.NotificationDepartments.Add(new NotificationDepartment { NotificationId = id, DepartmentId = deptId });

            await _context.SaveChangesAsync();
        }

        var savedUserIds = await _context.NotificationUsers
            .Where(x => x.NotificationId == id).Select(x => x.UserId).ToListAsync();
        var savedDeptIds = await _context.NotificationDepartments
            .Where(x => x.NotificationId == id).Select(x => x.DepartmentId).ToListAsync();

        var userNames = savedUserIds.Any()
            ? await _context.Users.Where(u => savedUserIds.Contains(u.Id)).Select(u => u.FullName).ToListAsync()
            : new List<string>();
        var departmentNames = savedDeptIds.Any()
            ? await _context.Departments.Where(d => savedDeptIds.Contains(d.Id)).Select(d => d.DepartmentName).ToListAsync()
            : new List<string>();

        // ── Mark as unread for all users who had already read this notification ──
        //
        // Logic:
        //   sendToAll  → all users whose ReadNotificationIds contains this id
        //   specific   → only targeted users (by userId + department users) who read it
        //
        var notifIdStr = id.ToString();

        // Build the set of users who should be marked unread
        var usersToMarkUnread = new HashSet<int>();

        if (dto.SendToAll)
        {
            // All users who have read this notification
            var allUsers = await _context.Users
                .Where(u => u.Role == "User" && !u.IsDeleted &&
                            u.ReadNotificationIds != null &&
                            u.ReadNotificationIds.Contains(notifIdStr))
                .ToListAsync();

            foreach (var u in allUsers)
                usersToMarkUnread.Add(u.Id);
        }
        else
        {
            // Only the targeted users (specific + department members) who have read it
            var targetSet = new HashSet<int>(savedUserIds);

            // Add users from saved departments
            foreach (var deptId in savedDeptIds)
            {
                var deptMembers = await _context.Users
                    .Where(u => u.DepartmentId == deptId && u.Role == "User" && !u.IsDeleted)
                    .Select(u => u.Id)
                    .ToListAsync();
                foreach (var uid in deptMembers) targetSet.Add(uid);
            }

            // Filter to only those who have actually read it
            var targetUsers = await _context.Users
                .Where(u => targetSet.Contains(u.Id) &&
                            u.ReadNotificationIds != null &&
                            u.ReadNotificationIds.Contains(notifIdStr))
                .ToListAsync();

            foreach (var u in targetUsers)
                usersToMarkUnread.Add(u.Id);
        }

        // Remove this notification id from ReadNotificationIds for each affected user
        if (usersToMarkUnread.Any())
        {
            var usersToUpdate = await _context.Users
                .Where(u => usersToMarkUnread.Contains(u.Id))
                .ToListAsync();

            foreach (var u in usersToUpdate)
            {
                var ids = string.IsNullOrEmpty(u.ReadNotificationIds)
                    ? new List<int>()
                    : u.ReadNotificationIds
                        .Split(',', StringSplitOptions.RemoveEmptyEntries)
                        .Select(int.Parse)
                        .ToList();

                ids.Remove(id);  // remove this notification's id

                u.ReadNotificationIds = ids.Count > 0 ? string.Join(",", ids) : "";
            }

            await _context.SaveChangesAsync();

            // Push SignalR "NotificationMarkedUnread" to each affected user instantly
            foreach (var uid in usersToMarkUnread)
            {
                await _hub.Clients.Group($"User_{uid}")
                    .SendAsync("NotificationMarkedUnread", id);
            }
        }

        // ── Push updated notification to everyone ──────────────────────────
        var response = new
        {
            id              = notification.Id,
            title           = notification.Title,
            message         = notification.Message,
            redirectUrl     = notification.RedirectUrl,
            createdAt       = notification.CreatedAt,
            sendToAll       = notification.SendToAll,
            userIds         = savedUserIds,
            departmentIds   = savedDeptIds,
            userNames,
            departmentNames
        };

        await _hub.Clients.All.SendAsync("ReceiveNotification", response);
        return Ok(response);
    }

    [HttpDelete("notifications/{id}")]
    public async Task<IActionResult> SoftDeleteNotification(int id)
    {
        var notification = await _context.Notifications
            .FirstOrDefaultAsync(n => n.Id == id && !n.IsDeleted);

        if (notification == null)
            return NotFound("Notification not found");

        notification.IsDeleted = true;

        var users = await _context.NotificationUsers
            .Where(x => x.NotificationId == id)
            .Select(x => x.UserId)
            .ToListAsync();

        foreach (var userId in users)
            await _hub.Clients.Group($"User_{userId}").SendAsync("DeleteNotification", id);

        await _hub.Clients.All.SendAsync("DeleteNotification", id);
        await _context.SaveChangesAsync();

        return Ok("Notification deleted successfully");
    }

    // ✅ GET ALL NOTIFICATIONS — includes userIds, departmentIds, userNames, departmentNames
    [HttpGet("notifications")]
    public async Task<IActionResult> GetAllNotifications()
    {
        var notifications = await _context.Notifications
            .Where(n => !n.IsDeleted)
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync();

        var result = new List<object>();

        foreach (var n in notifications)
        {
            var userIds = await _context.NotificationUsers
                .Where(x => x.NotificationId == n.Id)
                .Select(x => x.UserId)
                .ToListAsync();

            var departmentIds = await _context.NotificationDepartments
                .Where(x => x.NotificationId == n.Id)
                .Select(x => x.DepartmentId)
                .ToListAsync();

            var userNames = userIds.Any()
                ? await _context.Users.Where(u => userIds.Contains(u.Id)).Select(u => u.FullName).ToListAsync()
                : new List<string>();

            var departmentNames = departmentIds.Any()
                ? await _context.Departments.Where(d => departmentIds.Contains(d.Id)).Select(d => d.DepartmentName).ToListAsync()
                : new List<string>();

            result.Add(new
            {
                id              = n.Id,
                title           = n.Title,
                message         = n.Message,
                redirectUrl     = n.RedirectUrl,
                createdAt       = n.CreatedAt,
                sendToAll       = n.SendToAll,
                isDeleted       = n.IsDeleted,
                userIds,
                departmentIds,
                userNames,
                departmentNames
            });
        }

        return Ok(result);
    }

    // ✅ GET ALL USERS — includes ProfilePicture
    [HttpGet("users")]
    public IActionResult GetAllUsers(int pageNumber = 1, int pageSize = 10)
    {
        var query      = _context.Users.Where(u => u.Role == "User" && !u.IsDeleted);
        var totalUsers = query.Count();

        var users = query
            .OrderBy(u => u.Id)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new UserListDto
            {
                Id             = u.Id,
                FullName       = u.FullName,
                Email          = u.Email,
                ProfilePicture = u.ProfilePicture,
                DepartmentName = _context.Departments
                    .Where(d => d.Id == u.DepartmentId)
                    .Select(d => d.DepartmentName)
                    .FirstOrDefault()
            })
            .ToList();

        return Ok(new { totalUsers, pageSize, users });
    }

    // ✅ GET USER BY ID
    [HttpGet("users/{id}")]
    public IActionResult GetUserById(int id)
    {
        var user = _context.Users
            .Where(u => u.Id == id && u.Role == "User" && !u.IsDeleted)
            .Select(u => new { u.Id, u.FullName, u.Email, u.Address, u.PhoneNumber, u.DepartmentId })
            .FirstOrDefault();

        if (user == null) return NotFound("User not found");
        return Ok(user);
    }

    // ✅ UPDATE USER
    [HttpPut("users/{id}")]
    public IActionResult UpdateUser(int id, AdminUpdateUserDto dto)
    {
        var user = _context.Users.FirstOrDefault(u => u.Id == id && u.Role == "User" && !u.IsDeleted);
        if (user == null) return NotFound("User not found");

        user.FullName     = dto.FullName;
        user.Email        = dto.Email;
        user.Address      = dto.Address;
        user.PhoneNumber  = dto.PhoneNumber;
        user.DepartmentId = dto.DepartmentId;

        _context.SaveChanges();
        return Ok("User updated successfully");
    }

    // ✅ SEARCH USERS
    [HttpGet("users/search")]
    public IActionResult SearchUsers(string? name, int? departmentId)
    {
        var query = _context.Users
            .Where(u => u.Role == "User" && !u.IsDeleted)
            .Join(_context.Departments, u => u.DepartmentId, d => d.Id,
                (u, d) => new UserListDto
                {
                    Id             = u.Id,
                    FullName       = u.FullName,
                    Email          = u.Email,
                    ProfilePicture = u.ProfilePicture,
                    DepartmentName = d.DepartmentName
                });

        if (!string.IsNullOrEmpty(name))
            query = query.Where(u => u.FullName.ToLower().Contains(name.ToLower()));

        if (departmentId.HasValue)
            query = query.Where(u =>
                _context.Users.Any(x => x.Id == u.Id && x.DepartmentId == departmentId && !x.IsDeleted));

        return Ok(query.ToList());
    }

    // ✅ AUTOCOMPLETE SUGGESTIONS
    [HttpGet("users/suggestions")]
    public IActionResult GetUserSuggestions(string query)
    {
        if (string.IsNullOrWhiteSpace(query)) return Ok(new List<string>());

        var names = _context.Users
            .Where(u => u.Role == "User" && !u.IsDeleted &&
                        u.FullName.ToLower().StartsWith(query.ToLower()))
            .Select(u => u.FullName)
            .Distinct().Take(10).ToList();

        return Ok(names);
    }

    // ✅ SOFT DELETE USER
    [HttpDelete("users/{id}")]
    public IActionResult SoftDeleteUser(int id)
    {
        var user = _context.Users.FirstOrDefault(u => u.Id == id && u.Role == "User" && !u.IsDeleted);
        if (user == null) return NotFound("User not found");

        user.IsDeleted = true;
        _context.SaveChanges();
        return Ok("User deleted successfully");
    }
}
