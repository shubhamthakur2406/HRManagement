using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

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

    // ================= USER MARK ATTENDANCE =================

    [Authorize]
    [HttpPost("mark")]
    public async Task<IActionResult> MarkAttendance()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier).Value);

        var today = DateTime.Today;

        var existingRequest = await _context.AttendanceRequests
            .FirstOrDefaultAsync(x => x.UserId == userId && x.RequestDate.Date == today);

        // CASE 1 : Already approved
        if (existingRequest != null && existingRequest.Status == "Approved")
        {
            return BadRequest("Attendance already approved today.");
        }

        // CASE 2 : Request already pending
        if (existingRequest != null && existingRequest.Status == "Pending")
        {
            return BadRequest("Attendance request already pending.");
        }

        // CASE 3 : Reapply after rejection
        if (existingRequest != null && existingRequest.Status == "Rejected")
        {
            existingRequest.Status = "Pending";
            existingRequest.RequestDate = DateTime.Now;

            await _context.SaveChangesAsync();

            await _hub.Clients.Group("Admins")
                .SendAsync("NewAttendanceRequest", existingRequest);

            return Ok(existingRequest);
        }

        // CASE 4 : First request
        var request = new AttendanceRequest
        {
            UserId = userId,
            RequestDate = DateTime.Now,
            Status = "Pending"
        };

        _context.AttendanceRequests.Add(request);

        await _context.SaveChangesAsync();

        await _hub.Clients.Group("Admins")
            .SendAsync("NewAttendanceRequest", request);

        return Ok(request);
    }


    // ================= ADMIN GET ALL REQUESTS =================

    [Authorize(Roles = "Admin")]
    [HttpGet("requests")]
    public async Task<IActionResult> GetRequests()
    {
        var requests = await _context.AttendanceRequests
            .Include(x => x.User)
            .OrderByDescending(x => x.RequestDate)
            .Select(x => new
            {
                x.Id,
                UserName = x.User.FullName,
                x.RequestDate,
                x.Status
            })
            .ToListAsync();

        return Ok(requests);
    }


    // ================= ADMIN APPROVE =================

    [Authorize(Roles = "Admin")]
    [HttpPost("approve/{id}")]
    public async Task<IActionResult> Approve(int id)
    {
        var request = await _context.AttendanceRequests
            .FirstOrDefaultAsync(x => x.Id == id);

        if (request == null)
            return NotFound("Request not found");

        request.Status = "Approved";

        await _context.SaveChangesAsync();

        // REALTIME UPDATE TO USER
        await _hub.Clients.Group($"User_{request.UserId}")
            .SendAsync("AttendanceApproved");

        return Ok(new { message = "Attendance approved" });
    }


    // ================= ADMIN REJECT =================

    [Authorize(Roles = "Admin")]
    [HttpPost("reject/{id}")]
    public async Task<IActionResult> Reject(int id)
    {
        var request = await _context.AttendanceRequests
            .FirstOrDefaultAsync(x => x.Id == id);

        if (request == null)
            return NotFound("Request not found");

        request.Status = "Rejected";

        await _context.SaveChangesAsync();

        // REALTIME UPDATE TO USER
        await _hub.Clients.Group($"User_{request.UserId}")
            .SendAsync("AttendanceRejected");

        return Ok(new { message = "Attendance rejected" });
    }


    // ================= USER ATTENDANCE HISTORY =================
    [Authorize]
    [HttpGet("my-attendance")]
    public IActionResult MyAttendance()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier).Value);

        var records = _context.AttendanceRequests
            .Where(x => x.UserId == userId)
            .Select(x => new
            {
                date = x.RequestDate.Date,
                status = x.Status
            })
            .ToList();

        var todayStatus = _context.AttendanceRequests
            .Where(x => x.UserId == userId && x.RequestDate.Date == DateTime.Today)
            .Select(x => x.Status)
            .FirstOrDefault();

        return Ok(new
        {
            records,
            todayStatus
        });
    }
}