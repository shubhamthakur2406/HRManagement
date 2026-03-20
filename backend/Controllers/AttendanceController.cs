using backend.Data;
using backend.DTOs;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

[Route("api/[controller]")]
[ApiController]
public class AttendanceController : ControllerBase
{
    private readonly AuthDbContext _context;
    private readonly IHubContext<AttendanceHub> _hub;

    public AttendanceController(AuthDbContext context, IHubContext<AttendanceHub> hub)
    {
        _context = context;
        _hub = hub;
    }

    /* ================= USER MARK / REGULARIZE ATTENDANCE ================= */

    [Authorize]
    [HttpPost("mark")]
    public async Task<IActionResult> MarkAttendance([FromBody] AttendanceRequestDto dto)
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (userId == null) return Unauthorized();

        var today       = DateTime.UtcNow.Date;
        var requestDate = dto.RequestDate.Date;

        if (requestDate > today)
            return BadRequest("Future attendance not allowed");

        if (requestDate.DayOfWeek == DayOfWeek.Saturday || requestDate.DayOfWeek == DayOfWeek.Sunday)
            return BadRequest("Attendance cannot be marked on weekends (Saturday / Sunday)");

        if ((today - requestDate).TotalDays > 7)
            return BadRequest("You can regularize only last 7 days");

        // ✅ Block if this date falls within an approved or pending leave
        var hasLeave = await _context.LeaveRequests
            .AnyAsync(l =>
                l.UserId == int.Parse(userId) &&
                (l.Status == "Approved" || l.Status == "Pending") &&
                l.FromDate.Date <= requestDate &&
                l.ToDate.Date   >= requestDate);

        if (hasLeave)
            return BadRequest("Attendance cannot be marked on a leave day");

        var exists = await _context.AttendanceRequests
            .FirstOrDefaultAsync(a =>
                a.UserId == int.Parse(userId) &&
                a.RequestDate == requestDate);

        if (exists != null) return BadRequest("Attendance already requested");

        var attendance = new AttendanceRequest
        {
            UserId      = int.Parse(userId),
            RequestDate = requestDate,
            Reason      = dto.Reason,
            Status      = "Pending"
        };

        _context.AttendanceRequests.Add(attendance);
        await _context.SaveChangesAsync();

        var user = await _context.Users.FindAsync(attendance.UserId);

        var requestData = new
        {
            id             = attendance.Id,
            userId         = attendance.UserId,
            userName       = user?.FullName,
            profilePicture = user?.ProfilePicture ?? "",
            requestDate    = attendance.RequestDate,
            reason         = attendance.Reason,
            status         = attendance.Status
        };

        await _hub.Clients.Group("Admins").SendAsync("NewAttendanceRequest", requestData);
        return Ok(new { message = "Attendance request submitted" });
    }

    /* ================= ADMIN GET REQUESTS ================= */

    [Authorize(Roles = "Admin")]
    [HttpGet("requests")]
    public async Task<IActionResult> GetAttendanceRequests()
    {
        var data = await _context.AttendanceRequests
            .Include(a => a.User)
            .OrderByDescending(a => a.RequestDate)
            .Select(a => new
            {
                a.Id,
                a.UserId,
                userName       = a.User.FullName,
                profilePicture = a.User.ProfilePicture ?? "",
                requestDate    = a.RequestDate,
                reason         = a.Reason,
                status         = a.Status
            })
            .ToListAsync();

        return Ok(data);
    }

    /* ================= ADMIN APPROVE ================= */

    [Authorize(Roles = "Admin")]
    [HttpPost("approve/{id}")]
    public async Task<IActionResult> ApproveAttendance(int id)
    {
        var attendance = await _context.AttendanceRequests
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (attendance == null) return NotFound();

        attendance.Status = "Approved";
        await _context.SaveChangesAsync();

        await _hub.Clients.Group("Admins")
            .SendAsync("AttendanceStatusUpdated", new { id = attendance.Id, status = "Approved" });

        await _hub.Clients.Group($"User_{attendance.UserId}")
            .SendAsync("AttendanceApproved", new { date = attendance.RequestDate });

        return Ok(new { message = "Attendance approved" });
    }

    /* ================= ADMIN REJECT ================= */

    [Authorize(Roles = "Admin")]
    [HttpPost("reject/{id}")]
    public async Task<IActionResult> RejectAttendance(int id)
    {
        var attendance = await _context.AttendanceRequests
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (attendance == null) return NotFound();

        attendance.Status = "Rejected";
        await _context.SaveChangesAsync();

        await _hub.Clients.Group("Admins")
            .SendAsync("AttendanceStatusUpdated", new { id = attendance.Id, status = "Rejected" });

        await _hub.Clients.Group($"User_{attendance.UserId}")
            .SendAsync("AttendanceRejected", new { date = attendance.RequestDate });

        return Ok(new { message = "Attendance rejected" });
    }

    /* ================= USER GET MY ATTENDANCE ================= */

    [Authorize]
    [HttpGet("my-attendance")]
    public async Task<IActionResult> GetMyAttendance()
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (userId == null) return Unauthorized();

        var records = await _context.AttendanceRequests
            .Where(a => a.UserId == int.Parse(userId))
            .Select(a => new
            {
                date   = a.RequestDate.Date,
                status = a.Status,
                reason = a.Reason
            })
            .ToListAsync();

        return Ok(new { records });
    }
}
