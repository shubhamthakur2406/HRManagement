import { useNavigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { useEffect, useState, useRef } from "react";
import * as signalR from "@microsoft/signalr";
import "./Navbar.css";

const BASE_URL = "https://localhost:7130";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("token");

  // ── User state ────────────────────────────────────────────────────
  const [unreadCount, setUnreadCount]       = useState(0);
  const [profilePicture, setProfilePicture] = useState("");
  const [userName, setUserName]             = useState("");

  // ── Admin pending counters ────────────────────────────────────────
  const [attendancePending, setAttendancePending] = useState(0);
  const [leavePending, setLeavePending]           = useState(0);

  const [menuOpen, setMenuOpen] = useState(false);

  const connectionRef    = useRef(null);   // user notification hub
  const adminConnRef     = useRef(null);   // admin attendance hub
  const notificationsRef = useRef([]);
  const readIdsRef       = useRef(new Set());

  // Track pending counts in refs so SignalR callbacks always see latest value
  const attendancePendingRef = useRef(0);
  const leavePendingRef      = useRef(0);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  let role = null;
  if (token) {
    try {
      const decoded = jwtDecode(token);
      role = decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
    } catch { localStorage.removeItem("token"); }
  }

  // ── USER: fetch profile ───────────────────────────────────────────
  useEffect(() => {
    if (role !== "User" || !token) return;
    fetch(`${BASE_URL}/api/user/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setProfilePicture(data.profilePicture || "");
          setUserName(data.fullName || "");
        }
      })
      .catch(() => {});
  }, [role, token]);

  useEffect(() => {
    if (role !== "User") return;
    const handler = (e) => setProfilePicture(e.detail || "");
    window.addEventListener("profile-pic-updated", handler);
    return () => window.removeEventListener("profile-pic-updated", handler);
  }, [role]);

  // ── USER: notifications ───────────────────────────────────────────
  const refreshFromServer = () => {
    if (!token) return;
    Promise.all([
      fetch(`${BASE_URL}/api/user/notifications`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : []),
      fetch(`${BASE_URL}/api/user/read-notifications`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : [])
    ])
      .then(([notifs, readIds]) => {
        notificationsRef.current = notifs;
        readIdsRef.current = new Set(readIds);
        setUnreadCount(notifs.filter(n => !readIdsRef.current.has(n.id)).length);
      })
      .catch(() => {});
  };

  useEffect(() => { if (role !== "User" || !token) return; refreshFromServer(); }, [role, token]);

  useEffect(() => {
    if (role !== "User") return;
    const handleReadUpdated = (e) => {
      const updatedReadIds = new Set(e.detail);
      readIdsRef.current = updatedReadIds;
      setUnreadCount(notificationsRef.current.filter(n => !updatedReadIds.has(n.id)).length);
    };
    window.addEventListener("notif-read-updated", handleReadUpdated);
    return () => window.removeEventListener("notif-read-updated", handleReadUpdated);
  }, [role]);

  useEffect(() => {
    if (role !== "User") return;
    setUnreadCount(notificationsRef.current.filter(n => !readIdsRef.current.has(n.id)).length);
  }, [location.pathname]);

  // ── USER: SignalR notification hub ────────────────────────────────
  useEffect(() => {
    if (role !== "User" || !token) return;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${BASE_URL}/notificationHub`, { accessTokenFactory: () => localStorage.getItem("token") })
      .withAutomaticReconnect()
      .build();
    connectionRef.current = connection;
    connection.start().catch(err => console.error("Navbar SignalR error:", err));

    connection.on("ReceiveNotification", (notification) => {
      const currentIds = new Set(notificationsRef.current.map(n => n.id));
      if (currentIds.has(notification.id)) {
        notificationsRef.current = notificationsRef.current.map(n => n.id === notification.id ? notification : n);
      } else { refreshFromServer(); return; }
      setUnreadCount(notificationsRef.current.filter(n => !readIdsRef.current.has(n.id)).length);
    });

    connection.on("DeleteNotification", (id) => {
      notificationsRef.current = notificationsRef.current.filter(n => n.id !== id);
      setUnreadCount(notificationsRef.current.filter(n => !readIdsRef.current.has(n.id)).length);
    });

    return () => { connection.stop(); };
  }, [role, token]);

  // ── ADMIN: fetch initial pending counts ───────────────────────────
  useEffect(() => {
    if (role !== "Admin" || !token) return;

    // Fetch pending attendance count
    fetch(`${BASE_URL}/api/attendance/requests`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const count = data.filter(r => !r.status || r.status === "Pending").length;
        attendancePendingRef.current = count;
        setAttendancePending(count);
      })
      .catch(() => {});

    // Fetch pending leave count
    fetch(`${BASE_URL}/api/leave/requests`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const count = data.filter(l => l.status === "Pending").length;
        leavePendingRef.current = count;
        setLeavePending(count);
      })
      .catch(() => {});
  }, [role, token]);

  // ── ADMIN: SignalR attendance hub for live pending counters ───────
  useEffect(() => {
    if (role !== "Admin" || !token) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${BASE_URL}/attendanceHub`, { accessTokenFactory: () => localStorage.getItem("token") })
      .withAutomaticReconnect()
      .build();

    adminConnRef.current = connection;
    connection.start().catch(err => console.error("Admin Navbar SignalR error:", err));

    // New attendance request → increment counter
    connection.on("NewAttendanceRequest", () => {
      const next = attendancePendingRef.current + 1;
      attendancePendingRef.current = next;
      setAttendancePending(next);
    });

    // Attendance approved or rejected → decrement if it was pending
    connection.on("AttendanceStatusUpdated", (data) => {
      if (data.status === "Approved" || data.status === "Rejected") {
        const next = Math.max(0, attendancePendingRef.current - 1);
        attendancePendingRef.current = next;
        setAttendancePending(next);
      }
    });

    // New leave request → increment counter
    connection.on("NewLeaveRequest", () => {
      const next = leavePendingRef.current + 1;
      leavePendingRef.current = next;
      setLeavePending(next);
    });

    // Leave approved or rejected → decrement if it was pending
    connection.on("LeaveStatusUpdated", (data) => {
      if (data.status === "Approved" || data.status === "Rejected") {
        const next = Math.max(0, leavePendingRef.current - 1);
        leavePendingRef.current = next;
        setLeavePending(next);
      }
    });

    return () => { connection.stop(); };
  }, [role, token]);

  // ── Clear badge when admin visits the page ────────────────────────
  useEffect(() => {
    if (role !== "Admin") return;
    if (location.pathname === "/admin/attendance-requests") {
      attendancePendingRef.current = 0;
      setAttendancePending(0);
    }
    if (location.pathname === "/admin/leave-requests") {
      leavePendingRef.current = 0;
      setLeavePending(0);
    }
  }, [location.pathname, role]);

  if (!token || !role) return null;

  const logout      = () => { localStorage.removeItem("token"); if (connectionRef.current) connectionRef.current.stop(); if (adminConnRef.current) adminConnRef.current.stop(); navigate("/"); };
  const isActive    = (path) => location.pathname === path;
  const getInitials = (name) => { if (!name) return "?"; return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2); };
  const navTo       = (path) => { navigate(path); setMenuOpen(false); };

  return (
    <nav className="navbar">
      <div className="navbar-container">

        {/* ── Logo ── */}
        <div className="logo" onClick={() => navTo(role === "Admin" ? "/admin/notifications" : "/user")}>
          <div className="logo-icon">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="13" cy="12" r="5" fill="rgba(255,255,255,0.95)"/>
              <path d="M3 30c0-5.523 4.477-9 10-9s10 3.477 10 9" stroke="rgba(255,255,255,0.95)" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="27" cy="12" r="5" fill="rgba(255,255,255,0.55)"/>
              <path d="M17 30c0-5.523 4.477-9 10-9s10 3.477 10 9" stroke="rgba(255,255,255,0.55)" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          Sahayog
        </div>

        {/* ── Right side ── */}
        <div className="navbar-right">

          {/* Nav buttons */}
          <div className={`nav-buttons ${menuOpen ? "nav-open" : ""}`}>

            {role === "Admin" && (
              <>
                <button className={isActive("/register") ? "nav-active" : ""} onClick={() => navTo("/register")}>Register</button>
                <button className={isActive("/admin/users") ? "nav-active" : ""} onClick={() => navTo("/admin/users")}>Search</button>
                <button className={isActive("/admin/all-users") ? "nav-active" : ""} onClick={() => navTo("/admin/all-users")}>All Users</button>
                <button className={isActive("/admin/notifications") ? "nav-active" : ""} onClick={() => navTo("/admin/notifications")}>Notifications</button>

                {/* Attendance button with pending badge */}
                <button
                  className={`nav-btn-with-badge ${isActive("/admin/attendance-requests") ? "nav-active" : ""}`}
                  onClick={() => navTo("/admin/attendance-requests")}
                >
                  Attendance
                  {attendancePending > 0 && (
                    <span className="nav-notif-badge">{attendancePending > 99 ? "99+" : attendancePending}</span>
                  )}
                </button>

                {/* Leave Requests button with pending badge */}
                <button
                  className={`nav-btn-with-badge ${isActive("/admin/leave-requests") ? "nav-active" : ""}`}
                  onClick={() => navTo("/admin/leave-requests")}
                >
                  Leave Requests
                  {leavePending > 0 && (
                    <span className="nav-notif-badge">{leavePending > 99 ? "99+" : leavePending}</span>
                  )}
                </button>

                <button className="logout-btn" onClick={logout}>Logout</button>
              </>
            )}

            {role === "User" && (
              <>
                <button
                  className={`nav-btn-with-badge ${isActive("/user") ? "nav-active" : ""}`}
                  onClick={() => navTo("/user")}
                >
                  Dashboard
                  {unreadCount > 0 && (
                    <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
                  )}
                </button>
                <button className={isActive("/user/attendance") ? "nav-active" : ""} onClick={() => navTo("/user/attendance")}>Attendance</button>
              </>
            )}
          </div>

          {/* Avatar — User only */}
          {role === "User" && (
            <div
              className={`nav-avatar ${isActive("/profile") ? "nav-avatar-active" : ""}`}
              onClick={() => navTo("/profile")}
              title="My Profile"
            >
              {profilePicture
                ? <img src={profilePicture} alt="Profile" className="nav-avatar-img" />
                : <span className="nav-avatar-initials">{getInitials(userName)}</span>
              }
            </div>
          )}

          {/* Hamburger — mobile only */}
          <button
            className={`nav-hamburger ${menuOpen ? "open" : ""}`}
            onClick={() => setMenuOpen(prev => !prev)}
            aria-label="Toggle menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

        </div>
      </div>
    </nav>
  );
}

export default Navbar;
