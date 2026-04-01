namespace backend.DTOs
{
    public class SetPayrollDto
    {
        public int UserId { get; set; }
        public string Month { get; set; } = null!;   // "YYYY-MM"
        public decimal BasicSalary { get; set; }
        public decimal HouseRentAllowance { get; set; }
        public decimal TravelAllowance { get; set; }
        public decimal MedicalAllowance { get; set; }
        public decimal OtherAllowances { get; set; }
        public decimal ProvidentFund { get; set; }
        public decimal TaxDeduction { get; set; }
        public decimal OtherDeductions { get; set; }
        public string? Status { get; set; }   // "Draft" | "Finalized"
    }

}
