namespace backend.DTOs
{
    public class SetLeaveBalanceDto
    {

        public int UserId { get; set; }
        public int Days { get; set; }       
        public string Action { get; set; } = "set";
        public int TotalLeaves
        {
            get => Days;
            set => Days = value;
        }
    }
}
