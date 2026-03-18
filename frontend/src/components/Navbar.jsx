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

  const [unreadCount, setUnreadCount] = useState(0);
  const connectionRef = useRef(null);
  const notificationsRef = useRef([]);
  const readIdsRef = useRef(new Set());

  let role = null;
  if (token) {
    try {
      const decoded = jwtDecode(token);
      role = decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
    } catch {
      localStorage.removeItem("token");
    }
  }

  // Fetch notifications + read IDs from server and compute unread count
  const refreshFromServer = () => {
    if (!token) return;
    Promise.all([
      fetch(`${BASE_URL}/api/user/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.ok ? r.json() : []),
      fetch(`${BASE_URL}/api/user/read-notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.ok ? r.json() : [])
    ])
      .then(([notifs, readIds]) => {
        notificationsRef.current = notifs;
        readIdsRef.current = new Set(readIds);
        setUnreadCount(notifs.filter(n => !readIdsRef.current.has(n.id)).length);
      })
      .catch(() => {});
  };

  // ── 1. Initial fetch ─────────────────────────────────────────────────
  useEffect(() => {
    if (role !== "User" || !token) return;
    refreshFromServer();
  }, [role, token]);

  // ── 2. Listen for read-updated event from UserDashboard ──────────────
  //    Dashboard fires this instantly when user marks a notification read
  //    so the navbar badge updates in real time without a server round-trip
  useEffect(() => {
    if (role !== "User") return;

    const handleReadUpdated = (e) => {
      const updatedReadIds = new Set(e.detail);
      readIdsRef.current = updatedReadIds;
      setUnreadCount(
        notificationsRef.current.filter(n => !updatedReadIds.has(n.id)).length
      );
    };

    window.addEventListener("notif-read-updated", handleReadUpdated);
    return () => window.removeEventListener("notif-read-updated", handleReadUpdated);
  }, [role]);

  // ── 3. Re-count on route change ───────────────────────────────────────
  useEffect(() => {
    if (role !== "User") return;
    setUnreadCount(
      notificationsRef.current.filter(n => !readIdsRef.current.has(n.id)).length
    );
  }, [location.pathname]);

  // ── 4. SignalR live updates ───────────────────────────────────────────
  useEffect(() => {
    if (role !== "User" || !token) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${BASE_URL}/notificationHub`, {
        accessTokenFactory: () => localStorage.getItem("token")
      })
      .withAutomaticReconnect()
      .build();

    connectionRef.current = connection;

    connection.start()
      .then(() => console.log("✅ Navbar SignalR Connected"))
      .catch(err => console.error("Navbar SignalR error:", err));

    connection.on("ReceiveNotification", (notification) => {
      const currentIds = new Set(notificationsRef.current.map(n => n.id));
      if (currentIds.has(notification.id)) {
        notificationsRef.current = notificationsRef.current.map(n =>
          n.id === notification.id ? notification : n
        );
      } else {
        // New notification — re-fetch from server to verify it's for this user
        refreshFromServer();
        return;
      }
      setUnreadCount(
        notificationsRef.current.filter(n => !readIdsRef.current.has(n.id)).length
      );
    });

    connection.on("DeleteNotification", (id) => {
      notificationsRef.current = notificationsRef.current.filter(n => n.id !== id);
      setUnreadCount(
        notificationsRef.current.filter(n => !readIdsRef.current.has(n.id)).length
      );
    });

    return () => { connection.stop(); };
  }, [role, token]);

  if (!token || !role) return null;

  const logout = () => {
    localStorage.removeItem("token");
    if (connectionRef.current) connectionRef.current.stop();
    navigate("/");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="navbar-container">

        <div className="logo" onClick={() => navigate(role === "Admin" ? "/admin/notifications" : "/user")}>
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

        <div className="nav-buttons">
          {role === "Admin" && (
            <>
              <button className={isActive("/register") ? "nav-active" : ""} onClick={() => navigate("/register")}>Register</button>
              <button className={isActive("/admin/users") ? "nav-active" : ""} onClick={() => navigate("/admin/users")}>Search</button>
              <button className={isActive("/admin/all-users") ? "nav-active" : ""} onClick={() => navigate("/admin/all-users")}>All Users</button>
              <button className={isActive("/admin/notifications") ? "nav-active" : ""} onClick={() => navigate("/admin/notifications")}>Notifications</button>
              <button className={isActive("/admin/attendance-requests") ? "nav-active" : ""} onClick={() => navigate("/admin/attendance-requests")}>Attendance Requests</button>
            </>
          )}

          {role === "User" && (
            <>
              <button className={isActive("/profile") ? "nav-active" : ""} onClick={() => navigate("/profile")}>Profile</button>

              <button
                className={`nav-btn-with-badge ${isActive("/user") ? "nav-active" : ""}`}
                onClick={() => navigate("/user")}
              >
                Dashboard
                {unreadCount > 0 && (
                  <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
                )}
              </button>

              <button className={isActive("/user/attendance") ? "nav-active" : ""} onClick={() => navigate("/user/attendance")}>Attendance</button>
            </>
          )}

          <button className="logout-btn" onClick={logout}>Logout</button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
