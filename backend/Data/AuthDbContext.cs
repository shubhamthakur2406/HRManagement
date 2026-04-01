using System;
using System.Collections.Generic;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Data;

public partial class AuthDbContext : DbContext
{
    public AuthDbContext() { }

    public AuthDbContext(DbContextOptions<AuthDbContext> options)
        : base(options) { }

    public virtual DbSet<Department>             Departments             { get; set; }
    public virtual DbSet<User>                   Users                   { get; set; }
    public virtual DbSet<Notification>           Notifications           { get; set; }
    public virtual DbSet<NotificationUser>       NotificationUsers       { get; set; }
    public virtual DbSet<NotificationDepartment> NotificationDepartments { get; set; }
    public virtual DbSet<AttendanceRequest>      AttendanceRequests      { get; set; }
    public virtual DbSet<LeaveBalance>           LeaveBalances           { get; set; }
    public virtual DbSet<LeaveRequest>           LeaveRequests           { get; set; }
    public virtual DbSet<Payroll>                Payrolls                { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
#warning To protect potentially sensitive information in your connection string, you should move it out of source code.
        => optionsBuilder.UseSqlServer("Server=(localdb)\\MSSQLLocalDB;Database=AuthDb;Trusted_Connection=True;");

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Department>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Departme__3214EC07BCA29537");
            entity.Property(e => e.DepartmentName).HasMaxLength(100);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Users__3214EC0709B5ADF3");
            entity.HasIndex(e => e.Email, "UQ__Users__A9D105341FE0118A").IsUnique();
            entity.Property(e => e.Address).HasMaxLength(200);
            entity.Property(e => e.Email).HasMaxLength(100);
            entity.Property(e => e.FullName).HasMaxLength(100);
            entity.Property(e => e.PhoneNumber).HasMaxLength(15);
            entity.Property(e => e.Role).HasMaxLength(20);
            entity.HasOne(d => d.Department).WithMany(p => p.Users)
                .HasForeignKey(d => d.DepartmentId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Users_Departments");
        });

        modelBuilder.Entity<LeaveBalance>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId).IsUnique();
            entity.Ignore(e => e.RemainingLeaves);
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LeaveRequest>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Status).HasMaxLength(20);
            entity.Property(e => e.Reason).HasMaxLength(500);
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Payroll>(entity =>
        {
            entity.HasKey(e => e.Id);

            // One record per user per month
            entity.HasIndex(e => new { e.UserId, e.Month }).IsUnique();

            // Computed properties — not stored in DB
            entity.Ignore(e => e.GrossSalary);
            entity.Ignore(e => e.TotalDeductions);
            entity.Ignore(e => e.NetSalary);

            entity.Property(e => e.BasicSalary).HasColumnType("decimal(18,2)");
            entity.Property(e => e.HouseRentAllowance).HasColumnType("decimal(18,2)");
            entity.Property(e => e.TravelAllowance).HasColumnType("decimal(18,2)");
            entity.Property(e => e.MedicalAllowance).HasColumnType("decimal(18,2)");
            entity.Property(e => e.OtherAllowances).HasColumnType("decimal(18,2)");
            entity.Property(e => e.ProvidentFund).HasColumnType("decimal(18,2)");
            entity.Property(e => e.TaxDeduction).HasColumnType("decimal(18,2)");
            entity.Property(e => e.OtherDeductions).HasColumnType("decimal(18,2)");
            entity.Property(e => e.Month).HasMaxLength(7);   // "YYYY-MM"
            entity.Property(e => e.Status).HasMaxLength(20);

            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
