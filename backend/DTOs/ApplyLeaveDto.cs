namespace backend.DTOs
{
    public class ApplyLeaveDto
    {

        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
        public string Reason { get; set; } = null!;
    }
}
