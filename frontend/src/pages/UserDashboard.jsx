import React, { useEffect, useState, useCallback, useRef } from "react";
import * as signalR from "@microsoft/signalr";
import { useNavigate } from "react-router-dom";
import "./UserNotifications.css";

const BASE_URL = "https://localhost:7130";

const UserDashboard = () => {
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(new Set());
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const saveTimeoutRef = useRef(null);

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  // ── Save to server (debounced 500ms) + notify Navbar instantly ──
  const saveToServer = useCallback((ids) => {
    // Fire event immediately so Navbar badge updates without waiting
    window.dispatchEvent(new CustomEvent("notif-read-updated", { detail: [...ids] }));

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      fetch(`${BASE_URL}/api/user/read-notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify([...ids])
      }).catch(() => {});
    }, 500);
  }, [token]);

  // Mark a single notification as read
  const markRead = useCallback((id, e) => {
    if (e) e.stopPropagation();
    setReadIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveToServer(next);
      return next;
    });
  }, [saveToServer]);

  // Mark ALL as read
  const markAllRead = useCallback(() => {
    setReadIds(prev => {
      const next = new Set(prev);
      notifications.forEach(n => next.add(n.id));
      saveToServer(next);
      return next;
    });
  }, [notifications, saveToServer]);

  const timeAgo = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 172800) return "Yesterday";
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  // Fetch notifications + read IDs from server
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [notifRes, readRes] = await Promise.all([
          fetch(`${BASE_URL}/api/user/notifications`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${BASE_URL}/api/user/read-notifications`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        const notifData = notifRes.ok ? await notifRes.json() : [];
        const readData  = readRes.ok  ? await readRes.json()  : [];

        setNotifications(notifData);
        setReadIds(new Set(readData));
      } catch (err) { console.error(err); }
    };
    fetchAll();
  }, [token]);

  // SignalR — new notifications arrive as unread
  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${BASE_URL}/notificationHub`, {
        accessTokenFactory: () => localStorage.getItem("token")
      })
      .withAutomaticReconnect()
      .build();

    connection.start().catch(err => console.error("SignalR Error:", err));

    connection.on("ReceiveNotification", (notification) => {
      setNotifications(prev => {
        const exists = prev.some(n => n.id === notification.id);
        if (exists) return prev.map(n => n.id === notification.id ? notification : n);
        return [notification, ...prev];
      });
    });

    connection.on("DeleteNotification", (id) => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    });

    return () => { connection.stop(); };
  }, []);

  return (
    <div className="dashboard-container">
      <div className="dashboard-card">

        <div className="dashboard-header">
          <div className="dashboard-header-left">
            <h1 className="dashboard-title">User Dashboard</h1>
            {unreadCount > 0 && (
              <span className="notif-count-badge">{unreadCount}</span>
            )}
          </div>
          {unreadCount > 0 && (
            <button className="mark-all-read-btn" onClick={markAllRead}>
              ✓ Mark all as read
            </button>
          )}
        </div>

        <p className="notification-heading">Notifications</p>

        {notifications.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="32" cy="32" r="28" fill="#EEF2FF"/>
                <path d="M32 18a10 10 0 0 1 10 10v6l3 4H19l3-4v-6a10 10 0 0 1 10-10z" fill="#C7D2FE" stroke="#6366F1" strokeWidth="1.5"/>
                <path d="M29 42a3 3 0 0 0 6 0" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="44" cy="20" r="5" fill="#22C55E"/>
              </svg>
            </div>
            <p className="empty-title">You're all caught up!</p>
            <p className="empty-sub">No notifications right now. Check back later.</p>
          </div>
        ) : (
          notifications.map((n) => {
            const isUnread = !readIds.has(n.id);
            return (
              <div
                key={n.id}
                className={`notification-card ${isUnread ? "notif-unread" : "notif-read"}`}
                onClick={() => {
                  markRead(n.id);
                  if (n.redirectUrl) navigate(n.redirectUrl);
                }}
              >
                {isUnread && <span className="unread-dot"></span>}
                <h3>{n.title}</h3>
                <p>{n.message}</p>
                <div className="notif-card-footer">
                  <span className="notif-time">{timeAgo(n.createdAt)}</span>
                  {isUnread && (
                    <button className="mark-read-btn" onClick={(e) => markRead(n.id, e)}>
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

      </div>
    </div>
  );
};

export default UserDashboard;
