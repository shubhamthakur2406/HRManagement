namespace backend.Models;

public class Payroll
{
    public int Id { get; set; }
    public int UserId { get; set; }

    // ── Salary components ─────────────────────────────────
    public decimal BasicSalary        { get; set; } = 0;
    public decimal HouseRentAllowance { get; set; } = 0;
    public decimal TravelAllowance    { get; set; } = 0;
    public decimal MedicalAllowance   { get; set; } = 0;
    public decimal OtherAllowances    { get; set; } = 0;

    // ── Deductions ────────────────────────────────────────
    public decimal ProvidentFund      { get; set; } = 0;
    public decimal TaxDeduction       { get; set; } = 0;
    public decimal OtherDeductions    { get; set; } = 0;

    // ── Computed (readonly, not stored in DB) ─────────────
    public decimal GrossSalary    => BasicSalary + HouseRentAllowance + TravelAllowance + MedicalAllowance + OtherAllowances;
    public decimal TotalDeductions => ProvidentFund + TaxDeduction + OtherDeductions;
    public decimal NetSalary      => GrossSalary - TotalDeductions;

    // ── Month & Status ────────────────────────────────────
    // Format: "YYYY-MM" e.g. "2026-03"
    public string Month { get; set; } = null!;

    // "Draft" = only admin can see | "Finalized" = visible to user
    public string Status { get; set; } = "Draft";

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // ── Navigation ────────────────────────────────────────
    public virtual User User { get; set; } = null!;
}
