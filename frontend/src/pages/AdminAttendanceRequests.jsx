import { useEffect, useState } from "react";
import * as signalR from "@microsoft/signalr";
import toast, { Toaster } from "react-hot-toast";
import "./Attendance.css";

const AdminAttendanceRequests = () => {

const [requests, setRequests] = useState([]);
const [loadingId, setLoadingId] = useState(null);
const [activeFilter, setActiveFilter] = useState("All");

const token = localStorage.getItem("token");

const pendingCount  = requests.filter(r => !r.status || r.status === "Pending").length;
const approvedCount = requests.filter(r => r.status === "Approved").length;
const rejectedCount = requests.filter(r => r.status === "Rejected").length;

const filteredRequests = requests.filter(r => {
  if (activeFilter === "All")      return true;
  if (activeFilter === "Pending")  return !r.status || r.status === "Pending";
  return r.status === activeFilter;
});

const getInitials = (name) => {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
};

const avatarColor = (name) => {
  const colors = ["#4F46E5","#7C3AED","#0891B2","#059669","#D97706","#DC2626","#DB2777"];
  if (!name) return colors[0];
  return colors[name.charCodeAt(0) % colors.length];
};

/* ================= LOAD REQUESTS ================= */
const loadRequests = async () => {
  try {
    const res = await fetch("https://localhost:7130/api/attendance/requests", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) { toast.error("Failed to fetch attendance requests"); return; }
    const data = await res.json();
    setRequests(data);
  } catch { toast.error("Server error while loading requests"); }
};

/* ================= SIGNALR ================= */
useEffect(() => {
  loadRequests();
  const connection = new signalR.HubConnectionBuilder()
    .withUrl("https://localhost:7130/attendanceHub", { accessTokenFactory: () => token })
    .withAutomaticReconnect()
    .build();

  connection.start()
    .then(() => console.log("Admin SignalR Connected"))
    .catch(err => console.error("SignalR Connection Error:", err));

  connection.on("NewAttendanceRequest", (req) => {
    setRequests(prev => {
      const exists = prev.find(x => x.id === req.id);
      if (exists) return prev;
      return [req, ...prev];
    });
    toast.success(`${req.userName} requested attendance`);
  });

  connection.on("AttendanceStatusUpdated", (data) => {
    setRequests(prev => prev.map(x => x.id === data.id ? { ...x, status: data.status } : x));
  });

  return () => { connection.stop(); };
}, []);

/* ================= APPROVE ================= */
const approve = async (id) => {
  try {
    setLoadingId(id);
    const res = await fetch(`https://localhost:7130/api/attendance/approve/${id}`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) { toast.error("Approval failed"); return; }
    setRequests(prev => prev.map(x => x.id === id ? { ...x, status: "Approved" } : x));
    toast.success("Attendance Approved");
  } catch { toast.error("Server error"); }
  setLoadingId(null);
};

/* ================= REJECT ================= */
const reject = async (id) => {
  try {
    setLoadingId(id);
    const res = await fetch(`https://localhost:7130/api/attendance/reject/${id}`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) { toast.error("Reject failed"); return; }
    setRequests(prev => prev.map(x => x.id === id ? { ...x, status: "Rejected" } : x));
    toast.error("Attendance Rejected");
  } catch { toast.error("Server error"); }
  setLoadingId(null);
};

return (
  <div className="attendance-page">
    <Toaster position="top-right"/>

    {/* Page header */}
    <div className="attendance-page-header" style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"20px" }}>
      <h2 style={{ margin:0 }}>Attendance Requests</h2>
      {pendingCount > 0 && (
        <span className="pending-badge">{pendingCount} Pending</span>
      )}
    </div>

    {/* Status filter tabs */}
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
          onClick={() => setActiveFilter(tab.label)}
        >
          {tab.label}
          <span className="filter-tab-count">{tab.count}</span>
        </button>
      ))}
    </div>

    <div className="attendance-card">
      <table className="attendance-table">
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

          {filteredRequests.length === 0 && (
            <tr><td colSpan="5" className="no-data">No {activeFilter !== "All" ? activeFilter.toLowerCase() : ""} requests</td></tr>
          )}

          {filteredRequests.map(r => (
            <tr key={r.id}>
              <td>
                <div className="user-cell">
                  <div className="user-avatar" style={{ background: avatarColor(r.userName) }}>
                    {getInitials(r.userName)}
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
                  {loadingId === r.id ? "Processing..." : "Approve"}
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
  </div>
);

};

export default AdminAttendanceRequests;
