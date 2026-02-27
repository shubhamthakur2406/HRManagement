
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

  // Toast
  const [toast, setToast] = useState({ message: "", type: "" });

  // Delete Modal
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const formRef = useRef(null);
  const token = localStorage.getItem("token");

  // ================= TOAST =================

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast({ message: "", type: "" });
    }, 3000);
  };

  // ================= ESC KEY SUPPORT =================

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowConfirm(false);
        setDeleteId(null);
      }
    };

    if (showConfirm) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showConfirm]);

  // ================= SIGNALR =================

  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl("https://localhost:7130/notificationHub", {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .build();

    connection.start().catch(console.error);

    connection.on("ReceiveNotification", (notification) => {
      setNotifications((prev) => {
        const exists = prev.find((n) => n.id === notification.id);
        if (exists) {
          return prev.map((n) =>
            n.id === notification.id ? notification : n
          );
        }
        return [notification, ...prev];
      });
    });

    return () => connection.stop();
  }, []);

  // ================= FETCH =================

  useEffect(() => {
    fetchNotifications();
    fetchUsers();
    fetchDepartments();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch(
        "https://localhost:7130/api/admin/notifications",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setNotifications(data);
    } catch {
      showToast("Failed to load notifications ❌", "error");
    }
  };

  const fetchUsers = async () => {
    const res = await fetch(
      "https://localhost:7130/api/admin/users",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    setUsers(data.users);
  };

  const fetchDepartments = async () => {
    const res = await fetch(
      "https://localhost:7130/api/departments",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    setDepartments(data);
  };

  // ================= SUBMIT =================

  const handleSubmit = async () => {
    const url = editId
      ? `https://localhost:7130/api/admin/notifications/${editId}`
      : "https://localhost:7130/api/admin/notifications";

    const method = editId ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          message,
          redirectUrl,
          sendToAll,
          userIds: selectedUsers,
          departmentIds: selectedDepartments
        })
      });

      if (!res.ok) {
        showToast("Operation failed ❌", "error");
        return;
      }

      const updatedNotification = await res.json();

      setNotifications((prev) => {
        const exists = prev.find((n) => n.id === updatedNotification.id);
        if (exists) {
          return prev.map((n) =>
            n.id === updatedNotification.id ? updatedNotification : n
          );
        }
        return [updatedNotification, ...prev];
      });

      showToast(
        editId
          ? "Notification Updated Successfully ✅"
          : "Notification Created Successfully ✅",
        "success"
      );

      resetForm();
    } catch {
      showToast("Server error ❌", "error");
    }
  };

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setRedirectUrl("");
    setSendToAll(false);
    setSelectedUsers([]);
    setSelectedDepartments([]);
    setEditId(null);
  };

  // ================= EDIT =================

  const handleEdit = (n) => {
    setTitle(n.title);
    setMessage(n.message);
    setRedirectUrl(n.redirectUrl || "");
    setSendToAll(n.sendToAll || false);
    setSelectedUsers(n.userIds || []);
    setSelectedDepartments(n.departmentIds || []);
    setEditId(n.id);

    formRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  };

  // ================= DELETE =================

  const openDeleteModal = (id) => {
    setDeleteId(id);
    setShowConfirm(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);

    try {
      const res = await fetch(
        `https://localhost:7130/api/admin/notifications/${deleteId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!res.ok) {
        showToast("Delete failed ❌", "error");
        setIsDeleting(false);
        return;
      }

      setNotifications((prev) =>
        prev.filter((n) => n.id !== deleteId)
      );

      showToast("Notification Deleted Successfully 🗑️", "success");

      setShowConfirm(false);
      setDeleteId(null);
    } catch {
      showToast("Server error ❌", "error");
    }

    setIsDeleting(false);
  };

  const cancelDelete = () => {
    if (!isDeleting) {
      setShowConfirm(false);
      setDeleteId(null);
    }
  };

  // ================= OPTIONS =================

  const userOptions = users.map((u) => ({
    value: u.id,
    label: u.fullName
  }));

  const departmentOptions = departments.map((d) => ({
    value: d.id,
    label: d.departmentName
  }));

  return (
    <div className="admin-wrapper">

      {/* ===== CENTER TOAST ===== */}
      {toast.message && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* ===== FORM ===== */}
      <div className="admin-card" ref={formRef}>
        <h2>{editId ? "Edit Notification" : "Send Notification"}</h2>

        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          placeholder="Message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <input
          type="text"
          placeholder="Redirect URL (optional)"
          value={redirectUrl}
          onChange={(e) => setRedirectUrl(e.target.value)}
        />

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={sendToAll}
            onChange={(e) => setSendToAll(e.target.checked)}
          />
          Send To All Users
        </label>

        <Select
          options={userOptions}
          isMulti
          isDisabled={sendToAll}
          placeholder="Select Users..."
          value={userOptions.filter((u) =>
            selectedUsers.includes(u.value)
          )}
          onChange={(selected) =>
            setSelectedUsers(selected ? selected.map((s) => s.value) : [])
          }
        />

        <Select
          options={departmentOptions}
          isMulti
          isDisabled={sendToAll}
          placeholder="Select Departments..."
          value={departmentOptions.filter((d) =>
            selectedDepartments.includes(d.value)
          )}
          onChange={(selected) =>
            setSelectedDepartments(
              selected ? selected.map((s) => s.value) : []
            )
          }
        />

        <button onClick={handleSubmit}>
          {editId ? "Update Notification" : "Send Notification"}
        </button>
      </div>

      {/* ===== LIST ===== */}
      <div className="admin-list">
        <h3>All Notifications</h3>

        {notifications.map((n) => (
          <div key={n.id} className="admin-notification-card">
            <div className="notification-content">
              <h4>{n.title}</h4>
              <p>{n.message}</p>
            </div>

            <div className="notification-date">
              {new Date(n.createdAt).toLocaleString()}
            </div>

            <div className="action-buttons">
              <button className="edit-btn" onClick={() => handleEdit(n)}>
                Edit
              </button>

              <button
                className="delete-btn"
                onClick={() => openDeleteModal(n.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ===== MODERN CONFIRM MODAL ===== */}
      {showConfirm && (
        <div
          className="modal-overlay"
          onClick={cancelDelete}
        >
          <div
            className="modern-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-icon">⚠️</div>

            <h3>Delete Notification</h3>
            <p>
              This action cannot be undone.
              <br />
              Are you sure you want to delete?
            </p>

            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={cancelDelete}
                disabled={isDeleting}
              >
                Cancel
              </button>

              <button
                className="btn-danger"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <span className="spinner"></span>
                ) : (
                  "Yes, Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotification;