import { useEffect, useState } from "react";
import * as signalR from "@microsoft/signalr";
import Calendar from "react-calendar";
import toast, { Toaster } from "react-hot-toast";
import "react-calendar/dist/Calendar.css";
import "./Attendance.css";

const BASE_URL = "https://localhost:7130";

const UserAttendance = () => {

const todayString = new Date().toLocaleDateString("en-CA");

const [attendanceRecords, setAttendanceRecords] = useState({});
const [leaveRecords, setLeaveRecords]           = useState({});
const [selectedDate, setSelectedDate]           = useState(todayString);
const [selectedStatus, setSelectedStatus]       = useState("Not Marked");

const [showAttModal, setShowAttModal]     = useState(false);
const [showLeaveModal, setShowLeaveModal] = useState(false);
const [reason, setReason]                 = useState("");
const [leaveFrom, setLeaveFrom]           = useState("");
const [leaveTo, setLeaveTo]               = useState("");
const [leaveReason, setLeaveReason]       = useState("");
const [leaveBalance, setLeaveBalance]     = useState({ totalLeaves: 0, usedLeaves: 0, remainingLeaves: 0 });

const token   = localStorage.getItem("token");
const isToday = selectedDate === todayString;

/* ================= MONTHLY STATS ================= */
const currentMonth = new Date().toLocaleDateString("en-CA").slice(0, 7);
const monthStats = Object.entries(attendanceRecords).reduce(
  (acc, [date, status]) => {
    if (date.startsWith(currentMonth)) {
      if (status === "Approved") acc.approved++;
      else if (status === "Pending") acc.pending++;
      else if (status === "Rejected") acc.rejected++;
    }
    return acc;
  },
  { approved: 0, pending: 0, rejected: 0 }
);

/* ================= LOAD ATTENDANCE ================= */
const loadAttendance = async () => {
  try {
    const res  = await fetch(`${BASE_URL}/api/attendance/my-attendance`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const map  = {};
    data.records?.forEach(r => {
      const date = new Date(r.date).toLocaleDateString("en-CA");
      map[date] = r.status;
    });
    setAttendanceRecords(map);
    if (map[selectedDate]) setSelectedStatus(map[selectedDate]);
  } catch { console.log("Failed to load attendance"); }
};

/* ================= LOAD LEAVES ================= */
const loadLeaves = async () => {
  try {
    const [leavesRes, balanceRes] = await Promise.all([
      fetch(`${BASE_URL}/api/leave/my-leaves`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${BASE_URL}/api/leave/balance`,   { headers: { Authorization: `Bearer ${token}` } })
    ]);
    const leavesData  = leavesRes.ok  ? await leavesRes.json()  : [];
    const balanceData = balanceRes.ok ? await balanceRes.json() : { totalLeaves: 0, usedLeaves: 0, remainingLeaves: 0 };

    const leaveMap = {};
    leavesData.forEach(l => {
      if (l.status === "Rejected") return;
      let cur = new Date(l.fromDate);
      const end = new Date(l.toDate);
      while (cur <= end) {
        leaveMap[cur.toLocaleDateString("en-CA")] = l.status;
        cur.setDate(cur.getDate() + 1);
      }
    });
    setLeaveRecords(leaveMap);
    setLeaveBalance(balanceData);
  } catch { console.log("Failed to load leaves"); }
};

/* ================= Helper: update leave date range in state ================= */
const updateLeaveRange = (fromDate, toDate, status) => {
  setLeaveRecords(prev => {
    const updated = { ...prev };
    let cur = new Date(fromDate);
    const end = new Date(toDate);
    while (cur <= end) {
      const key = cur.toLocaleDateString("en-CA");
      if (status === "Rejected") {
        delete updated[key];
      } else {
        updated[key] = status;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return updated;
  });
};

/* ================= SIGNALR ================= */
useEffect(() => {
  loadAttendance();
  loadLeaves();

  const connection = new signalR.HubConnectionBuilder()
    .withUrl(`${BASE_URL}/attendanceHub`, { accessTokenFactory: () => token })
    .withAutomaticReconnect()
    .build();

  connection.start()
    .then(() => console.log("✅ User AttendanceHub Connected"))
    .catch(err => console.log(err));

  connection.on("AttendanceApproved", (data) => {
    const date = new Date(data.date).toLocaleDateString("en-CA");
    toast.success(`Attendance approved for ${date}`);
    setAttendanceRecords(prev => {
      const updated = { ...prev, [date]: "Approved" };
      if (date === selectedDate) setSelectedStatus("Approved");
      return updated;
    });
  });

  connection.on("AttendanceRejected", (data) => {
    const date = new Date(data.date).toLocaleDateString("en-CA");
    toast.error(`Attendance rejected for ${date}`);
    setAttendanceRecords(prev => {
      const updated = { ...prev, [date]: "Rejected" };
      if (date === selectedDate) setSelectedStatus("Rejected");
      return updated;
    });
  });

  connection.on("LeaveApproved", (data) => {
    toast.success(`Leave approved: ${new Date(data.fromDate).toLocaleDateString()} – ${new Date(data.toDate).toLocaleDateString()}`);
    updateLeaveRange(data.fromDate, data.toDate, "Approved");
  });

  connection.on("LeaveRejected", (data) => {
    toast.error(`Leave rejected: ${new Date(data.fromDate).toLocaleDateString()} – ${new Date(data.toDate).toLocaleDateString()}`);
    updateLeaveRange(data.fromDate, data.toDate, "Rejected");
    setLeaveBalance(prev => ({
      ...prev,
      usedLeaves:      Math.max(0, prev.usedLeaves - data.days),
      remainingLeaves: prev.remainingLeaves + data.days
    }));
  });

  connection.on("LeaveBalanceUpdated", (data) => {
    toast.success("Your leave balance has been updated by admin");
    setLeaveBalance({
      totalLeaves:     data.totalLeaves,
      usedLeaves:      data.usedLeaves,
      remainingLeaves: data.remainingLeaves
    });
  });

  return () => connection.stop();
}, [selectedDate]);

/* ================= ESC KEY ================= */
useEffect(() => {
  const handleEsc = (e) => {
    if (e.key === "Escape") { setShowAttModal(false); setShowLeaveModal(false); }
  };
  window.addEventListener("keydown", handleEsc);
  return () => window.removeEventListener("keydown", handleEsc);
}, []);

/* ================= MARK ATTENDANCE ================= */
const applyAttendance = async () => {
  try {
    const res = await fetch(`${BASE_URL}/api/attendance/mark`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ requestDate: selectedDate, reason: isToday ? "" : reason })
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data || "Failed to mark attendance"); return; }
    toast.success("Attendance request sent");
    setAttendanceRecords(prev => ({ ...prev, [selectedDate]: "Pending" }));
    setSelectedStatus("Pending");
    setShowAttModal(false);
    setReason("");
  } catch { toast.error("Server error"); }
};

/* ================= APPLY LEAVE ================= */
const applyLeave = async () => {
  if (!leaveFrom || !leaveTo || !leaveReason.trim()) {
    toast.error("Please fill all leave fields");
    return;
  }
  try {
    const res  = await fetch(`${BASE_URL}/api/leave/apply`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fromDate: leaveFrom, toDate: leaveTo, reason: leaveReason })
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.message || "Failed to apply leave"); return; }
    toast.success(`Leave applied for ${data.days} working day(s)`);
    setShowLeaveModal(false);
    setLeaveFrom(""); setLeaveTo(""); setLeaveReason("");
    loadLeaves();
  } catch { toast.error("Server error"); }
};

/* ================= DATE FORMAT ================= */
const formatDate = (date) => date.toLocaleDateString("en-CA");

/* ================= CALENDAR TILE CLASS ================= */
const highlightAttendance = ({ date }) => {
  const formatted   = formatDate(date);
  const attStatus   = attendanceRecords[formatted];
  const leaveStatus = leaveRecords[formatted];

  if (attStatus === "Approved")   return "present-day";
  if (attStatus === "Rejected")   return "rejected-day";
  if (attStatus === "Pending")    return "pending-day";
  if (leaveStatus === "Approved") return "leave-approved-day";
  if (leaveStatus === "Pending")  return "leave-pending-day";
  return null;
};

/* ================= CLICK DATE ================= */
const handleDateClick = (date) => {
  const formatted   = formatDate(date);
  const today       = new Date();
  const clickedDate = new Date(formatted);
  const dayOfWeek   = clickedDate.getDay(); // 0 = Sun, 6 = Sat
  const diffDays    = Math.floor((today - clickedDate) / (1000 * 60 * 60 * 24));

  setSelectedDate(formatted);
  if (attendanceRecords[formatted]) {
    setSelectedStatus(attendanceRecords[formatted]);
  } else {
    setSelectedStatus("Not Marked");
  }

  // Future date — no attendance
  if (clickedDate > today) return;

  // Block weekends
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    toast.error("Attendance cannot be marked on weekends");
    return;
  }

  // ✅ Block if date has an approved or pending leave
  const leaveStatus = leaveRecords[formatted];
  if (leaveStatus === "Approved") {
    toast.error("This day is on approved leave — attendance cannot be marked");
    return;
  }
  if (leaveStatus === "Pending") {
    toast.error("This day has a pending leave request — attendance cannot be marked");
    return;
  }

  if (diffDays === 0) {
    if (!attendanceRecords[formatted]) setShowAttModal(true);
    return;
  }
  if (diffDays > 7) { toast.error("You can regularize only last 7 days"); return; }
  if (diffDays > 0 && diffDays <= 7 && !attendanceRecords[formatted]) setShowAttModal(true);
};

/* ================= UI ================= */
return (
<div className="attendance-page">
<Toaster position="top-right"/>

<div className="attendance-page-top">
  <h2>Attendance</h2>
  <button className="btn-apply-leave" onClick={() => setShowLeaveModal(true)}>
    + Apply Leave
  </button>
</div>

{/* Stats */}
<div className="attendance-stats">
  <div className="stat-card stat-approved">
    <span className="stat-number">{monthStats.approved}</span>
    <span className="stat-label">Approved</span>
  </div>
  <div className="stat-card stat-pending">
    <span className="stat-number">{monthStats.pending}</span>
    <span className="stat-label">Pending</span>
  </div>
  <div className="stat-card stat-rejected">
    <span className="stat-number">{monthStats.rejected}</span>
    <span className="stat-label">Rejected</span>
  </div>
  <div className="stat-card stat-leave">
    <span className="stat-number">{leaveBalance.remainingLeaves}</span>
    <span className="stat-label">Leaves Left</span>
    <span className="stat-sub">{leaveBalance.usedLeaves} / {leaveBalance.totalLeaves} used</span>
  </div>
</div>

{/* Calendar */}
<div className="calendar-card">
  <h3>My Attendance Calendar</h3>
  <Calendar
    tileClassName={highlightAttendance}
    onClickDay={handleDateClick}
  />
  <div className="calendar-legend">
    <div className="legend-item"><span className="legend-dot dot-approved"></span>Attendance Approved</div>
    <div className="legend-item"><span className="legend-dot dot-pending"></span>Attendance Pending</div>
    <div className="legend-item"><span className="legend-dot dot-rejected"></span>Attendance Rejected</div>
    <div className="legend-item"><span className="legend-dot dot-leave-approved"></span>Leave Approved</div>
    <div className="legend-item"><span className="legend-dot dot-leave-pending"></span>Leave Pending</div>
  </div>

  {selectedDate && (
    <div className="attendance-info">
      <h4>Selected: {selectedDate}</h4>
      <p className={`status ${selectedStatus.toLowerCase().replace(" ", "-")}`}>{selectedStatus}</p>
    </div>
  )}
</div>

{/* ATTENDANCE MODAL */}
{showAttModal && (
  <div className="modal-overlay" onClick={() => setShowAttModal(false)}>
    <div className="modern-modal" onClick={e => e.stopPropagation()}>
      <h3>{isToday ? "Mark Attendance" : "Regularize Attendance"}</h3>
      <p>Date: {selectedDate}</p>
      {!isToday && (
        <textarea
          placeholder="Enter reason for regularization"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
      )}
      <div className="modal-actions">
        <button className="btn-cancel" onClick={() => setShowAttModal(false)}>Cancel</button>
        <button className="btn-approve" onClick={applyAttendance} disabled={!isToday && !reason}>Submit</button>
      </div>
    </div>
  </div>
)}

{/* LEAVE MODAL */}
{showLeaveModal && (
  <div className="modal-overlay" onClick={() => setShowLeaveModal(false)}>
    <div className="modern-modal leave-modal" onClick={e => e.stopPropagation()}>
      <h3>Apply for Leave</h3>
      <p className="leave-balance-info">
        Remaining Balance: <strong>{leaveBalance.remainingLeaves}</strong> days
      </p>

      <div className="leave-form-row">
        <div className="leave-form-group">
          <label>From Date</label>
          <input
            type="date"
            value={leaveFrom}
            min={todayString}
            onChange={e => setLeaveFrom(e.target.value)}
          />
        </div>
        <div className="leave-form-group">
          <label>To Date</label>
          <input
            type="date"
            value={leaveTo}
            min={leaveFrom || todayString}
            onChange={e => setLeaveTo(e.target.value)}
          />
        </div>
      </div>

      <textarea
        placeholder="Enter reason for leave"
        value={leaveReason}
        onChange={e => setLeaveReason(e.target.value)}
      />

      <div className="modal-actions">
        <button className="btn-cancel" onClick={() => setShowLeaveModal(false)}>Cancel</button>
        <button className="btn-approve" onClick={applyLeave}>Apply</button>
      </div>
    </div>
  </div>
)}

</div>
);
};

export default UserAttendance;
