namespace backend.Models;

public class LeaveBalance
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int TotalLeaves { get; set; } = 0;
    public int UsedLeaves { get; set; } = 0;
    public int RemainingLeaves => TotalLeaves - UsedLeaves;

    public virtual User User { get; set; } = null!;
}
