import { useEffect, useState, useRef } from "react";
import toast, { Toaster } from "react-hot-toast";
import "./AdminPayroll.css";

const BASE_URL = "https://localhost:7130";

const fmt = (n) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const monthLabel = (m) => {
  if (!m) return "";
  const [y, mo] = m.split("-");
  return new Date(y, mo - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};

// All salary fields stored as STRINGS while typing — only converted to numbers on save
const EMPTY_FORM = {
  basicSalary: "", houseRentAllowance: "", travelAllowance: "",
  medicalAllowance: "", otherAllowances: "",
  providentFund: "", taxDeduction: "", otherDeductions: "",
  status: "Draft",
};

// Convert an existing payroll's numeric values to strings for the form
const payrollToForm = (p) => ({
  basicSalary:        p.basicSalary        != null ? String(p.basicSalary)        : "",
  houseRentAllowance: p.houseRentAllowance != null ? String(p.houseRentAllowance) : "",
  travelAllowance:    p.travelAllowance    != null ? String(p.travelAllowance)    : "",
  medicalAllowance:   p.medicalAllowance   != null ? String(p.medicalAllowance)   : "",
  otherAllowances:    p.otherAllowances    != null ? String(p.otherAllowances)    : "",
  providentFund:      p.providentFund      != null ? String(p.providentFund)      : "",
  taxDeduction:       p.taxDeduction       != null ? String(p.taxDeduction)       : "",
  otherDeductions:    p.otherDeductions    != null ? String(p.otherDeductions)    : "",
  status:             p.status,
});

export default function AdminPayroll() {
  const token = localStorage.getItem("token");
  const [payrolls, setPayrolls]           = useState([]);
  const [users, setUsers]                 = useState([]);
  const [months, setMonths]               = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [editingUserId, setEditingUserId] = useState(null);
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [saving, setSaving]               = useState(false);
  const [search, setSearch]               = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteId, setDeleteId]           = useState(null);
  const [isDeleting, setIsDeleting]       = useState(false);
  const formRef = useRef(null);

  // Live computed values — parse strings to numbers only for display
  const gross = ["basicSalary","houseRentAllowance","travelAllowance","medicalAllowance","otherAllowances"]
    .reduce((s, k) => s + (parseFloat(form[k]) || 0), 0);
  const deductions = ["providentFund","taxDeduction","otherDeductions"]
    .reduce((s, k) => s + (parseFloat(form[k]) || 0), 0);
  const net = gross - deductions;

  const load = async (month) => {
    try {
      const url = `${BASE_URL}/api/payroll/all${month ? `?month=${month}` : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = res.ok ? await res.json() : [];
      setPayrolls(data);
    } catch { toast.error("Failed to load payrolls"); }
  };

  const loadMonths = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/payroll/months`, { headers: { Authorization: `Bearer ${token}` } });
      const data = res.ok ? await res.json() : [];
      setMonths(data);
    } catch {}
  };

  const loadUsers = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/admin/users?pageSize=1000`, { headers: { Authorization: `Bearer ${token}` } });
      const data = res.ok ? await res.json() : { users: [] };
      setUsers(data.users || []);
    } catch {}
  };

  useEffect(() => { load(selectedMonth); loadMonths(); loadUsers(); }, []);
  useEffect(() => { load(selectedMonth); }, [selectedMonth]);

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  };

  const avatarColor = (name) => {
    const colors = ["#4F46E5","#7C3AED","#0891B2","#059669","#D97706","#DC2626","#DB2777"];
    if (!name) return colors[0];
    return colors[name.charCodeAt(0) % colors.length];
  };

  // ── Open edit form ── convert numbers → strings so inputs work smoothly
  const handleEdit = (userId) => {
    const existing = payrolls.find(p => p.userId === userId);
    setEditingUserId(userId);
    setForm(existing ? payrollToForm(existing) : EMPTY_FORM);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const handleCancel = () => { setEditingUserId(null); setForm(EMPTY_FORM); };

  // ── Save — parse strings → numbers only here at submission time
  const handleSave = async (statusOverride) => {
    if (!editingUserId) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/payroll/set`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          userId:             editingUserId,
          month:              selectedMonth,
          basicSalary:        parseFloat(form.basicSalary)        || 0,
          houseRentAllowance: parseFloat(form.houseRentAllowance) || 0,
          travelAllowance:    parseFloat(form.travelAllowance)    || 0,
          medicalAllowance:   parseFloat(form.medicalAllowance)   || 0,
          otherAllowances:    parseFloat(form.otherAllowances)    || 0,
          providentFund:      parseFloat(form.providentFund)      || 0,
          taxDeduction:       parseFloat(form.taxDeduction)       || 0,
          otherDeductions:    parseFloat(form.otherDeductions)    || 0,
          status:             statusOverride || form.status,
        })
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "Save failed"); return; }

      setPayrolls(prev => {
        const idx = prev.findIndex(p => p.userId === editingUserId);
        if (idx >= 0) { const next = [...prev]; next[idx] = data; return next; }
        return [...prev, data];
      });
      loadMonths();
      toast.success(statusOverride === "Finalized" ? "Payroll finalized — employee notified ✅" : "Payroll saved as draft");
      handleCancel();
    } catch { toast.error("Server error"); }
    setSaving(false);
  };

  const handleFinalize = async (id) => {
    try {
      const res = await fetch(`${BASE_URL}/api/payroll/finalize/${id}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "Finalize failed"); return; }
      setPayrolls(prev => prev.map(p => p.id === id ? { ...p, status: "Finalized" } : p));
      toast.success("Payroll finalized — employee notified instantly ✅");
    } catch { toast.error("Server error"); }
  };

  const handleRevertToDraft = async (id) => {
    try {
      const res = await fetch(`${BASE_URL}/api/payroll/draft/${id}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { toast.error("Failed to revert"); return; }
      setPayrolls(prev => prev.map(p => p.id === id ? { ...p, status: "Draft" } : p));
      toast.success("Payroll reverted to draft");
    } catch { toast.error("Server error"); }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/payroll/${deleteId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { toast.error("Delete failed"); return; }
      setPayrolls(prev => prev.filter(p => p.id !== deleteId));
      toast.success("Payroll deleted");
      setShowDeleteConfirm(false); setDeleteId(null);
    } catch { toast.error("Server error"); }
    setIsDeleting(false);
  };

  const userIdsWithPayroll  = new Set(payrolls.map(p => p.userId));
  const usersWithoutPayroll = users.filter(u => !userIdsWithPayroll.has(u.id));
  const filteredPayrolls    = payrolls.filter(p =>
    (p.userName?.toLowerCase().includes(search.toLowerCase()) ||
     p.departmentName?.toLowerCase().includes(search.toLowerCase()))
  );

  const editingUser = users.find(u => u.id === editingUserId);

  // ── FormField uses text input + inputMode="decimal" for smooth UX ──
  const FormField = ({ label, fieldKey }) => (
    <div className="payroll-field">
      <label>{label}</label>
      <div className="payroll-input-wrap">
        <span className="payroll-rupee">₹</span>
        <input
          type="text"
          inputMode="decimal"
          value={form[fieldKey]}
          onChange={e => {
            // Allow only digits, dot, and empty string
            const val = e.target.value;
            if (val === "" || /^\d*\.?\d*$/.test(val)) {
              setForm(f => ({ ...f, [fieldKey]: val }));
            }
          }}
          placeholder="0.00"
          autoComplete="off"
        />
      </div>
    </div>
  );

  return (
    <div className="payroll-page">
      <Toaster position="top-right" />

      {/* Page Header */}
      <div className="payroll-page-header">
        <div>
          <h2>Payroll Management</h2>
          <p className="payroll-subtitle">Set and manage employee salaries. Finalize to make visible to employees.</p>
        </div>
        <div className="payroll-month-picker">
          <label>Select Month</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="payroll-month-input"
          />
        </div>
      </div>

      {/* Edit / Create Form */}
      {editingUserId && (
        <div className="payroll-form-card" ref={formRef}>
          <div className="payroll-form-header">
            <div className="payroll-form-who">
              <div className="user-avatar" style={{ background: editingUser?.profilePicture ? "transparent" : avatarColor(editingUser?.fullName) }}>
                {editingUser?.profilePicture
                  ? <img src={editingUser.profilePicture} alt="" className="avatar-table-img" />
                  : getInitials(editingUser?.fullName)}
              </div>
              <div>
                <strong>{editingUser?.fullName}</strong>
                <span className="payroll-form-month-label">{monthLabel(selectedMonth)}</span>
              </div>
            </div>
            <div className="payroll-status-toggle">
              <button
                className={`status-pill ${form.status === "Draft" ? "status-draft-active" : "status-pill-inactive"}`}
                onClick={() => setForm(f => ({ ...f, status: "Draft" }))}
              >📝 Draft</button>
              <button
                className={`status-pill ${form.status === "Finalized" ? "status-finalized-active" : "status-pill-inactive"}`}
                onClick={() => setForm(f => ({ ...f, status: "Finalized" }))}
              >✅ Finalized</button>
            </div>
          </div>

          <div className="payroll-form-body">
            <div className="payroll-form-section">
              <h4 className="payroll-section-title earnings-title">💰 Earnings</h4>
              <FormField label="Basic Salary"         fieldKey="basicSalary" />
              <FormField label="House Rent Allowance" fieldKey="houseRentAllowance" />
              <FormField label="Travel Allowance"     fieldKey="travelAllowance" />
              <FormField label="Medical Allowance"    fieldKey="medicalAllowance" />
              <FormField label="Other Allowances"     fieldKey="otherAllowances" />
            </div>

            <div className="payroll-form-section">
              <h4 className="payroll-section-title deductions-title">📉 Deductions</h4>
              <FormField label="Provident Fund (PF)"  fieldKey="providentFund" />
              <FormField label="Tax Deduction (TDS)"  fieldKey="taxDeduction" />
              <FormField label="Other Deductions"     fieldKey="otherDeductions" />

              <div className="payroll-live-summary">
                <div className="summary-row">
                  <span>Gross Salary</span>
                  <span className="summary-gross">{fmt(gross)}</span>
                </div>
                <div className="summary-row">
                  <span>Total Deductions</span>
                  <span className="summary-deduction">− {fmt(deductions)}</span>
                </div>
                <div className="summary-divider"/>
                <div className="summary-row summary-net-row">
                  <span>Net Salary</span>
                  <span className="summary-net">{fmt(net)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="payroll-form-footer">
            <button className="btn-payroll-cancel" onClick={handleCancel}>Cancel</button>
            <button className="btn-payroll-draft" onClick={() => handleSave("Draft")} disabled={saving}>
              {saving ? "Saving..." : "Save as Draft"}
            </button>
            <button className="btn-payroll-finalize" onClick={() => handleSave("Finalized")} disabled={saving}>
              {saving ? "Saving..." : "✅ Save & Finalize"}
            </button>
          </div>
        </div>
      )}

      {/* Missing payroll alert */}
      {usersWithoutPayroll.length > 0 && (
        <div className="payroll-missing-card">
          <p className="payroll-missing-title">
            ⚠️ {usersWithoutPayroll.length} employee{usersWithoutPayroll.length > 1 ? "s have" : " has"} no payroll for {monthLabel(selectedMonth)}
          </p>
          <div className="payroll-missing-users">
            {usersWithoutPayroll.map(u => (
              <button key={u.id} className="payroll-missing-btn" onClick={() => handleEdit(u.id)}>
                <div className="user-avatar-xs" style={{ background: u.profilePicture ? "transparent" : avatarColor(u.fullName) }}>
                  {u.profilePicture ? <img src={u.profilePicture} alt="" className="avatar-table-img" /> : getInitials(u.fullName)}
                </div>
                {u.fullName}
                <span className="missing-plus">+</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search + count */}
      <div className="payroll-toolbar">
        <div className="payroll-search-wrap">
          <svg viewBox="0 0 20 20" fill="none" className="payroll-search-icon">
            <circle cx="9" cy="9" r="6" stroke="#9CA3AF" strokeWidth="1.5"/>
            <path d="M13.5 13.5L17 17" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            className="payroll-search"
            placeholder="Search employee or department..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <span className="payroll-count-badge">{payrolls.length} records — {monthLabel(selectedMonth)}</span>
      </div>

      {/* Table */}
      <div className="payroll-table-wrap">
        <table className="payroll-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Basic</th>
              <th>Gross</th>
              <th>Deductions</th>
              <th>Net Salary</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayrolls.length === 0 && (
              <tr><td colSpan="7" className="no-data">No payroll records for {monthLabel(selectedMonth)}</td></tr>
            )}
            {filteredPayrolls.map(p => (
              <tr key={p.id} className={editingUserId === p.userId ? "row-editing" : ""}>
                <td>
                  <div className="user-cell">
                    <div className="user-avatar" style={{ background: p.profilePicture ? "transparent" : avatarColor(p.userName) }}>
                      {p.profilePicture
                        ? <img src={p.profilePicture} alt={p.userName} className="avatar-table-img" />
                        : getInitials(p.userName)}
                    </div>
                    <div>
                      <div className="payroll-emp-name">{p.userName}</div>
                      <div className="payroll-emp-dept">{p.departmentName}</div>
                    </div>
                  </div>
                </td>
                <td className="payroll-amount">{fmt(p.basicSalary)}</td>
                <td className="payroll-amount">{fmt(p.grossSalary)}</td>
                <td className="payroll-amount deduction-col">− {fmt(p.totalDeductions)}</td>
                <td className="payroll-amount net-col">{fmt(p.netSalary)}</td>
                <td>
                  <span className={`payroll-status-pill ${p.status === "Finalized" ? "pill-finalized" : "pill-draft"}`}>
                    {p.status === "Finalized" ? "✅ Finalized" : "📝 Draft"}
                  </span>
                </td>
                <td>
                  <div className="payroll-row-actions">
                    <button className="btn-tbl-edit"     onClick={() => handleEdit(p.userId)}>Edit</button>
                    {p.status === "Draft"     && <button className="btn-tbl-finalize" onClick={() => handleFinalize(p.id)}>Finalize</button>}
                    {p.status === "Finalized" && <button className="btn-tbl-revert"   onClick={() => handleRevertToDraft(p.id)}>Revert</button>}
                    <button className="btn-tbl-delete"   onClick={() => { setDeleteId(p.id); setShowDeleteConfirm(true); }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => !isDeleting && setShowDeleteConfirm(false)}>
          <div className="modern-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">⚠️</div>
            <h3>Delete Payroll</h3>
            <p>This action cannot be undone.<br />Are you sure you want to delete this payroll record?</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? <span className="spinner"/> : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
