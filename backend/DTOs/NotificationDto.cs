using System.ComponentModel.DataAnnotations;

namespace backend.DTOs
{
    //public class NotificationDto
    //{
    //    public string Title { get; set; }
    //    public string Message { get; set; }
    //}

    //public class NotificationDto
    //{
    //    [Required]
    //    [MaxLength(200)]
    //    public string Title { get; set; }

    //    [Required]
    //    [MaxLength(1000)]
    //    public string Message { get; set; }

    //    // Optional: redirect page in frontend
    //    public string? RedirectUrl { get; set; }
    //}

    public class NotificationDto
    {
        public string Title { get; set; }
        public string Message { get; set; }
        public string? RedirectUrl { get; set; }

        public bool SendToAll { get; set; }
        public List<int>? UserIds { get; set; }
        public List<int>? DepartmentIds { get; set; }
    }

}
