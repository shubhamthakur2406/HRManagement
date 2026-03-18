import React, { useEffect, useState, useRef } from "react";
import Select from "react-select";
import * as signalR from "@microsoft/signalr";
import "./AdminNotifications.css";

const AdminNotification = () => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");

  const [sendToAll, setSendToAll] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedDepartments, setSelectedDepartments] = useState([]);

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

  const [toast, setToast] = useState({ message: "", type: "" });

  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const formRef = useRef(null);
  const token = localStorage.getItem("token");

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

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "" }), 3000);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") { setShowConfirm(false); setDeleteId(null); }
    };
    if (showConfirm) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showConfirm]);

  useEffect(() => {
    if (!token) return;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl("https://localhost:7130/notificationHub", {
        accessTokenFactory: () => token,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect()
      .build();

    connection.start()
      .then(() => console.log("Admin SignalR Connected"))
      .catch(err => console.error("SignalR Error:", err));

    connection.on("ReceiveNotification", (notification) => {
      setNotifications((prev) => {
        if (!notification?.id) return prev;
        const exists = prev.find((n) => n.id === notification.id);
        if (exists) return prev.map((n) => n.id === notification.id ? notification : n);
        return [notification, ...prev];
      });
    });

    return () => connection.stop();
  }, [token]);

  useEffect(() => {
    fetchNotifications();
    fetchUsers();
    fetchDepartments();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("https://localhost:7130/api/admin/notifications", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setNotifications(data);
    } catch { showToast("Failed to load notifications ❌", "error"); }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("https://localhost:7130/api/admin/users", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setUsers(data.users || []);
    } catch { showToast("Failed to load users ❌", "error"); }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch("https://localhost:7130/api/departments", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setDepartments(data || []);
    } catch { showToast("Failed to load departments ❌", "error"); }
  };

  const handleSubmit = async () => {
    const url = editId
      ? `https://localhost:7130/api/admin/notifications/${editId}`
      : "https://localhost:7130/api/admin/notifications";
    const method = editId ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, message, redirectUrl, sendToAll, userIds: selectedUsers, departmentIds: selectedDepartments })
      });

      let data = null;
      try { data = await res.json(); } catch {}

      if (!res.ok && !data) { showToast("Operation failed ❌", "error"); return; }

      setNotifications((prev) => {
        const exists = prev.find((n) => n.id === data.id);
        if (exists) return prev.map((n) => n.id === data.id ? data : n);
        return [data, ...prev];
      });

      showToast(editId ? "Notification Updated Successfully ✅" : "Notification Created Successfully ✅", "success");
      resetForm();
    } catch { showToast("Server error ❌", "error"); }
  };

  const resetForm = () => {
    setTitle(""); setMessage(""); setRedirectUrl("");
    setSendToAll(false); setSelectedUsers([]); setSelectedDepartments([]);
    setEditId(null); setEditTitle("");
  };

  const handleEdit = (n) => {
    setTitle(n.title); setMessage(n.message);
    setRedirectUrl(n.redirectUrl || "");
    setSendToAll(n.sendToAll || false);
    setSelectedUsers(n.userIds || []);
    setSelectedDepartments(n.departmentIds || []);
    setEditId(n.id);
    setEditTitle(n.title);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openDeleteModal = (id) => { setDeleteId(id); setShowConfirm(true); };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`https://localhost:7130/api/admin/notifications/${deleteId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) { showToast("Delete failed ❌", "error"); setIsDeleting(false); return; }
      setNotifications((prev) => prev.filter((n) => n.id !== deleteId));
      showToast("Notification Deleted Successfully 🗑️", "success");
      setShowConfirm(false); setDeleteId(null);
    } catch { showToast("Server error ❌", "error"); }
    setIsDeleting(false);
  };

  const cancelDelete = () => {
    if (!isDeleting) { setShowConfirm(false); setDeleteId(null); }
  };

  const userOptions = users.map((u) => ({ value: u.id, label: u.fullName }));
  const departmentOptions = departments.map((d) => ({ value: d.id, label: d.departmentName }));

  return (
    <div className="admin-wrapper">

      {toast.message && (
        <div className={`toast ${toast.type}`}>{toast.message}</div>
      )}

      {/* Form card */}
      <div className={`admin-card ${editId ? "editing-mode" : ""}`} ref={formRef}>
        <h2>{editId ? "Edit Notification" : "Send Notification"}</h2>

        {editId && (
          <div className="editing-banner">
            <div className="editing-banner-dot"></div>
            Editing: <strong style={{ marginLeft: 4 }}>{editTitle}</strong>
          </div>
        )}

        <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea placeholder="Message" value={message} onChange={(e) => setMessage(e.target.value)} />
        <input type="text" placeholder="Redirect URL (optional)" value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} />

        <label className="checkbox-label">
          <input type="checkbox" checked={sendToAll} onChange={(e) => setSendToAll(e.target.checked)} />
          Send To All Users
        </label>

        <Select
          options={userOptions} isMulti isDisabled={sendToAll} placeholder="Select Users..."
          value={userOptions.filter((u) => selectedUsers.includes(u.value))}
          onChange={(selected) => setSelectedUsers(selected ? selected.map((s) => s.value) : [])}
        />

        <Select
          options={departmentOptions} isMulti isDisabled={sendToAll} placeholder="Select Departments..."
          value={departmentOptions.filter((d) => selectedDepartments.includes(d.value))}
          onChange={(selected) => setSelectedDepartments(selected ? selected.map((s) => s.value) : [])}
        />

        <button onClick={handleSubmit}>
          {editId ? "Update Notification" : "Send Notification"}
        </button>

        {editId && (
          <button onClick={resetForm} style={{ marginTop: "8px", background: "#F3F4F6", color: "#374151", border: "1.5px solid #E5E7EB" }}>
            Cancel Edit
          </button>
        )}
      </div>

      {/* Notifications list */}
      <div className="admin-list">
        <div className="admin-list-header">
          <h3>All Notifications</h3>
          {notifications.length > 0 && (
            <span className="notif-total-badge">{notifications.length}</span>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="notif-empty-state">
            <p>No notifications sent yet</p>
            <p>Use the form above to send your first notification</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div key={n.id} className={`admin-notification-card ${editId === n.id ? "currently-editing" : ""}`}>
              <div className="notification-content">
                <h4>{n.title}</h4>
                <p>{n.message}</p>
              </div>

              {/* Relative timestamp with full date tooltip */}
              <div className="notification-date" title={new Date(n.createdAt).toLocaleString()}>
                <span className="notif-time-relative">{timeAgo(n.createdAt)}</span>
                <span className="notif-time-full">{new Date(n.createdAt).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}</span>
              </div>

              <div className="action-buttons">
                <button className="edit-btn" onClick={() => handleEdit(n)}>Edit</button>
                <button className="delete-btn" onClick={() => openDeleteModal(n.id)}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>

      {showConfirm && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modern-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">⚠️</div>
            <h3>Delete Notification</h3>
            <p>This action cannot be undone.<br />Are you sure you want to delete?</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={cancelDelete} disabled={isDeleting}>Cancel</button>
              <button className="btn-danger" onClick={confirmDelete} disabled={isDeleting}>
                {isDeleting ? <span className="spinner"></span> : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminNotification;
