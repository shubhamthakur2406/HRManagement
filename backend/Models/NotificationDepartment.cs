namespace backend.Models
{
    public class NotificationDepartment
    {
        public int Id { get; set; }
        public int NotificationId { get; set; }
        public int DepartmentId { get; set; }

        public Notification Notification { get; set; }
    }
}
