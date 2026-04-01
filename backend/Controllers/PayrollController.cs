using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using backend.DTOs;
namespace backend.Controllers;

[ApiController]
[Route("api/payroll")]
public class PayrollController : ControllerBase
{
    private readonly AuthDbContext _context;
    private readonly IHubContext<AttendanceHub> _hub;

    public PayrollController(AuthDbContext context, IHubContext<AttendanceHub> hub)
    {
        _context = context;
        _hub = hub;
    }

    // ── Helper: build response object ────────────────────────────────
    private static object PayrollResponse(Payroll p, string? userName = null, string? profilePicture = null, string? departmentName = null) => new
    {
        id                  = p.Id,
        userId              = p.UserId,
        userName,
        profilePicture,
        departmentName,
        month               = p.Month,
        status              = p.Status,
        basicSalary         = p.BasicSalary,
        houseRentAllowance  = p.HouseRentAllowance,
        travelAllowance     = p.TravelAllowance,
        medicalAllowance    = p.MedicalAllowance,
        otherAllowances     = p.OtherAllowances,
        providentFund       = p.ProvidentFund,
        taxDeduction        = p.TaxDeduction,
        otherDeductions     = p.OtherDeductions,
        grossSalary         = p.GrossSalary,
        totalDeductions     = p.TotalDeductions,
        netSalary           = p.NetSalary,
        updatedAt           = p.UpdatedAt,
        createdAt           = p.CreatedAt,
    };

    // ════════════════════════════════════════════════════════════════
    // ADMIN ENDPOINTS
    // ════════════════════════════════════════════════════════════════

    // ── Admin: Get all payrolls (latest month per user, or by month) ─
    [Authorize(Roles = "Admin")]
    [HttpGet("all")]
    public async Task<IActionResult> GetAllPayrolls([FromQuery] string? month = null)
    {
        // If month supplied filter by it; otherwise return latest per user
        IQueryable<Payroll> query = _context.Payrolls.Include(p => p.User).ThenInclude(u => u.Department);

        if (!string.IsNullOrEmpty(month))
        {
            query = query.Where(p => p.Month == month);
        }
        else
        {
            // Return only the most recent month per user
            var latestMonths = await _context.Payrolls
                .GroupBy(p => p.UserId)
                .Select(g => new { UserId = g.Key, Month = g.Max(p => p.Month) })
                .ToListAsync();

            var pairs = latestMonths.Select(x => (x.UserId, x.Month)).ToList();

            query = query.Where(p => pairs.Select(x => x.UserId).Contains(p.UserId)
                                  && pairs.Any(x => x.UserId == p.UserId && x.Month == p.Month));
        }

        var payrolls = await query.OrderBy(p => p.User.FullName).ToListAsync();

        var result = payrolls.Select(p =>
            PayrollResponse(p, p.User.FullName, p.User.ProfilePicture, p.User.Department?.DepartmentName));

        return Ok(result);
    }

    // ── Admin: Get all months available in the system ────────────────
    [Authorize(Roles = "Admin")]
    [HttpGet("months")]
    public async Task<IActionResult> GetAvailableMonths()
    {
        var months = await _context.Payrolls
            .Select(p => p.Month)
            .Distinct()
            .OrderByDescending(m => m)
            .ToListAsync();
        return Ok(months);
    }

    // ── Admin: Get payroll history for a specific user ───────────────
    [Authorize(Roles = "Admin")]
    [HttpGet("user/{userId}")]
    public async Task<IActionResult> GetUserPayrollHistory(int userId)
    {
        var payrolls = await _context.Payrolls
            .Include(p => p.User).ThenInclude(u => u.Department)
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.Month)
            .ToListAsync();

        var result = payrolls.Select(p =>
            PayrollResponse(p, p.User.FullName, p.User.ProfilePicture, p.User.Department?.DepartmentName));

