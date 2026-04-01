import { useEffect, useState, useRef } from "react";
import * as signalR from "@microsoft/signalr";
import "./UserPayroll.css";

const BASE_URL = "https://localhost:7130";

const fmt = (n) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const monthLabel = (m) => {
  if (!m) return "";
  const [y, mo] = m.split("-");
  return new Date(y, mo - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};

export default function UserPayroll() {
  const token = localStorage.getItem("token");
  const [payrolls, setPayrolls]         = useState([]);
  const [selected, setSelected]         = useState(null);  // currently viewed payroll
  const [loading, setLoading]           = useState(true);
  const connectionRef                   = useRef(null);
  const slipRef                         = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${BASE_URL}/api/payroll/my`, { headers: { Authorization: `Bearer ${token}` } });
      const data = res.ok ? await res.json() : [];
      setPayrolls(data);
      if (data.length > 0) setSelected(data[0]);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();

    // ── SignalR ────────────────────────────────────────────────────
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${BASE_URL}/attendanceHub`, { accessTokenFactory: () => localStorage.getItem("token") })
      .withAutomaticReconnect()
      .build();

    connectionRef.current = conn;
    conn.start().catch(() => {});

    conn.on("PayrollUpdated", (p) => {
      setPayrolls(prev => {
        const idx = prev.findIndex(x => x.id === p.id);
        const next = idx >= 0 ? prev.map(x => x.id === p.id ? p : x) : [p, ...prev];
        // Keep sorted by month descending
        next.sort((a, b) => b.month.localeCompare(a.month));
        return next;
      });
      setSelected(prev => prev?.id === p.id ? p : prev);
    });

    conn.on("PayrollReverted", ({ id }) => {
      // Payroll went back to draft — remove from user view
      setPayrolls(prev => {
        const updated = prev.filter(x => x.id !== id);
        return updated;
      });
      setSelected(prev => {
        if (prev?.id === id) return null;
        return prev;
      });
    });

    conn.on("PayrollDeleted", ({ id }) => {
      setPayrolls(prev => {
        const updated = prev.filter(x => x.id !== id);
        return updated;
      });
      setSelected(prev => prev?.id === id ? null : prev);
    });

    return () => { conn.stop(); };
  }, []);

  // ── PDF generation using browser print ───────────────────────────
  const handleDownloadPDF = () => {
    if (!selected) return;
    const printContent = document.getElementById("salary-slip-print");
    const originalTitle = document.title;
    document.title = `Salary_Slip_${selected.userName?.replace(/ /g, "_")}_${selected.month}`;

    const printWindow = window.open("", "_blank", "width=800,height=600");
    printWindow.document.write(`
      <html>
        <head>
          <title>${document.title}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: "Segoe UI", Arial, sans-serif; padding: 40px; color: #111827; background: #fff; }
            .slip-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #4F46E5; }
            .slip-company { font-size: 22px; font-weight: 800; color: #4F46E5; margin-bottom: 4px; }
            .slip-doc-title { font-size: 14px; color: #6B7280; }
            .slip-month-box { text-align: right; }
            .slip-month-label { font-size: 14px; font-weight: 700; color: #1E1B4B; }
            .slip-month-val { font-size: 13px; color: #6B7280; }
            .slip-employee { background: #F5F7FF; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
            .slip-emp-field label { font-size: 11px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.4px; display: block; margin-bottom: 3px; }
            .slip-emp-field span { font-size: 14px; font-weight: 600; color: #1E1B4B; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            thead { background: #4F46E5; }
            thead th { color: white; padding: 10px 14px; text-align: left; font-size: 13px; }
            tbody td { padding: 10px 14px; border-bottom: 1px solid #EEF2FF; font-size: 13px; }
            tbody tr:nth-child(even) { background: #F9FAFB; }
            .amount-col { text-align: right; font-variant-numeric: tabular-nums; }
            .net-salary-box { background: linear-gradient(135deg, #4F46E5, #6366F1); color: white; border-radius: 12px; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
            .net-label { font-size: 15px; font-weight: 600; }
            .net-value { font-size: 24px; font-weight: 800; }
            .slip-footer { text-align: center; margin-top: 32px; font-size: 12px; color: #9CA3AF; border-top: 1px solid #E5E7EB; padding-top: 16px; }
          </style>
        </head>
        <body>
          <div class="slip-header">
            <div>
              <div class="slip-company">Sahayog HRMS</div>
              <div class="slip-doc-title">Salary Slip</div>
            </div>
            <div class="slip-month-box">
              <div class="slip-month-label">${monthLabel(selected.month)}</div>
              <div class="slip-month-val">Pay Period</div>
            </div>
          </div>

          <div class="slip-employee">
            <div class="slip-emp-field"><label>Employee Name</label><span>${selected.userName}</span></div>
            <div class="slip-emp-field"><label>Department</label><span>${selected.departmentName || "—"}</span></div>
            <div class="slip-emp-field"><label>Month</label><span>${monthLabel(selected.month)}</span></div>
          </div>

          <table>
            <thead><tr><th>Earnings</th><th class="amount-col">Amount</th></tr></thead>
            <tbody>
              <tr><td>Basic Salary</td><td class="amount-col">${fmt(selected.basicSalary)}</td></tr>
              <tr><td>House Rent Allowance</td><td class="amount-col">${fmt(selected.houseRentAllowance)}</td></tr>
              <tr><td>Travel Allowance</td><td class="amount-col">${fmt(selected.travelAllowance)}</td></tr>
              <tr><td>Medical Allowance</td><td class="amount-col">${fmt(selected.medicalAllowance)}</td></tr>
              <tr><td>Other Allowances</td><td class="amount-col">${fmt(selected.otherAllowances)}</td></tr>
              <tr style="font-weight:700;background:#EEF2FF"><td>Gross Salary</td><td class="amount-col">${fmt(selected.grossSalary)}</td></tr>
            </tbody>
          </table>

          <table>
            <thead><tr><th>Deductions</th><th class="amount-col">Amount</th></tr></thead>
            <tbody>
              <tr><td>Provident Fund (PF)</td><td class="amount-col">${fmt(selected.providentFund)}</td></tr>
              <tr><td>Tax Deduction (TDS)</td><td class="amount-col">${fmt(selected.taxDeduction)}</td></tr>
              <tr><td>Other Deductions</td><td class="amount-col">${fmt(selected.otherDeductions)}</td></tr>
              <tr style="font-weight:700;background:#FEE2E2"><td>Total Deductions</td><td class="amount-col">${fmt(selected.totalDeductions)}</td></tr>
            </tbody>
          </table>

          <div class="net-salary-box">
            <span class="net-label">Net Salary (Take Home)</span>
            <span class="net-value">${fmt(selected.netSalary)}</span>
          </div>

          <div class="slip-footer">
            This is a computer-generated salary slip and does not require a signature.<br/>
            Generated on ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
    document.title = originalTitle;
  };

  if (loading) {
    return (
      <div className="payroll-user-page">
        <div className="payroll-loading">Loading your payroll...</div>
      </div>
    );
  }

  if (payrolls.length === 0) {
    return (
      <div className="payroll-user-page">
        <h2>My Payroll</h2>
        <div className="payroll-empty">
          <div className="payroll-empty-icon">💼</div>
          <p>No payroll records available yet.</p>
          <span>Your salary details will appear here once the admin finalizes them.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="payroll-user-page">
      <div className="payroll-user-header">
        <h2>My Payroll</h2>
        <p className="payroll-user-sub">View your salary breakdown. Select a month to see details.</p>
      </div>

      <div className="payroll-user-layout">

        {/* ── Left: Month list ────────────────────────────────────── */}
        <div className="payroll-month-list">
          <p className="payroll-month-list-title">Pay History</p>
          {payrolls.map(p => (
            <button
              key={p.id}
              className={`payroll-month-item ${selected?.id === p.id ? "payroll-month-item-active" : ""}`}
              onClick={() => setSelected(p)}
            >
              <div>
                <div className="payroll-month-name">{monthLabel(p.month)}</div>
                <div className="payroll-month-net">{fmt(p.netSalary)}</div>
              </div>
              <svg viewBox="0 0 20 20" fill="currentColor" className="payroll-month-arrow">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
              </svg>
            </button>
          ))}
        </div>

        {/* ── Right: Salary slip ──────────────────────────────────── */}
        {selected && (
          <div className="salary-slip" id="salary-slip-print" ref={slipRef}>

            {/* Slip header */}
            <div className="slip-top">
              <div className="slip-top-left">
                <div className="slip-company-name">Sahayog HRMS</div>
                <div className="slip-doc-label">Salary Slip</div>
              </div>
              <div className="slip-top-right">
                <div className="slip-month-big">{monthLabel(selected.month)}</div>
                <button className="btn-download-pdf" onClick={handleDownloadPDF}>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="pdf-icon">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/>
                  </svg>
                  Download PDF
                </button>
              </div>
            </div>

            {/* Employee info */}
            <div className="slip-employee-info">
              <div className="slip-emp-field">
                <label>Employee Name</label>
                <span>{selected.userName}</span>
              </div>
              <div className="slip-emp-field">
                <label>Department</label>
                <span>{selected.departmentName || "—"}</span>
              </div>
              <div className="slip-emp-field">
                <label>Pay Period</label>
                <span>{monthLabel(selected.month)}</span>
              </div>
            </div>

            {/* Earnings & Deductions tables */}
            <div className="slip-tables">
              {/* Earnings */}
              <div className="slip-table-wrap">
                <div className="slip-table-header earnings-header">💰 Earnings</div>
                <table className="slip-table">
                  <tbody>
                    {[
                      ["Basic Salary",          selected.basicSalary],
                      ["House Rent Allowance",  selected.houseRentAllowance],
                      ["Travel Allowance",      selected.travelAllowance],
                      ["Medical Allowance",     selected.medicalAllowance],
                      ["Other Allowances",      selected.otherAllowances],
                    ].map(([label, value]) => (
                      <tr key={label}>
                        <td>{label}</td>
                        <td className="slip-amount">{fmt(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="slip-subtotal">
                      <td>Gross Salary</td>
                      <td className="slip-amount slip-gross">{fmt(selected.grossSalary)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Deductions */}
              <div className="slip-table-wrap">
                <div className="slip-table-header deductions-header">📉 Deductions</div>
                <table className="slip-table">
                  <tbody>
                    {[
                      ["Provident Fund (PF)",  selected.providentFund],
                      ["Tax Deduction (TDS)",  selected.taxDeduction],
                      ["Other Deductions",     selected.otherDeductions],
                    ].map(([label, value]) => (
                      <tr key={label}>
                        <td>{label}</td>
                        <td className="slip-amount slip-deduction-val">− {fmt(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="slip-subtotal">
                      <td>Total Deductions</td>
                      <td className="slip-amount slip-deduction-val">{fmt(selected.totalDeductions)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Net salary banner */}
            <div className="slip-net-banner">
              <span className="slip-net-label">Net Salary (Take Home)</span>
              <span className="slip-net-value">{fmt(selected.netSalary)}</span>
            </div>

            <p className="slip-footer-note">
              This is a computer-generated salary slip and does not require a signature.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
