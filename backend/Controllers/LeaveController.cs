using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace backend.Controllers;

[ApiController]
[Route("api/leave")]
public class LeaveController : ControllerBase
{
    private readonly AuthDbContext _context;
    private readonly IHubContext<AttendanceHub> _hub;

    public LeaveController(AuthDbContext context, IHubContext<AttendanceHub> hub)
    {
        _context = context;
        _hub = hub;
    }

    // ── User: get own balance ─────────────────────────────────────────
    [Authorize(Roles = "User")]
    [HttpGet("balance")]
    public async Task<IActionResult> GetBalance()
    {
        var userId  = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        var balance = await _context.LeaveBalances.FirstOrDefaultAsync(b => b.UserId == userId);

        if (balance == null)
            return Ok(new { totalLeaves = 0, usedLeaves = 0, remainingLeaves = 0 });

        return Ok(new
        {
            totalLeaves     = balance.TotalLeaves,
            usedLeaves      = balance.UsedLeaves,
            remainingLeaves = balance.RemainingLeaves
        });
    }

    // ── Admin: get any user's balance ─────────────────────────────────
    [Authorize(Roles = "Admin")]
    [HttpGet("balance/{userId}")]
    public async Task<IActionResult> GetUserBalance(int userId)
    {
        var balance = await _context.LeaveBalances.FirstOrDefaultAsync(b => b.UserId == userId);

        if (balance == null)
            return Ok(new { totalLeaves = 0, usedLeaves = 0, remainingLeaves = 0 });

        return Ok(new
        {
            totalLeaves     = balance.TotalLeaves,
            usedLeaves      = balance.UsedLeaves,
            remainingLeaves = balance.RemainingLeaves
        });
    }