        return Ok(result);
    }

    // ── Admin: Get specific payroll by id ────────────────────────────
    [Authorize(Roles = "Admin")]
    [HttpGet("{id}")]
    public async Task<IActionResult> GetPayrollById(int id)
    {
        var p = await _context.Payrolls
            .Include(p => p.User).ThenInclude(u => u.Department)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (p == null) return NotFound(new { message = "Payroll record not found" });

        return Ok(PayrollResponse(p, p.User.FullName, p.User.ProfilePicture, p.User.Department?.DepartmentName));
    }

    // ── Admin: Create or update payroll for a user+month ────────────
    [Authorize(Roles = "Admin")]
    [HttpPost("set")]
    public async Task<IActionResult> SetPayroll([FromBody] SetPayrollDto dto)
    {
        if (dto.UserId <= 0) return BadRequest(new { message = "Invalid user" });
        if (string.IsNullOrEmpty(dto.Month)) return BadRequest(new { message = "Month is required (format: YYYY-MM)" });

        var user = await _context.Users
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Id == dto.UserId && !u.IsDeleted);

        if (user == null) return NotFound(new { message = "User not found" });

        // Upsert: find existing or create new
        var payroll = await _context.Payrolls.FirstOrDefaultAsync(p => p.UserId == dto.UserId && p.Month == dto.Month);
        bool isNew = payroll == null;

        if (isNew)
        {
            payroll = new Payroll { UserId = dto.UserId, Month = dto.Month, CreatedAt = DateTime.UtcNow };
            _context.Payrolls.Add(payroll);
        }

        // Update fields
        payroll!.BasicSalary         = dto.BasicSalary;
        payroll.HouseRentAllowance   = dto.HouseRentAllowance;
        payroll.TravelAllowance      = dto.TravelAllowance;
        payroll.MedicalAllowance     = dto.MedicalAllowance;
        payroll.OtherAllowances      = dto.OtherAllowances;
        payroll.ProvidentFund        = dto.ProvidentFund;
        payroll.TaxDeduction         = dto.TaxDeduction;
        payroll.OtherDeductions      = dto.OtherDeductions;
        payroll.Status               = dto.Status ?? payroll.Status;
        payroll.UpdatedAt            = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var response = PayrollResponse(payroll, user.FullName, user.ProfilePicture, user.Department?.DepartmentName);

        // Push real-time update to user only if finalized
        if (payroll.Status == "Finalized")
        {
            await _hub.Clients.Group($"User_{dto.UserId}")
                .SendAsync("PayrollUpdated", response);
        }

        return Ok(response);
    }

    // ── Admin: Finalize a draft payroll ──────────────────────────────
    [Authorize(Roles = "Admin")]
    [HttpPost("finalize/{id}")]
    public async Task<IActionResult> FinalizePayroll(int id)
    {
        var payroll = await _context.Payrolls
            .Include(p => p.User).ThenInclude(u => u.Department)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (payroll == null) return NotFound(new { message = "Payroll not found" });
        if (payroll.Status == "Finalized") return BadRequest(new { message = "Payroll is already finalized" });

        payroll.Status    = "Finalized";
        payroll.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var response = PayrollResponse(payroll, payroll.User.FullName, payroll.User.ProfilePicture, payroll.User.Department?.DepartmentName);

        // Notify the user instantly
        await _hub.Clients.Group($"User_{payroll.UserId}")
            .SendAsync("PayrollUpdated", response);

        return Ok(response);
    }

    // ── Admin: Revert finalized back to draft ────────────────────────
    [Authorize(Roles = "Admin")]
    [HttpPost("draft/{id}")]
    public async Task<IActionResult> RevertToDraft(int id)
    {
        var payroll = await _context.Payrolls.FindAsync(id);
        if (payroll == null) return NotFound(new { message = "Payroll not found" });

        payroll.Status    = "Draft";
        payroll.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // Tell user their payroll is no longer visible
        await _hub.Clients.Group($"User_{payroll.UserId}")
            .SendAsync("PayrollReverted", new { id = payroll.Id, month = payroll.Month });

        return Ok(new { message = "Payroll reverted to draft" });
    }

    // ── Admin: Delete a payroll record ───────────────────────────────
    [Authorize(Roles = "Admin")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeletePayroll(int id)
    {
        var payroll = await _context.Payrolls.FindAsync(id);
        if (payroll == null) return NotFound(new { message = "Payroll not found" });

        _context.Payrolls.Remove(payroll);
        await _context.SaveChangesAsync();

        await _hub.Clients.Group($"User_{payroll.UserId}")
            .SendAsync("PayrollDeleted", new { id = payroll.Id, month = payroll.Month });

        return Ok(new { message = "Payroll deleted" });
    }

    // ════════════════════════════════════════════════════════════════
    // USER ENDPOINTS
    // ════════════════════════════════════════════════════════════════

    // ── User: Get own payroll history (only Finalized) ───────────────
    [Authorize(Roles = "User")]
    [HttpGet("my")]
    public async Task<IActionResult> GetMyPayrolls()
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var payrolls = await _context.Payrolls
            .Include(p => p.User).ThenInclude(u => u.Department)
            .Where(p => p.UserId == userId && p.Status == "Finalized")
            .OrderByDescending(p => p.Month)
            .ToListAsync();

        var result = payrolls.Select(p =>
            PayrollResponse(p, p.User.FullName, p.User.ProfilePicture, p.User.Department?.DepartmentName));

        return Ok(result);
    }

    // ── User: Get specific month payroll ─────────────────────────────
    [Authorize(Roles = "User")]
    [HttpGet("my/{month}")]
    public async Task<IActionResult> GetMyPayrollByMonth(string month)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var payroll = await _context.Payrolls
            .Include(p => p.User).ThenInclude(u => u.Department)
            .FirstOrDefaultAsync(p => p.UserId == userId && p.Month == month && p.Status == "Finalized");

        if (payroll == null) return NotFound(new { message = "Payroll not found or not yet finalized" });

        return Ok(PayrollResponse(payroll, payroll.User.FullName, payroll.User.ProfilePicture, payroll.User.Department?.DepartmentName));
    }
}

