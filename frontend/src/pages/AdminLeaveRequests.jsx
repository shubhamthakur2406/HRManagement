import { useEffect, useState, useRef } from "react";
import * as signalR from "@microsoft/signalr";
import axios from "../api/axiosInstance";
import toast, { Toaster } from "react-hot-toast";
import "./AdminLeaveRequests.css";

const BASE_URL  = "https://localhost:7130";
const PAGE_SIZE = 10;

/* ── Reusable pagination bar ── */
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="admin-pagination">
      <button disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>← Prev</button>
      <span>Page {currentPage} of {totalPages}</span>
      <button disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>Next →</button>
    </div>
  );
};

function AdminLeaveRequests() {
  const [leaves, setLeaves]               = useState([]);
  const [users, setUsers]                 = useState([]);
  const [loadingId, setLoadingId]         = useState(null);
  const [activeFilter, setActiveFilter]   = useState("All");
  const [currentPage, setCurrentPage]     = useState(1);
  const [balanceUserId, setBalanceUserId] = useState("");
  const [balanceAmount, setBalanceAmount] = useState("");
  const [settingBalance, setSettingBalance] = useState(false);

  // ── Selected user's current balance ──────────────────────────────
  const [selectedUserBalance, setSelectedUserBalance] = useState(null);
  const [balanceLoading, setBalanceLoading]           = useState(false);

  const token = localStorage.getItem("token");
  const connectionRef = useRef(null);

  const pendingCount  = leaves.filter(l => l.status === "Pending").length;
  const approvedCount = leaves.filter(l => l.status === "Approved").length;
  const rejectedCount = leaves.filter(l => l.status === "Rejected").length;

  const filtered    = leaves.filter(l => activeFilter === "All" || l.status === activeFilter);
  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedLeaves = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleFilterChange = (label) => { setActiveFilter(label); setCurrentPage(1); };

  const getInitials = (name) => { if (!name) return "?"; return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2); };
  const avatarColor = (name) => {
    const colors = ["#4F46E5","#7C3AED","#0891B2","#059669","#D97706","#DC2626","#DB2777"];
    if (!name) return colors[0];
    return colors[name.charCodeAt(0) % colors.length];
  };

  const loadLeaves = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/leave/requests`, { headers: { Authorization: `Bearer ${token}` } });
      const data = res.ok ? await res.json() : [];
      setLeaves(data);
    } catch { toast.error("Failed to load leave requests"); }
  };

  const loadUsers = async () => {
    try {
      const res = await axios.get("/admin/users");
      setUsers(res.data.users || []);
    } catch { console.error("Failed to load users"); }
  };

  // ── Fetch selected user's balance ─────────────────────────────────
  const fetchUserBalance = async (userId) => {
    if (!userId) { setSelectedUserBalance(null); return; }
    setBalanceLoading(true);
    try {
      const res  = await fetch(`${BASE_URL}/api/leave/balance/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = res.ok ? await res.json() : null;
      setSelectedUserBalance(data);
    } catch {
      setSelectedUserBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  };

  const handleUserSelect = (userId) => {
    setBalanceUserId(userId);
    setBalanceAmount("");
    fetchUserBalance(userId);
  };

  useEffect(() => {
    loadLeaves(); loadUsers();
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${BASE_URL}/attendanceHub`, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .build();
    connectionRef.current = connection;
    connection.start().catch(err => console.error(err));
    connection.on("NewLeaveRequest", (leave) => {
      toast.success(`${leave.userName} applied for leave`);
      setLeaves(prev => prev.some(l => l.id === leave.id) ? prev : [leave, ...prev]);
    });
    connection.on("LeaveStatusUpdated", (data) => {
      setLeaves(prev => prev.map(l => l.id === data.id ? { ...l, status: data.status } : l));
    });
    return () => { connection.stop(); };
  }, []);

  const approve = async (id) => {
    setLoadingId(id);
    try {
      const res = await fetch(`${BASE_URL}/api/leave/approve/${id}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "Approval failed"); return; }
      toast.success("Leave approved");
    } catch { toast.error("Server error"); }
    setLoadingId(null);
  };

  const reject = async (id) => {
    setLoadingId(id);
    try {
      const res = await fetch(`${BASE_URL}/api/leave/reject/${id}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "Rejection failed"); return; }
      toast.success("Leave rejected and balance restored");
    } catch { toast.error("Server error"); }
    setLoadingId(null);
  };

  // ── Shared balance update handler (set / add / subtract) ──────────
  const updateBalance = async (action) => {
    if (!balanceUserId)  { toast.error("Select a user first"); return; }
    if (!balanceAmount)  { toast.error("Enter number of days"); return; }
    const days = parseInt(balanceAmount);
    if (isNaN(days) || days <= 0) { toast.error("Days must be a positive number"); return; }

    setSettingBalance(true);
    try {
      const res = await fetch(`${BASE_URL}/api/leave/set-balance`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ userId: parseInt(balanceUserId), days, action })
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "Failed to update balance"); return; }

      const actionLabel = action === "add" ? "added to" : action === "subtract" ? "subtracted from" : "set for";
      toast.success(`Leave balance ${actionLabel} user — notified in real time`);

      // Refresh chips
      await fetchUserBalance(balanceUserId);
      setBalanceAmount("");
    } catch { toast.error("Server error"); }
    setSettingBalance(false);
  };

  const formatDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const ActionButtons = ({ l }) => (
    <>
      {l.status === "Pending" && (
        <>
          <button className="btn-approve" disabled={loadingId === l.id} onClick={() => approve(l.id)}>{loadingId === l.id ? "..." : "Approve"}</button>
          <button className="btn-reject"  disabled={loadingId === l.id} onClick={() => reject(l.id)}>Reject</button>
        </>
      )}
      {l.status === "Approved" && (
        <button className="btn-reject" disabled={loadingId === l.id} onClick={() => reject(l.id)}>{loadingId === l.id ? "..." : "Reject"}</button>
      )}
      {l.status === "Rejected" && <span className="action-done">—</span>}
    </>
  );

  const selectedUserName = users.find(u => u.id === parseInt(balanceUserId))?.fullName || "";

  return (
    <div className="leave-admin-page">
      <Toaster position="top-right" />
      <h2>Leave Requests</h2>

      {/* ── Manage Leave Balance ── */}
      <div className="leave-balance-card">
        <h3>Manage Leave Balance</h3>
        <p>Set, add, or subtract annual leave days for a user. The user will be notified instantly.</p>

        <div className="leave-balance-row">
          <select
            value={balanceUserId}
            onChange={e => handleUserSelect(e.target.value)}
            className="leave-balance-select"
          >
            <option value="">Select User</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>

          <input
            type="number"
            placeholder="Days (e.g. 5)"
            value={balanceAmount}
            onChange={e => setBalanceAmount(e.target.value)}
            className="leave-balance-input"
            min="1"
          />

          {/* Three action buttons */}
          <div className="balance-action-btns">
            <button
              className="leave-balance-btn balance-btn-set"
              onClick={() => updateBalance("set")}
              disabled={settingBalance}
              title="Set total leaves to this exact number"
            >
              Set
            </button>
            <button
              className="leave-balance-btn balance-btn-add"
              onClick={() => updateBalance("add")}
              disabled={settingBalance}
              title="Add days to current total"
            >
              + Add
            </button>
            <button
              className="leave-balance-btn balance-btn-subtract"
              onClick={() => updateBalance("subtract")}
              disabled={settingBalance}
              title="Subtract days from current total"
            >
              − Subtract
            </button>
          </div>
        </div>

        {/* ── User balance preview ── */}
        {balanceUserId && (
          <div className="user-balance-preview">
            {balanceLoading ? (
              <span className="balance-loading">Loading balance...</span>
            ) : selectedUserBalance ? (
              <>
                <span className="balance-preview-label">
                  Current balance for <strong>{selectedUserName}</strong>:
                </span>
                <div className="balance-chips">
                  <div className="balance-chip balance-chip-total">
                    <span className="chip-value">{selectedUserBalance.totalLeaves}</span>
                    <span className="chip-label">Total</span>
                  </div>
                  <div className="balance-chip balance-chip-used">
                    <span className="chip-value">{selectedUserBalance.usedLeaves}</span>
                    <span className="chip-label">Used</span>
                  </div>
                  <div className="balance-chip balance-chip-remaining">
                    <span className="chip-value">{selectedUserBalance.remainingLeaves}</span>
                    <span className="chip-label">Remaining</span>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs">
        {[{ label: "All", count: leaves.length }, { label: "Pending", count: pendingCount },
          { label: "Approved", count: approvedCount }, { label: "Rejected", count: rejectedCount }]
          .map(tab => (
            <button key={tab.label}
              className={`filter-tab ${activeFilter === tab.label ? `filter-tab-active filter-tab-${tab.label.toLowerCase()}` : ""}`}
              onClick={() => handleFilterChange(tab.label)}>
              {tab.label}<span className="filter-tab-count">{tab.count}</span>
            </button>
          ))}
      </div>

      {/* ── DESKTOP: Table ── */}
      <div className="leave-table-wrapper">
        <table className="leave-table">
          <thead>
            <tr>
              <th>Employee</th><th>From</th><th>To</th><th>Days</th>
              <th>Reason</th><th>Applied On</th><th>Status</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pagedLeaves.length === 0 && (
              <tr><td colSpan="8" className="no-data">No {activeFilter !== "All" ? activeFilter.toLowerCase() : ""} leave requests</td></tr>
            )}
            {pagedLeaves.map(l => (
              <tr key={l.id}>
                <td>
                  <div className="user-cell">
                    <div className="user-avatar" style={{ background: l.profilePicture ? "transparent" : avatarColor(l.userName) }}>
                      {l.profilePicture ? <img src={l.profilePicture} alt={l.userName} className="avatar-table-img" /> : getInitials(l.userName)}
                    </div>
                    <span>{l.userName}</span>
                  </div>
                </td>
                <td>{formatDate(l.fromDate)}</td>
                <td>{formatDate(l.toDate)}</td>
                <td><span className="days-badge">{l.days}d</span></td>
                <td className="reason-cell" title={l.reason}>{l.reason}</td>
                <td className="date-cell">{formatDate(l.createdAt)}</td>
                <td><span className={`status-badge ${l.status?.toLowerCase()}`}>{l.status}</span></td>
                <td><ActionButtons l={l} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── MOBILE: Cards ── */}
      <div className="leave-cards">
        {pagedLeaves.length === 0 && <div className="no-data">No {activeFilter !== "All" ? activeFilter.toLowerCase() : ""} leave requests</div>}
        {pagedLeaves.map(l => (
          <div key={l.id} className="leave-card">
            <div className="leave-card-header">
              <div className="leave-card-user">
                <div className="user-avatar" style={{ background: l.profilePicture ? "transparent" : avatarColor(l.userName) }}>
                  {l.profilePicture ? <img src={l.profilePicture} alt={l.userName} className="avatar-table-img" /> : getInitials(l.userName)}
                </div>
                <span>{l.userName}</span>
              </div>
              <span className={`status-badge ${l.status?.toLowerCase()}`}>{l.status}</span>
            </div>
            <div className="leave-card-body">
              <div className="leave-card-field"><span className="leave-card-label">From</span><span className="leave-card-value">{formatDate(l.fromDate)}</span></div>
              <div className="leave-card-field"><span className="leave-card-label">To</span><span className="leave-card-value">{formatDate(l.toDate)}</span></div>
              <div className="leave-card-field"><span className="leave-card-label">Days</span><span className="leave-card-value"><span className="days-badge">{l.days}d</span></span></div>
              <div className="leave-card-field"><span className="leave-card-label">Applied On</span><span className="leave-card-value">{formatDate(l.createdAt)}</span></div>
            </div>
            <div className="leave-card-reason">{l.reason}</div>
            <div className="leave-card-footer">
              <div className="leave-card-actions"><ActionButtons l={l} /></div>
            </div>
          </div>
        ))}
      </div>

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      {filtered.length > 0 && (
        <p className="admin-page-info">
          Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} requests
        </p>
      )}
    </div>
  );
}

export default AdminLeaveRequests;
