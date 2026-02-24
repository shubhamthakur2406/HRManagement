using backend.Data;
using backend.DTOs;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

    // 🔔 GET NOTIFICATIONS (Dashboard Load)
    [HttpGet("notifications")]
    public IActionResult GetNotifications()
    {
        var notifications = _context.Notifications
            .Where(n => !n.IsDeleted)
            .OrderByDescending(n => n.CreatedAt)
            .Select(n => new
            {
                n.Id,
                n.Title,
                n.Message,
                n.RedirectUrl,
                n.CreatedAt
            })
            .ToList();

        return Ok(notifications);
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
        // ✅ Get logged-in user ID from JWT
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
        // ✅ Get logged-in user ID from JWT
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

    //// 🔔 GET NOTIFICATIONS (USER)
    //[HttpGet("notifications")]
    //public IActionResult GetNotifications()
    //{
    //    var notifications = _context.Notifications
    //        .Where(n => !n.IsDeleted)
    //        .OrderByDescending(n => n.CreatedAt)
    //        .ToList();

    //    return Ok(notifications);
    //}


   
}