    // ── User: get own leave history ───────────────────────────────────
    [Authorize(Roles = "User")]
    [HttpGet("my-leaves")]
    public async Task<IActionResult> GetMyLeaves()
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));

        var leaves = await _context.LeaveRequests
            .Where(l => l.UserId == userId)
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new { l.Id, l.FromDate, l.ToDate, l.Reason, l.Days, l.Status, l.CreatedAt })
            .ToListAsync();

        return Ok(leaves);
    }

    // ── User: apply leave ─────────────────────────────────────────────
    [Authorize(Roles = "User")]
    [HttpPost("apply")]
    public async Task<IActionResult> ApplyLeave([FromBody] ApplyLeaveDto dto)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));
        var today  = DateTime.UtcNow.Date;
        var from   = dto.FromDate.Date;
        var to     = dto.ToDate.Date;

        if (from < today)
            return BadRequest(new { message = "Leave from date cannot be in the past" });

        if (to < from)
            return BadRequest(new { message = "To date must be after from date" });

        int days = 0;
        for (var d = from; d <= to; d = d.AddDays(1))
            if (d.DayOfWeek != DayOfWeek.Saturday && d.DayOfWeek != DayOfWeek.Sunday)
                days++;

        if (days == 0)
            return BadRequest(new { message = "Selected range has no working days (Mon–Fri only)" });

        var balance = await _context.LeaveBalances.FirstOrDefaultAsync(b => b.UserId == userId);
        if (balance == null || balance.RemainingLeaves < days)
            return BadRequest(new { message = "Insufficient leave balance" });

        var overlap = await _context.LeaveRequests.AnyAsync(l =>
            l.UserId == userId &&
            l.Status != "Rejected" &&
            l.FromDate.Date <= to &&
            l.ToDate.Date   >= from);

        if (overlap)
            return BadRequest(new { message = "You already have a leave request for this period" });

        balance.UsedLeaves += days;

        var leave = new LeaveRequest
        {
            UserId    = userId,
            FromDate  = from,
            ToDate    = to,
            Reason    = dto.Reason,
            Days      = days,
            Status    = "Pending",
            CreatedAt = DateTime.UtcNow
        };

        _context.LeaveRequests.Add(leave);
        await _context.SaveChangesAsync();

        var user = await _context.Users.FindAsync(userId);

        var leaveData = new
        {
            id             = leave.Id,
            userId         = leave.UserId,
            userName       = user?.FullName,
            profilePicture = user?.ProfilePicture ?? "",
            fromDate       = leave.FromDate,
            toDate         = leave.ToDate,
            reason         = leave.Reason,
            days           = leave.Days,
            status         = leave.Status,
            createdAt      = leave.CreatedAt
        };

        await _hub.Clients.Group("Admins").SendAsync("NewLeaveRequest", leaveData);
        return Ok(new { message = "Leave applied successfully", days });
    }

    // ── Admin: get all leave requests ─────────────────────────────────
    [Authorize(Roles = "Admin")]
    [HttpGet("requests")]
    public async Task<IActionResult> GetAllLeaves()
    {
        var leaves = await _context.LeaveRequests
            .Include(l => l.User)
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new
            {
                l.Id,
                l.UserId,
                userName       = l.User.FullName,
                profilePicture = l.User.ProfilePicture ?? "",
                l.FromDate,
                l.ToDate,
                l.Reason,
                l.Days,
                l.Status,
                l.CreatedAt
            })
            .ToListAsync();

        return Ok(leaves);
    }

    // ── Admin: approve leave ──────────────────────────────────────────
    [Authorize(Roles = "Admin")]
    [HttpPost("approve/{id}")]
    public async Task<IActionResult> ApproveLeave(int id)
    {
        var leave = await _context.LeaveRequests.FindAsync(id);
        if (leave == null) return NotFound();

        if (leave.Status != "Pending")
            return BadRequest(new { message = "Only pending leaves can be approved" });

        leave.Status = "Approved";
        await _context.SaveChangesAsync();

        var leaveData = new { id = leave.Id, status = leave.Status, fromDate = leave.FromDate, toDate = leave.ToDate, days = leave.Days };
        await _hub.Clients.Group("Admins").SendAsync("LeaveStatusUpdated", leaveData);
        await _hub.Clients.Group($"User_{leave.UserId}").SendAsync("LeaveApproved", leaveData);

        return Ok(new { message = "Leave approved" });
    }

    // ── Admin: reject leave ───────────────────────────────────────────
    [Authorize(Roles = "Admin")]
    [HttpPost("reject/{id}")]
    public async Task<IActionResult> RejectLeave(int id)
    {
        var leave = await _context.LeaveRequests.FindAsync(id);
        if (leave == null) return NotFound();

        if (leave.Status == "Rejected")
            return BadRequest(new { message = "Leave is already rejected" });

        leave.Status = "Rejected";

        var balance = await _context.LeaveBalances.FirstOrDefaultAsync(b => b.UserId == leave.UserId);
        if (balance != null)
            balance.UsedLeaves = Math.Max(0, balance.UsedLeaves - leave.Days);

        await _context.SaveChangesAsync();

        var leaveData = new { id = leave.Id, status = leave.Status, fromDate = leave.FromDate, toDate = leave.ToDate, days = leave.Days };
        await _hub.Clients.Group("Admins").SendAsync("LeaveStatusUpdated", leaveData);
        await _hub.Clients.Group($"User_{leave.UserId}").SendAsync("LeaveRejected", leaveData);

        return Ok(new { message = "Leave rejected and balance restored" });
    }

    // ── Admin: set balance ────────────────────────────────────────────
    [Authorize(Roles = "Admin")]
    [HttpPost("set-balance")]
    public async Task<IActionResult> SetBalance([FromBody] SetLeaveBalanceDto dto)
    {
        var balance = await _context.LeaveBalances.FirstOrDefaultAsync(b => b.UserId == dto.UserId);

        if (balance == null)
        {
            balance = new LeaveBalance { UserId = dto.UserId, TotalLeaves = dto.TotalLeaves, UsedLeaves = 0 };
            _context.LeaveBalances.Add(balance);
        }
        else
        {
            balance.TotalLeaves = dto.TotalLeaves;
        }

        await _context.SaveChangesAsync();

        await _hub.Clients.Group($"User_{dto.UserId}")
            .SendAsync("LeaveBalanceUpdated", new
            {
                totalLeaves     = balance.TotalLeaves,
                usedLeaves      = balance.UsedLeaves,
                remainingLeaves = balance.RemainingLeaves
            });

        return Ok(new { message = "Leave balance updated" });
    }
}

public class ApplyLeaveDto
{
    public DateTime FromDate { get; set; }
    public DateTime ToDate   { get; set; }
    public string   Reason   { get; set; } = null!;
}

public class SetLeaveBalanceDto
{
    public int UserId      { get; set; }
    public int TotalLeaves { get; set; }
}
