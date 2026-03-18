using backend.Data;
using backend.DTOs;
using backend.Hubs;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

[ApiController]
[Route("api/user")]
[Authorize(Roles = "User")]
public class UserController : ControllerBase
{
    private readonly AuthDbContext _context;

    public UserController(AuthDbContext context)
    {
        _context = context;
    }

    [HttpGet("notifications")]
    public async Task<IActionResult> GetUserNotifications()
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));

        var departmentId = await _context.Users
            .Where(u => u.Id == userId)
            .Select(u => u.DepartmentId)
            .FirstOrDefaultAsync();

        var notifications = await _context.Notifications
            .Where(n => !n.IsDeleted &&
                (
                    _context.NotificationUsers
                        .Any(nu => nu.NotificationId == n.Id && nu.UserId == userId)
                    ||
                    _context.NotificationDepartments
                        .Any(nd => nd.NotificationId == n.Id && nd.DepartmentId == departmentId)
                    ||
                    n.NotificationUsers.Count == 0 && n.NotificationDepartments.Count == 0
                ))
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync();

        return Ok(notifications);
    }

    // ✅ GET read notification IDs for this user
    [HttpGet("read-notifications")]
    public async Task<IActionResult> GetReadNotifications()
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));

        var user = await _context.Users.FindAsync(userId);
        if (user == null) return NotFound();

        var ids = string.IsNullOrEmpty(user.ReadNotificationIds)
            ? new List<int>()
            : user.ReadNotificationIds
                .Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(int.Parse)
                .ToList();

        return Ok(ids);
    }

    // ✅ POST — save updated read notification IDs for this user
    [HttpPost("read-notifications")]
    public async Task<IActionResult> SaveReadNotifications([FromBody] List<int> ids)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));

        var user = await _context.Users.FindAsync(userId);
        if (user == null) return NotFound();

        user.ReadNotificationIds = ids != null && ids.Count > 0
            ? string.Join(",", ids)
            : "";

        await _context.SaveChangesAsync();

        return Ok();
    }

    // 🔹 Get own profile
    [HttpGet("profile")]
    public IActionResult GetProfile()
    {
        var email = User.FindFirstValue(ClaimTypes.Email);

        var user = _context.Users
            .Where(u => u.Email == email)
            .Select(u => new
            {
                u.FullName,
                u.Address,
                u.PhoneNumber
            })
            .FirstOrDefault();

        if (user == null)
            return NotFound();

        return Ok(user);
    }

    // 🔹 Update Own Profile
    [HttpPut("profile")]
    public IActionResult UpdateProfile(UserUpdateProfileDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = _context.Users.FirstOrDefault(u => u.Id == int.Parse(userId));

        if (user == null)
            return NotFound("User not found");

        user.FullName = dto.FullName;
        user.Address = dto.Address;
        user.PhoneNumber = dto.PhoneNumber;

        _context.SaveChanges();

        return Ok(new { message = "Profile updated successfully" });
    }

    // 🔐 Change Password
    [HttpPut("change-password")]
    public IActionResult ChangePassword(ChangePasswordDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = _context.Users.FirstOrDefault(u => u.Id == int.Parse(userId));

        if (user == null)
            return NotFound("User not found");

        if (!BCrypt.Net.BCrypt.Verify(dto.OldPassword, user.PasswordHash))
            return BadRequest("Old password is incorrect");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);

        _context.SaveChanges();

        return Ok(new { message = "Password changed successfully" });
    }
}
