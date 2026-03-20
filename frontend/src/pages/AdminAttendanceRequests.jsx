import { useEffect, useState } from "react";
import * as signalR from "@microsoft/signalr";
import toast, { Toaster } from "react-hot-toast";
import "./Attendance.css";

const BASE_URL    = "https://localhost:7130";
const PAGE_SIZE   = 10;

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

const AdminAttendanceRequests = () => {

  const [requests, setRequests]         = useState([]);
  const [loadingId, setLoadingId]       = useState(null);
  const [activeFilter, setActiveFilter] = useState("All");
  const [currentPage, setCurrentPage]   = useState(1);

  const token = localStorage.getItem("token");

  const pendingCount  = requests.filter(r => !r.status || r.status === "Pending").length;
  const approvedCount = requests.filter(r => r.status === "Approved").length;
  const rejectedCount = requests.filter(r => r.status === "Rejected").length;

  const filteredRequests = requests.filter(r => {
    if (activeFilter === "All")     return true;
    if (activeFilter === "Pending") return !r.status || r.status === "Pending";
    return r.status === activeFilter;
  });

  const totalPages  = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const pagedRequests = filteredRequests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset to page 1 when filter changes
  const handleFilterChange = (label) => { setActiveFilter(label); setCurrentPage(1); };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  };

  const avatarColor = (name) => {
    const colors = ["#4F46E5","#7C3AED","#0891B2","#059669","#D97706","#DC2626","#DB2777"];
    if (!name) return colors[0];
    return colors[name.charCodeAt(0) % colors.length];
  };

  /* ── Load ── */
  const loadRequests = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/attendance/requests`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { toast.error("Failed to fetch attendance requests"); return; }
      const data = await res.json();
      setRequests(data);
    } catch { toast.error("Server error while loading requests"); }
  };

  /* ── SignalR ── */
  useEffect(() => {
    loadRequests();
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${BASE_URL}/attendanceHub`, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .build();

    connection.start().catch(err => console.error("SignalR Connection Error:", err));

    connection.on("NewAttendanceRequest", (req) => {
      setRequests(prev => prev.find(x => x.id === req.id) ? prev : [req, ...prev]);
      toast.success(`${req.userName} requested attendance`);
    });

    connection.on("AttendanceStatusUpdated", (data) => {
      setRequests(prev => prev.map(x => x.id === data.id ? { ...x, status: data.status } : x));
    });

    return () => { connection.stop(); };
  }, []);

  /* ── Approve / Reject ── */
  const approve = async (id) => {
    setLoadingId(id);
    try {
      const res = await fetch(`${BASE_URL}/api/attendance/approve/${id}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { toast.error("Approval failed"); return; }
      setRequests(prev => prev.map(x => x.id === id ? { ...x, status: "Approved" } : x));
      toast.success("Attendance Approved");
    } catch { toast.error("Server error"); }
    setLoadingId(null);
  };

  const reject = async (id) => {
    setLoadingId(id);
    try {
      const res = await fetch(`${BASE_URL}/api/attendance/reject/${id}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { toast.error("Reject failed"); return; }
      setRequests(prev => prev.map(x => x.id === id ? { ...x, status: "Rejected" } : x));
      toast.error("Attendance Rejected");
    } catch { toast.error("Server error"); }
    setLoadingId(null);
  };

  return (
    <div className="attendance-page">
      <Toaster position="top-right"/>

      <div className="attendance-page-header" style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"20px" }}>
        <h2 style={{ margin:0 }}>Attendance Requests</h2>
        {pendingCount > 0 && <span className="pending-badge">{pendingCount} Pending</span>}
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs">
        {[
          { label: "All",      count: requests.length },
          { label: "Pending",  count: pendingCount },
          { label: "Approved", count: approvedCount },
          { label: "Rejected", count: rejectedCount },
        ].map(tab => (
          <button
            key={tab.label}
            className={`filter-tab ${activeFilter === tab.label ? "filter-tab-active" : ""} filter-tab-${tab.label.toLowerCase()}`}
            onClick={() => handleFilterChange(tab.label)}
          >
            {tab.label}
            <span className="filter-tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="attendance-card" style={{ overflowX: "auto" }}>
        <table className="attendance-table" style={{ minWidth: "560px" }}>
          <thead>
            <tr>
              <th>User</th>
              <th>Date</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pagedRequests.length === 0 && (
              <tr><td colSpan="5" className="no-data">No {activeFilter !== "All" ? activeFilter.toLowerCase() : ""} requests</td></tr>
            )}
            {pagedRequests.map(r => (
              <tr key={r.id}>
                <td>
                  <div className="user-cell">
                    <div className="user-avatar" style={{ background: r.profilePicture ? "transparent" : avatarColor(r.userName) }}>
                      {r.profilePicture
                        ? <img src={r.profilePicture} alt={r.userName} className="avatar-table-img" />
                        : getInitials(r.userName)}
                    </div>
                    <span>{r.userName}</span>
                  </div>
                </td>
                <td>{new Date(r.requestDate).toLocaleDateString()}</td>
                <td>{r.reason || "—"}</td>
                <td>
                  <span className={`status-badge ${r.status?.toLowerCase()}`}>
                    {r.status || "Pending"}
                  </span>
                </td>
                <td>
                  <button className="btn-approve" disabled={loadingId === r.id || r.status === "Approved"} onClick={() => approve(r.id)}>
                    {loadingId === r.id ? "..." : "Approve"}
                  </button>
                  <button className="btn-reject" disabled={loadingId === r.id || r.status === "Rejected"} onClick={() => reject(r.id)}>
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      {/* Page info */}
      {filteredRequests.length > 0 && (
        <p className="admin-page-info">
          Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredRequests.length)} of {filteredRequests.length} requests
        </p>
      )}
    </div>
  );
};

export default AdminAttendanceRequests;
