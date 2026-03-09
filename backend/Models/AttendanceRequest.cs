namespace backend.Models
{
    public class AttendanceRequest
    {
        public int Id { get; set; }

        public int UserId { get; set; }

        public DateTime RequestDate { get; set; }

        public string Status { get; set; } = "Pending";

        public User User { get; set; }
    }
}
