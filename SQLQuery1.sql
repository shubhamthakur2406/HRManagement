CREATE DATABASE AuthDb;
GO
USE AuthDb;
CREATE TABLE Departments (
    Id INT IDENTITY PRIMARY KEY,
    DepartmentName NVARCHAR(100) NOT NULL
);
CREATE TABLE Users (
    Id INT IDENTITY PRIMARY KEY,
    FullName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(100) UNIQUE NOT NULL,
    PasswordHash NVARCHAR(MAX) NOT NULL,
    Address NVARCHAR(200),
    PhoneNumber NVARCHAR(15),
    DepartmentId INT NOT NULL,
    Role NVARCHAR(20) NOT NULL,
    CONSTRAINT FK_Users_Departments
    FOREIGN KEY (DepartmentId) REFERENCES Departments(Id)
);
INSERT INTO Departments (DepartmentName)
VALUES ('HR'), ('IT'), ('Finance'), ('Sales');
ALTER TABLE Users ADD IsDeleted BIT NOT NULL DEFAULT 0;

CREATE TABLE Notifications (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Title NVARCHAR(200) NOT NULL,
    Message NVARCHAR(1000) NOT NULL,
    RedirectUrl NVARCHAR(500) NULL,
    IsDeleted BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME NOT NULL DEFAULT GETUTCDATE()
);
CREATE TABLE NotificationUsers (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    NotificationId INT NOT NULL,
    UserId INT NOT NULL,
    FOREIGN KEY (NotificationId) REFERENCES Notifications(Id),
    FOREIGN KEY (UserId) REFERENCES Users(Id)
);
CREATE TABLE NotificationDepartments (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    NotificationId INT NOT NULL,
    DepartmentId INT NOT NULL,
    FOREIGN KEY (NotificationId) REFERENCES Notifications(Id),
    FOREIGN KEY (DepartmentId) REFERENCES Departments(Id)
);
ALTER TABLE Notifications ADD SendToAll BIT NOT NULL DEFAULT 0;

CREATE TABLE AttendanceRequests (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL,
    RequestDate DATETIME2 NOT NULL DEFAULT GETDATE(),
    RequestDay AS CAST(RequestDate AS DATE) PERSISTED,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Pending'
);
CREATE UNIQUE INDEX UX_User_RequestDay ON AttendanceRequests(UserId, RequestDay);
ALTER TABLE AttendanceRequests ADD Reason NVARCHAR(500) NULL;

ALTER TABLE Users ADD ReadNotificationIds NVARCHAR(MAX) NULL DEFAULT '';


ALTER TABLE Users ADD ProfilePicture NVARCHAR(MAX) NULL;


CREATE TABLE LeaveBalances (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL UNIQUE,
    TotalLeaves INT NOT NULL DEFAULT 0,
    UsedLeaves INT NOT NULL DEFAULT 0,
    FOREIGN KEY (UserId) REFERENCES Users(Id)
);

CREATE TABLE LeaveRequests (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL,
    FromDate DATE NOT NULL,
    ToDate DATE NOT NULL,
    Reason NVARCHAR(500) NOT NULL,
    Days INT NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Pending',
    CreatedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
    FOREIGN KEY (UserId) REFERENCES Users(Id)
);

