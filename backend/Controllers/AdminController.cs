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
            Title = dto.Title,
            Message = dto.Message,
            RedirectUrl = dto.RedirectUrl,
            CreatedAt = DateTime.UtcNow,
            IsDeleted = false
        };

        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync();

        // Save user targets
        if (dto.UserIds != null)
        {
            foreach (var userId in dto.UserIds)
            {
                _context.NotificationUsers.Add(new NotificationUser
                {
                    NotificationId = notification.Id,
                    UserId = userId
                });

                await _hub.Clients.Group($"User_{userId}")
                    .SendAsync("ReceiveNotification", notification);
            }
        }

        // Save department targets
        if (dto.DepartmentIds != null)
        {
            foreach (var deptId in dto.DepartmentIds)
            {
                _context.NotificationDepartments.Add(new NotificationDepartment
                {
                    NotificationId = notification.Id,
                    DepartmentId = deptId
                });

                var users = _context.Users
                    .Where(u => u.DepartmentId == deptId)
                    .Select(u => u.Id)
                    .ToList();

                foreach (var userId in users)
                {
                    await _hub.Clients.Group($"User_{userId}")
                        .SendAsync("ReceiveNotification", notification);
                }
            }
        }

        if (dto.SendToAll)
        {
            await _hub.Clients.Group("User")
                .SendAsync("ReceiveNotification", notification);
        }

        await _context.SaveChangesAsync();

        return Ok(notification);
    }



    //[HttpPut("notifications/{id}")]
    //public async Task<IActionResult> UpdateNotification(int id, NotificationDto dto)
    //{
    //    var notification = await _context.Notifications
    //        .FirstOrDefaultAsync(n => n.Id == id && !n.IsDeleted);

    //    if (notification == null)
    //        return NotFound("Notification not found");

    //    // 🔹 Update basic fields
    //    notification.Title = dto.Title;
    //    notification.Message = dto.Message;
    //    notification.RedirectUrl = dto.RedirectUrl;

    //    // 🔹 Remove old mappings
    //    var oldUsers = _context.NotificationUsers
    //        .Where(x => x.NotificationId == id);

    //    var oldDepartments = _context.NotificationDepartments
    //        .Where(x => x.NotificationId == id);

    //    _context.NotificationUsers.RemoveRange(oldUsers);
    //    _context.NotificationDepartments.RemoveRange(oldDepartments);

    //    await _context.SaveChangesAsync();

    //    // 🔹 Add new user targets
    //    if (dto.UserIds != null)
    //    {
    //        foreach (var userId in dto.UserIds)
    //        {
    //            _context.NotificationUsers.Add(new NotificationUser
    //            {
    //                NotificationId = id,
    //                UserId = userId
    //            });

    //            await _hub.Clients.Group($"User_{userId}")
    //                .SendAsync("ReceiveNotification", notification);
    //        }
    //    }

    //    // 🔹 Add new department targets
    //    if (dto.DepartmentIds != null)
    //    {
    //        foreach (var deptId in dto.DepartmentIds)
    //        {
    //            _context.NotificationDepartments.Add(new NotificationDepartment
    //            {
    //                NotificationId = id,
    //                DepartmentId = deptId
    //            });

    //            var users = await _context.Users
    //                .Where(u => u.DepartmentId == deptId)
    //                .Select(u => u.Id)
    //                .ToListAsync();

    //            foreach (var userId in users)
    //            {
    //                await _hub.Clients.Group($"User_{userId}")
    //                    .SendAsync("ReceiveNotification", notification);
    //            }
    //        }
    //    }

    //    // 🔹 Send to all if selected
    //    if (dto.SendToAll)
    //    {
    //        await _hub.Clients.Group("User")
    //            .SendAsync("ReceiveNotification", notification);
    //    }

    //    await _context.SaveChangesAsync();

    //    return Ok(notification);
    //}



    [HttpPut("notifications/{id}")]
    public async Task<IActionResult> UpdateNotification(int id, NotificationDto dto)
    {
        var notification = await _context.Notifications
            .FirstOrDefaultAsync(n => n.Id == id && !n.IsDeleted);

        if (notification == null)
            return NotFound("Notification not found");

        // 🔹 Update fields
        notification.Title = dto.Title;
        notification.Message = dto.Message;
        notification.RedirectUrl = dto.RedirectUrl;
        notification.SendToAll = dto.SendToAll;

        // 🔹 Remove old mappings
        var oldUsers = _context.NotificationUsers
            .Where(x => x.NotificationId == id);

        var oldDepartments = _context.NotificationDepartments
            .Where(x => x.NotificationId == id);

        _context.NotificationUsers.RemoveRange(oldUsers);
        _context.NotificationDepartments.RemoveRange(oldDepartments);

        await _context.SaveChangesAsync();

        // 🔹 Add new mappings if NOT SendToAll
        if (!dto.SendToAll)
        {
            if (dto.UserIds != null)
            {
                foreach (var userId in dto.UserIds)
                {
                    _context.NotificationUsers.Add(new NotificationUser
                    {
                        NotificationId = id,
                        UserId = userId
                    });
                }
            }

            if (dto.DepartmentIds != null)
            {
                foreach (var deptId in dto.DepartmentIds)
                {
                    _context.NotificationDepartments.Add(new NotificationDepartment
                    {
                        NotificationId = id,
                        DepartmentId = deptId
                    });
                }
            }

            await _context.SaveChangesAsync();
        }

        // 🔥 Build camelCase response (VERY IMPORTANT)
        var response = new
        {
            id = notification.Id,
            title = notification.Title,
            message = notification.Message,
            redirectUrl = notification.RedirectUrl,
            createdAt = notification.CreatedAt,
            sendToAll = notification.SendToAll,
            userIds = await _context.NotificationUsers
                .Where(x => x.NotificationId == id)
                .Select(x => x.UserId)
                .ToListAsync(),
            departmentIds = await _context.NotificationDepartments
                .Where(x => x.NotificationId == id)
                .Select(x => x.DepartmentId)
                .ToListAsync()
        };

        // 🔥 Real-time broadcast (safe way)
        await _hub.Clients.All
            .SendAsync("ReceiveNotification", response);

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
        {
            await _hub.Clients.Group($"User_{userId}")
                .SendAsync("DeleteNotification", id);
        }

        await _hub.Clients.All
        .SendAsync("DeleteNotification", id);

        await _context.SaveChangesAsync();

        return Ok("Notification deleted successfully");
    }



    [HttpGet("notifications")]
    public async Task<IActionResult> GetAllNotifications()
    {
        var notifications = await _context.Notifications
            .Where(n => !n.IsDeleted)
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync();

        return Ok(notifications);
    }

    //// 🔔 CREATE NOTIFICATION
    //[HttpPost("notifications")]
    //public async Task<IActionResult> CreateNotification(NotificationDto dto)
    //{
    //    var notification = new Notification
    //    {
    //        Title = dto.Title,
    //        Message = dto.Message,
    //        RedirectUrl = dto.RedirectUrl,
    //        CreatedAt = DateTime.UtcNow,
    //        IsDeleted = false
    //    };

    //    // 1️⃣ Save in DB (for everyone)
    //    _context.Notifications.Add(notification);
    //    await _context.SaveChangesAsync();

    //    // 2️⃣ Send real-time to logged-in users only
    //    await _hub.Clients.Group("User")
    //        .SendAsync("ReceiveNotification", notification);

    //    return Ok(notification);
    //}

    //// 🔔 GET ALL NOTIFICATIONS (Admin View)
    //[HttpGet("notifications")]
    //public IActionResult GetAllNotifications()
    //{
    //    var notifications = _context.Notifications
    //        .Where(n => !n.IsDeleted)
    //        .OrderByDescending(n => n.CreatedAt)
    //        .ToList();

    //    return Ok(notifications);
    //}

    //// ✏️ UPDATE NOTIFICATION
    //[HttpPut("notifications/{id}")]
    //public async Task<IActionResult> UpdateNotification(int id, NotificationDto dto)
    //{
    //    if (!ModelState.IsValid)
    //        return BadRequest(ModelState);

    //    var notification = await _context.Notifications
    //        .FirstOrDefaultAsync(n => n.Id == id && !n.IsDeleted);

    //    if (notification == null)
    //        return NotFound("Notification not found");

    //    notification.Title = dto.Title;
    //    notification.Message = dto.Message;
    //    notification.RedirectUrl = dto.RedirectUrl;

    //    await _context.SaveChangesAsync();

    //    // 🔥 Optional: notify users that notification was updated
    //    await _hub.Clients.Group("User")
    //        .SendAsync("ReceiveNotification", notification);

    //    return Ok(notification);
    //}

    //// 🗑️ SOFT DELETE
    //[HttpDelete("notifications/{id}")]
    //public async Task<IActionResult> DeleteNotification(int id)
    //{
    //    var notification = _context.Notifications
    //        .FirstOrDefault(n => n.Id == id && !n.IsDeleted);

    //    if (notification == null)
    //        return NotFound();

    //    notification.IsDeleted = true;
    //    await _context.SaveChangesAsync();

    //    await _hub.Clients.Group("User")
    //        .SendAsync("DeleteNotification", id);

    //    return Ok("Deleted successfully");
    //}

    // ✅ GET ALL USERS WITH PAGINATION
    [HttpGet("users")]
    public IActionResult GetAllUsers(int pageNumber = 1, int pageSize = 10)
    {
        var query = _context.Users
            .Where(u => u.Role == "User" && !u.IsDeleted);

        var totalUsers = query.Count();

        var users = query
            .OrderBy(u => u.Id)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new UserListDto
            {
                Id = u.Id,
                FullName = u.FullName,
                Email = u.Email,
                DepartmentName = _context.Departments
                    .Where(d => d.Id == u.DepartmentId)
                    .Select(d => d.DepartmentName)
                    .FirstOrDefault()
            })
            .ToList();

        return Ok(new
        {
            totalUsers,
            pageSize,
            users
        });
    }


    // ✅ GET USER BY ID (FOR EDIT) — EXCLUDES DELETED USERS
    [HttpGet("users/{id}")]
    public IActionResult GetUserById(int id)
    {
        var user = _context.Users
            .Where(u => u.Id == id && u.Role == "User" && !u.IsDeleted)
            .Select(u => new
            {
                u.Id,
                u.FullName,
                u.Email,
                u.Address,
                u.PhoneNumber,
                u.DepartmentId
            })
            .FirstOrDefault();

        if (user == null)
            return NotFound("User not found");

        return Ok(user);
    }

    // ✅ UPDATE USER (ADMIN) — ONLY IF NOT DELETED
    [HttpPut("users/{id}")]
    public IActionResult UpdateUser(int id, AdminUpdateUserDto dto)
    {
        var user = _context.Users
            .FirstOrDefault(u => u.Id == id && u.Role == "User" && !u.IsDeleted);

        if (user == null)
            return NotFound("User not found");

        user.FullName = dto.FullName;
        user.Email = dto.Email;
        user.Address = dto.Address;
        user.PhoneNumber = dto.PhoneNumber;
        user.DepartmentId = dto.DepartmentId;

        _context.SaveChanges();

        return Ok("User updated successfully");
    }

    // 🔎 SEARCH USERS — EXCLUDES DELETED USERS
    [HttpGet("users/search")]
    public IActionResult SearchUsers(string? name, int? departmentId)
    {
        var query = _context.Users
            .Where(u => u.Role == "User" && !u.IsDeleted)
            .Join(
                _context.Departments,
                u => u.DepartmentId,
                d => d.Id,
                (u, d) => new UserListDto
                {
                    Id = u.Id,
                    FullName = u.FullName,
                    Email = u.Email,
                    DepartmentName = d.DepartmentName
                }
            );

        if (!string.IsNullOrEmpty(name))
        {
            query = query.Where(u =>
                u.FullName.ToLower().Contains(name.ToLower()));
        }

        if (departmentId.HasValue)
        {
            query = query.Where(u =>
                _context.Users.Any(x =>
                    x.Id == u.Id &&
                    x.DepartmentId == departmentId &&
                    !x.IsDeleted));
        }

        return Ok(query.ToList());
    }

    // 🔤 AUTOCOMPLETE SUGGESTIONS — EXCLUDES DELETED USERS
    [HttpGet("users/suggestions")]
    public IActionResult GetUserSuggestions(string query)
    {
        if (string.IsNullOrWhiteSpace(query))
            return Ok(new List<string>());

        var names = _context.Users
            .Where(u => u.Role == "User" &&
                        !u.IsDeleted &&
                        u.FullName.ToLower().StartsWith(query.ToLower()))
            .Select(u => u.FullName)
            .Distinct()
            .Take(10)
            .ToList();

        return Ok(names);
    }

    // 🗑️ SOFT DELETE USER (ADMIN)
    [HttpDelete("users/{id}")]
    public IActionResult SoftDeleteUser(int id)
    {
        var user = _context.Users
            .FirstOrDefault(u => u.Id == id && u.Role == "User" && !u.IsDeleted);

        if (user == null)
            return NotFound("User not found");

        user.IsDeleted = true;
        _context.SaveChanges();

        return Ok("User deleted successfully");
    }

    //// 🔔 CREATE NOTIFICATION
    //[HttpPost("notifications")]
    //public IActionResult CreateNotification(NotificationDto dto)
    //{
    //    var notification = new Notification
    //    {
    //        Title = dto.Title,
    //        Message = dto.Message
    //    };

    //    _context.Notifications.Add(notification);
    //    _context.SaveChanges();

    //    return Ok("Notification created");
    //}

    //// 🔔 GET ALL NOTIFICATIONS (ADMIN)
    //[HttpGet("notifications")]
    //public IActionResult GetNotifications()
    //{
    //    var notifications = _context.Notifications
    //        .Where(n => !n.IsDeleted)
    //        .OrderByDescending(n => n.CreatedAt)
    //        .ToList();

    //    return Ok(notifications);
    //}

    //// ✏️ UPDATE NOTIFICATION
    //[HttpPut("notifications/{id}")]
    //public IActionResult UpdateNotification(int id, NotificationDto dto)
    //{
    //    var notification = _context.Notifications
    //        .FirstOrDefault(n => n.Id == id && !n.IsDeleted);

    //    if (notification == null)
    //        return NotFound();

    //    notification.Title = dto.Title;
    //    notification.Message = dto.Message;

    //    _context.SaveChanges();

    //    return Ok("Notification updated");
    //}

    //// 🗑️ DELETE NOTIFICATION (SOFT DELETE)
    //[HttpDelete("notifications/{id}")]
    //public IActionResult DeleteNotification(int id)
    //{
    //    var notification = _context.Notifications
    //        .FirstOrDefault(n => n.Id == id && !n.IsDeleted);

    //    if (notification == null)
    //        return NotFound();

    //    notification.IsDeleted = true;
    //    _context.SaveChanges();

    //    return Ok("Notification deleted");
    //}
    

}
