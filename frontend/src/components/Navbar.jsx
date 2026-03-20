import { useNavigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { useEffect, useState, useRef } from "react";
import * as signalR from "@microsoft/signalr";
import "./Navbar.css";

const BASE_URL = "https://localhost:7130";

function Navbar() {
  const navigate    = useNavigate();
  const location    = useLocation();
  const token       = localStorage.getItem("token");
  const dropdownRef = useRef(null);

  const [unreadCount, setUnreadCount]       = useState(0);
  const [profilePicture, setProfilePicture] = useState("");
  const [userName, setUserName]             = useState("");
  const [attendancePending, setAttendancePending] = useState(0);
  const [leavePending, setLeavePending]           = useState(0);
  const [adminDropOpen, setAdminDropOpen]         = useState(false);
  const [menuOpen, setMenuOpen]                   = useState(false);

  const connectionRef        = useRef(null);
  const adminConnRef         = useRef(null);
  const notificationsRef     = useRef([]);
  const readIdsRef           = useRef(new Set());
  const attendancePendingRef = useRef(0);
  const leavePendingRef      = useRef(0);

  useEffect(() => { setMenuOpen(false); setAdminDropOpen(false); }, [location.pathname]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setAdminDropOpen(false);
    };
    if (adminDropOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [adminDropOpen]);

  let role = null;
  if (token) {
    try {
      const decoded = jwtDecode(token);
      role = decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
    } catch { localStorage.removeItem("token"); }
  }

  // ── USER: profile ─────────────────────────────────────────────────
  useEffect(() => {
    if (role !== "User" || !token) return;
    fetch(`${BASE_URL}/api/user/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) { setProfilePicture(data.profilePicture || ""); setUserName(data.fullName || ""); } })
      .catch(() => {});
  }, [role, token]);

  useEffect(() => {
    if (role !== "User") return;
    const h = (e) => setProfilePicture(e.detail || "");
    window.addEventListener("profile-pic-updated", h);
    return () => window.removeEventListener("profile-pic-updated", h);
  }, [role]);

  // ── USER: notifications ───────────────────────────────────────────
  const refreshFromServer = () => {
    if (!token) return;
    Promise.all([
      fetch(`${BASE_URL}/api/user/notifications`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : []),
      fetch(`${BASE_URL}/api/user/read-notifications`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : [])
    ]).then(([notifs, readIds]) => {
      notificationsRef.current = notifs;
      readIdsRef.current = new Set(readIds);
      setUnreadCount(notifs.filter(n => !readIdsRef.current.has(n.id)).length);
    }).catch(() => {});
  };

  useEffect(() => { if (role !== "User" || !token) return; refreshFromServer(); }, [role, token]);

  useEffect(() => {
    if (role !== "User") return;
    const h = (e) => {
      const ids = new Set(e.detail);
      readIdsRef.current = ids;
      setUnreadCount(notificationsRef.current.filter(n => !ids.has(n.id)).length);
    };
    window.addEventListener("notif-read-updated", h);
    return () => window.removeEventListener("notif-read-updated", h);
  }, [role]);

  useEffect(() => {
    if (role !== "User") return;
    setUnreadCount(notificationsRef.current.filter(n => !readIdsRef.current.has(n.id)).length);
  }, [location.pathname]);

  // ── USER: SignalR ─────────────────────────────────────────────────
  useEffect(() => {
    if (role !== "User" || !token) return;
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${BASE_URL}/notificationHub`, { accessTokenFactory: () => localStorage.getItem("token") })
      .withAutomaticReconnect().build();
    connectionRef.current = conn;
    conn.start().catch(() => {});
    conn.on("ReceiveNotification", (n) => {
      const ids = new Set(notificationsRef.current.map(x => x.id));
      if (ids.has(n.id)) notificationsRef.current = notificationsRef.current.map(x => x.id === n.id ? n : x);
      else { refreshFromServer(); return; }
      setUnreadCount(notificationsRef.current.filter(x => !readIdsRef.current.has(x.id)).length);
    });
    conn.on("DeleteNotification", (id) => {
      notificationsRef.current = notificationsRef.current.filter(x => x.id !== id);
      setUnreadCount(notificationsRef.current.filter(x => !readIdsRef.current.has(x.id)).length);
    });
    return () => { conn.stop(); };
  }, [role, token]);

  // ── ADMIN: pending counts ─────────────────────────────────────────
  useEffect(() => {
    if (role !== "Admin" || !token) return;
    fetch(`${BASE_URL}/api/attendance/requests`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(d => { const c = d.filter(r => !r.status || r.status === "Pending").length; attendancePendingRef.current = c; setAttendancePending(c); })
      .catch(() => {});
    fetch(`${BASE_URL}/api/leave/requests`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(d => { const c = d.filter(l => l.status === "Pending").length; leavePendingRef.current = c; setLeavePending(c); })
      .catch(() => {});
  }, [role, token]);

  // ── ADMIN: SignalR ────────────────────────────────────────────────
  useEffect(() => {
    if (role !== "Admin" || !token) return;
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${BASE_URL}/attendanceHub`, { accessTokenFactory: () => localStorage.getItem("token") })
      .withAutomaticReconnect().build();
    adminConnRef.current = conn;
    conn.start().catch(() => {});
    conn.on("NewAttendanceRequest", () => { const n = attendancePendingRef.current + 1; attendancePendingRef.current = n; setAttendancePending(n); });
    conn.on("AttendanceStatusUpdated", (d) => { if (d.status === "Approved" || d.status === "Rejected") { const n = Math.max(0, attendancePendingRef.current - 1); attendancePendingRef.current = n; setAttendancePending(n); } });
    conn.on("NewLeaveRequest", () => { const n = leavePendingRef.current + 1; leavePendingRef.current = n; setLeavePending(n); });
    conn.on("LeaveStatusUpdated", (d) => { if (d.status === "Approved" || d.status === "Rejected") { const n = Math.max(0, leavePendingRef.current - 1); leavePendingRef.current = n; setLeavePending(n); } });
    return () => { conn.stop(); };
  }, [role, token]);

  useEffect(() => {
    if (role !== "Admin") return;
    if (location.pathname === "/admin/attendance-requests") { attendancePendingRef.current = 0; setAttendancePending(0); }
    if (location.pathname === "/admin/leave-requests")      { leavePendingRef.current = 0; setLeavePending(0); }
  }, [location.pathname, role]);

  if (!token || !role) return null;

  const logout      = () => { localStorage.removeItem("token"); connectionRef.current?.stop(); adminConnRef.current?.stop(); navigate("/"); };
  const isActive    = (path) => location.pathname === path;
  const getInitials = (name) => { if (!name) return "?"; return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2); };
  const navTo       = (path) => { navigate(path); setMenuOpen(false); setAdminDropOpen(false); };

  const totalAdminPending = attendancePending + leavePending;

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

          {/* ════════════ ADMIN NAVBAR ════════════ */}
          {role === "Admin" && (
            <div className="admin-nav-trigger" ref={dropdownRef}>

              {/* ── Trigger: icon + badge + chevron only (no text) ── */}
              <button
                className={`admin-menu-btn ${adminDropOpen ? "admin-menu-btn-open" : ""}`}
                onClick={() => setAdminDropOpen(prev => !prev)}
                title="Menu"
              >
                {/* Grid icon */}
                <svg className="admin-menu-icon" viewBox="0 0 20 20" fill="currentColor">
                  <rect x="2"  y="2"  width="7" height="7" rx="1.5"/>
                  <rect x="11" y="2"  width="7" height="7" rx="1.5"/>
                  <rect x="2"  y="11" width="7" height="7" rx="1.5"/>
                  <rect x="11" y="11" width="7" height="7" rx="1.5"/>
                </svg>
                {totalAdminPending > 0 && (
                  <span className="nav-notif-badge">{totalAdminPending > 99 ? "99+" : totalAdminPending}</span>
                )}
                <svg className={`admin-chevron ${adminDropOpen ? "admin-chevron-up" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
              </button>

              {/* ── Dropdown panel ── */}
              {adminDropOpen && (
                <div className="admin-dropdown">

                  {/* Users */}
                  <div className="admin-dropdown-section">
                    <p className="admin-dropdown-label">Users</p>
                    <button className={`admin-dropdown-item ${isActive("/register") ? "admin-dropdown-item-active" : ""}`} onClick={() => navTo("/register")}>
                      <span className="admin-dropdown-icon"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 00-6 6h12a6 6 0 00-6-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z"/></svg></span>
                      Register User
                    </button>
                    <button className={`admin-dropdown-item ${isActive("/admin/users") ? "admin-dropdown-item-active" : ""}`} onClick={() => navTo("/admin/users")}>
                      <span className="admin-dropdown-icon"><svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/></svg></span>
                      Search Users
                    </button>
                    <button className={`admin-dropdown-item ${isActive("/admin/all-users") ? "admin-dropdown-item-active" : ""}`} onClick={() => navTo("/admin/all-users")}>
                      <span className="admin-dropdown-icon"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg></span>
                      All Users
                    </button>
                  </div>

                  <div className="admin-dropdown-divider"/>

                  {/* Communication */}
                  <div className="admin-dropdown-section">
                    <p className="admin-dropdown-label">Communication</p>
                    <button className={`admin-dropdown-item ${isActive("/admin/notifications") ? "admin-dropdown-item-active" : ""}`} onClick={() => navTo("/admin/notifications")}>
                      <span className="admin-dropdown-icon"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg></span>
                      Notifications
                    </button>
                  </div>

                  <div className="admin-dropdown-divider"/>

                  {/* Requests */}
                  <div className="admin-dropdown-section">
                    <p className="admin-dropdown-label">Requests</p>
                    <button className={`admin-dropdown-item ${isActive("/admin/attendance-requests") ? "admin-dropdown-item-active" : ""}`} onClick={() => navTo("/admin/attendance-requests")}>
                      <span className="admin-dropdown-icon"><svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/></svg></span>
                      Attendance
                      {attendancePending > 0 && <span className="admin-dropdown-badge">{attendancePending > 99 ? "99+" : attendancePending}</span>}
                    </button>
                    <button className={`admin-dropdown-item ${isActive("/admin/leave-requests") ? "admin-dropdown-item-active" : ""}`} onClick={() => navTo("/admin/leave-requests")}>
                      <span className="admin-dropdown-icon"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/></svg></span>
                      Leave Requests
                      {leavePending > 0 && <span className="admin-dropdown-badge">{leavePending > 99 ? "99+" : leavePending}</span>}
                    </button>
                  </div>

                  <div className="admin-dropdown-divider"/>

                  {/* Logout */}
                  <div className="admin-dropdown-section">
                    <button className="admin-dropdown-item admin-dropdown-logout" onClick={logout}>
                      <span className="admin-dropdown-icon"><svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h7a1 1 0 100-2H4V5h6a1 1 0 100-2H3zm11.707 4.293a1 1 0 010 1.414L13.414 10l1.293 1.293a1 1 0 01-1.414 1.414l-2-2a1 1 0 010-1.414l2-2a1 1 0 011.414 0z" clipRule="evenodd"/><path fillRule="evenodd" d="M13 10a1 1 0 011-1h3a1 1 0 110 2h-3a1 1 0 01-1-1z" clipRule="evenodd"/></svg></span>
                      Logout
                    </button>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* ════════════ USER NAVBAR ════════════ */}
          {role === "User" && (
            <>
              <div className={`nav-buttons ${menuOpen ? "nav-open" : ""}`}>
                <button
                  className={`nav-btn-with-badge ${isActive("/user") ? "nav-active" : ""}`}
                  onClick={() => navTo("/user")}
                >
                  Dashboard
                  {unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
                </button>
                <button className={isActive("/user/attendance") ? "nav-active" : ""} onClick={() => navTo("/user/attendance")}>
                  Attendance
                </button>
              </div>

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

              <button
                className={`nav-hamburger ${menuOpen ? "open" : ""}`}
                onClick={() => setMenuOpen(prev => !prev)}
                aria-label="Toggle menu"
              >
                <span/><span/><span/>
              </button>
            </>
          )}

        </div>
      </div>
    </nav>
  );
}

export default Navbar;
