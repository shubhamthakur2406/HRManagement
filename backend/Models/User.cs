using System;
using System.Collections.Generic;

namespace backend.Models;

public partial class User
{
    public int Id { get; set; }

    public string FullName { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public string? Address { get; set; }

    public string? PhoneNumber { get; set; }

    public int DepartmentId { get; set; }

    public string Role { get; set; } = null!;

    public bool IsDeleted { get; set; } = false;

    // Stores comma-separated notification IDs the user has marked as read
    public string? ReadNotificationIds { get; set; } = "";

    // Stores profile picture as Base64 string
    public string? ProfilePicture { get; set; }

    public virtual Department Department { get; set; } = null!;
}
