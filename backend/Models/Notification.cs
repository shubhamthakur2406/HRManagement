//namespace backend.Models
//{
//    public class Notification
//    {
//        public int Id { get; set; }
//        public string Title { get; set; }
//        public string Message { get; set; }
//        public DateTime CreatedAt { get; set; } = DateTime.Now;
//        public bool IsDeleted { get; set; } = false;
//    }

//}


namespace backend.Models
{
    public class Notification
    {
        public int Id { get; set; }

        public string Title { get; set; }

        public string Message { get; set; }

        public string? RedirectUrl { get; set; }

        public bool IsDeleted { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}