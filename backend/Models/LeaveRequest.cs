namespace backend.Models;

public class LeaveRequest
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public string Reason { get; set; } = null!;
    public int Days { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public virtual User User { get; set; } = null!;
}
