//using backend.Data;
//using backend.DTOs;
//using backend.Models;
//using Microsoft.AspNetCore.Authorization;
//using Microsoft.AspNetCore.Mvc;
//using Microsoft.AspNetCore.SignalR;
//using Microsoft.EntityFrameworkCore;

//[Route("api/[controller]")]
//[ApiController]
//public class AttendanceController : ControllerBase
//{
//    private readonly AuthDbContext _context;
//    private readonly IHubContext<AttendanceHub> _hub;

//    public AttendanceController(AuthDbContext context, IHubContext<AttendanceHub> hub)
//    {
//        _context = context;
//        _hub = hub;
//    }

//    /* ================= USER MARK ATTENDANCE ================= */

//    //[Authorize]
//    //[HttpPost("mark")]
//    //public async Task<IActionResult> MarkAttendance()
//    //{
//    //    var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

//    //    if (userId == null)
//    //        return Unauthorized();

//    //    var today = DateTime.UtcNow.Date;

//    //    var exists = await _context.AttendanceRequests
//    //        .FirstOrDefaultAsync(a => a.UserId == int.Parse(userId) && a.RequestDate == today);

//    //    if (exists != null)
//    //        return BadRequest("Attendance already requested");

//    //    var attendance = new AttendanceRequest
//    //    {
//    //        UserId = int.Parse(userId),
//    //        RequestDate = today,
//    //        Status = "Pending"
//    //    };

//    //    _context.AttendanceRequests.Add(attendance);
//    //    await _context.SaveChangesAsync();

//    //    /* ===== GET USER NAME ===== */

//    //    var user = await _context.Users.FindAsync(attendance.UserId);

//    //    var requestData = new
//    //    {
//    //        id = attendance.Id,
//    //        userId = attendance.UserId,
//    //        userName = user?.FullName,
//    //        requestDate = attendance.RequestDate,
//    //        status = attendance.Status
//    //    };

//    //    /* ===== REALTIME EVENT FOR ADMIN ===== */

//    //    await _hub.Clients.All.SendAsync("NewAttendanceRequest", requestData);

//    //    return Ok(new { message = "Attendance request sent" });
//    //}

//    [Authorize]
//    [HttpPost("mark")]
//    public async Task<IActionResult> MarkAttendance([FromBody] AttendanceRequestDto dto)
//    {
//        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

//        if (userId == null)
//            return Unauthorized();

//        var today = DateTime.UtcNow.Date;

//        /* BLOCK FUTURE */

//        if (dto.RequestDate.Date > today)
//            return BadRequest("Future attendance not allowed");

//        /* 7 DAY RULE */

//        if ((today - dto.RequestDate.Date).TotalDays > 7)
//            return BadRequest("You can regularize only last 7 days");

//        /* DUPLICATE CHECK */

//        var exists = await _context.AttendanceRequests
//            .FirstOrDefaultAsync(a =>
//                a.UserId == int.Parse(userId) &&
//                a.RequestDate == dto.RequestDate.Date);

//        if (exists != null)
//            return BadRequest("Attendance already requested");

//        var attendance = new AttendanceRequest
//        {
//            UserId = int.Parse(userId),
//            RequestDate = dto.RequestDate.Date,
//            Reason = dto.Reason,
//            Status = "Pending"
//        };

//        _context.AttendanceRequests.Add(attendance);
//        await _context.SaveChangesAsync();

//        /* GET USER NAME */

//        var user = await _context.Users.FindAsync(attendance.UserId);

//        var requestData = new
//        {
//            id = attendance.Id,
//            userId = attendance.UserId,
//            userName = user?.FullName,
//            requestDate = attendance.RequestDate,
//            reason = attendance.Reason,
//            status = attendance.Status
//        };

//        /* SIGNALR ADMIN UPDATE */

//        await _hub.Clients.All.SendAsync("NewAttendanceRequest", requestData);

//        return Ok(new { message = "Attendance request submitted" });
//    }

//    /* ================= ADMIN GET REQUESTS ================= */

//    [Authorize(Roles = "Admin")]
//    [HttpGet("requests")]
//    public async Task<IActionResult> GetAttendanceRequests()
//    {
//        var data = await _context.AttendanceRequests
//            .Include(a => a.User)
//            .OrderByDescending(a => a.RequestDate)
//            .Select(a => new
//            {
//                a.Id,
//                a.UserId,
//                userName = a.User.FullName,
//                requestDate = a.RequestDate,
//                status = a.Status
//            })
//            .ToListAsync();

//        return Ok(data);
//    }

//    /* ================= ADMIN APPROVE ================= */

//    [Authorize(Roles = "Admin")]
//    [HttpPost("approve/{id}")]
//    public async Task<IActionResult> ApproveAttendance(int id)
//    {
//        var attendance = await _context.AttendanceRequests
//            .Include(a => a.User)
//            .FirstOrDefaultAsync(a => a.Id == id);

//        if (attendance == null)
//            return NotFound();

//        attendance.Status = "Approved";

//        await _context.SaveChangesAsync();

//        /* ===== UPDATE ADMIN TABLE REALTIME ===== */

//        await _hub.Clients.All.SendAsync("AttendanceStatusUpdated", new
//        {
//            id = attendance.Id,
//            status = "Approved"
//        });

