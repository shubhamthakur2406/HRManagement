namespace backend.Models
{
    public class NotificationUser
    {
        public int Id { get; set; }
        public int NotificationId { get; set; }
        public int UserId { get; set; }

        public Notification Notification { get; set; }
    }
}
