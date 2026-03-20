using backend.Data;
using backend.DTOs;
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

    // ── Notifications ────────────────────────────────────────────────────
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

    [HttpGet("read-notifications")]
    public async Task<IActionResult> GetReadNotifications()
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        var user   = await _context.Users.FindAsync(userId);
        if (user == null) return NotFound();

        var ids = string.IsNullOrEmpty(user.ReadNotificationIds)
            ? new List<int>()
            : user.ReadNotificationIds
                .Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(int.Parse)
                .ToList();

        return Ok(ids);
    }

    [HttpPost("read-notifications")]
    public async Task<IActionResult> SaveReadNotifications([FromBody] List<int> ids)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        var user   = await _context.Users.FindAsync(userId);
        if (user == null) return NotFound();

        user.ReadNotificationIds = ids != null && ids.Count > 0
            ? string.Join(",", ids)
            : "";

        await _context.SaveChangesAsync();
        return Ok();
    }

    // ── Profile ───────────────────────────────────────────────────────────
    [HttpGet("profile")]
    public IActionResult GetProfile()
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));

        var user = _context.Users
            .Where(u => u.Id == userId)
            .Select(u => new
            {
                u.FullName,
                u.Address,
                u.PhoneNumber,
                u.Email,
                u.ProfilePicture
            })
            .FirstOrDefault();

        if (user == null) return NotFound();
        return Ok(user);
    }

    [HttpPut("profile")]
    public IActionResult UpdateProfile(UserUpdateProfileDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var user = _context.Users.FirstOrDefault(u => u.Id == int.Parse(userId));
        if (user == null) return NotFound("User not found");

        user.FullName    = dto.FullName;
        user.Address     = dto.Address;
        user.PhoneNumber = dto.PhoneNumber;

        _context.SaveChanges();
        return Ok(new { message = "Profile updated successfully" });
    }

    // ── Profile Picture ───────────────────────────────────────────────────

    // GET: returns just the Base64 picture string
    [HttpGet("profile-picture")]
    public async Task<IActionResult> GetProfilePicture()
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        var user   = await _context.Users.FindAsync(userId);
        if (user == null) return NotFound();

        return Ok(new { profilePicture = user.ProfilePicture ?? "" });
    }

    // POST: saves the Base64 picture string
    [HttpPost("profile-picture")]
    public async Task<IActionResult> UploadProfilePicture([FromBody] ProfilePictureDto dto)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        var user   = await _context.Users.FindAsync(userId);
        if (user == null) return NotFound();

        if (string.IsNullOrEmpty(dto.Base64Image))
            return BadRequest(new { message = "Image data is required" });

        user.ProfilePicture = dto.Base64Image;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Profile picture updated successfully" });
    }

    // DELETE: removes the profile picture
    [HttpDelete("profile-picture")]
    public async Task<IActionResult> DeleteProfilePicture()
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        var user   = await _context.Users.FindAsync(userId);
        if (user == null) return NotFound();

        user.ProfilePicture = null;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Profile picture removed" });
    }

    // ── Change Password ───────────────────────────────────────────────────
    [HttpPut("change-password")]
    public IActionResult ChangePassword(ChangePasswordDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var user = _context.Users.FirstOrDefault(u => u.Id == int.Parse(userId));
        if (user == null) return NotFound("User not found");

        if (!BCrypt.Net.BCrypt.Verify(dto.OldPassword, user.PasswordHash))
            return BadRequest("Old password is incorrect");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
        _context.SaveChanges();

        return Ok(new { message = "Password changed successfully" });
    }
}

// ── DTO ───────────────────────────────────────────────────────────────────────
public class ProfilePictureDto
{
    public string Base64Image { get; set; } = null!;
}