//        /* ===== NOTIFY USER ===== */

//        await _hub.Clients.Group($"User_{attendance.UserId}")
//        .SendAsync("AttendanceApproved", new
//        {
//            date = attendance.RequestDate
//        });

//        return Ok(new { message = "Attendance approved" });
//    }

//    /* ================= ADMIN REJECT ================= */

//    [Authorize(Roles = "Admin")]
//    [HttpPost("reject/{id}")]
//    public async Task<IActionResult> RejectAttendance(int id)
//    {
//        var attendance = await _context.AttendanceRequests
//            .Include(a => a.User)
//            .FirstOrDefaultAsync(a => a.Id == id);

//        if (attendance == null)
//            return NotFound();

//        attendance.Status = "Rejected";

//        await _context.SaveChangesAsync();

//        /* ===== UPDATE ADMIN TABLE REALTIME ===== */

//        await _hub.Clients.All.SendAsync("AttendanceStatusUpdated", new
//        {
//            id = attendance.Id,
//            status = "Rejected"
//        });

//        /* ===== NOTIFY USER ===== */

//        await _hub.Clients.Group($"User_{attendance.UserId}")
//        .SendAsync("AttendanceRejected", new
//        {
//            date = attendance.RequestDate
//        });

//        return Ok(new { message = "Attendance rejected" });
//    }

//    /* ================= USER GET MY ATTENDANCE ================= */

//    [Authorize]
//    [HttpGet("my-attendance")]
//    public async Task<IActionResult> GetMyAttendance()
//    {
//        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

//        if (userId == null)
//            return Unauthorized();

//        var records = await _context.AttendanceRequests
//            .Where(a => a.UserId == int.Parse(userId))
//            .Select(a => new
//            {
//                date = a.RequestDate.Date,
//                status = a.Status
//            })
//            .ToListAsync();

//        return Ok(new { records });
//    }
//}


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

        if (userId == null)
            return Unauthorized();

        var today = DateTime.UtcNow.Date;

        /* BLOCK FUTURE */

        if (dto.RequestDate.Date > today)
            return BadRequest("Future attendance not allowed");

        /* 7 DAY RULE */

        if ((today - dto.RequestDate.Date).TotalDays > 7)
            return BadRequest("You can regularize only last 7 days");

        /* DUPLICATE CHECK */

        var exists = await _context.AttendanceRequests
            .FirstOrDefaultAsync(a =>
                a.UserId == int.Parse(userId) &&
                a.RequestDate == dto.RequestDate.Date);

        if (exists != null)
            return BadRequest("Attendance already requested");

        var attendance = new AttendanceRequest
        {
            UserId = int.Parse(userId),
            RequestDate = dto.RequestDate.Date,
            Reason = dto.Reason,
            Status = "Pending"
        };

        _context.AttendanceRequests.Add(attendance);
        await _context.SaveChangesAsync();

        /* GET USER NAME */

        var user = await _context.Users.FindAsync(attendance.UserId);

        var requestData = new
        {
            id = attendance.Id,
            userId = attendance.UserId,
            userName = user?.FullName,
            requestDate = attendance.RequestDate,
            reason = attendance.Reason,
            status = attendance.Status
        };

        /* REALTIME UPDATE FOR ADMINS */

        await _hub.Clients.Group("Admins")
            .SendAsync("NewAttendanceRequest", requestData);

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
                userName = a.User.FullName,
                requestDate = a.RequestDate,
                reason = a.Reason,
                status = a.Status
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

        if (attendance == null)
            return NotFound();

        attendance.Status = "Approved";

        await _context.SaveChangesAsync();

        /* UPDATE ADMIN TABLE REALTIME */

        await _hub.Clients.Group("Admins")
            .SendAsync("AttendanceStatusUpdated", new
            {
                id = attendance.Id,
                status = "Approved"
            });

        /* NOTIFY USER */

        await _hub.Clients.Group($"User_{attendance.UserId}")
            .SendAsync("AttendanceApproved", new
            {
                date = attendance.RequestDate
            });

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

        if (attendance == null)
            return NotFound();

        attendance.Status = "Rejected";

        await _context.SaveChangesAsync();

        /* UPDATE ADMIN TABLE REALTIME */

        await _hub.Clients.Group("Admins")
            .SendAsync("AttendanceStatusUpdated", new
            {
                id = attendance.Id,
                status = "Rejected"
            });

        /* NOTIFY USER */

        await _hub.Clients.Group($"User_{attendance.UserId}")
            .SendAsync("AttendanceRejected", new
            {
                date = attendance.RequestDate
            });

        return Ok(new { message = "Attendance rejected" });
    }


    /* ================= USER GET MY ATTENDANCE ================= */

    [Authorize]
    [HttpGet("my-attendance")]
    public async Task<IActionResult> GetMyAttendance()
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

        if (userId == null)
            return Unauthorized();

        var records = await _context.AttendanceRequests
            .Where(a => a.UserId == int.Parse(userId))
            .Select(a => new
            {
                date = a.RequestDate.Date,
                status = a.Status,
                reason = a.Reason
            })
            .ToListAsync();

        return Ok(new { records });
    }
}