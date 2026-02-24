// import { useEffect, useState } from "react";
// import axios from "../api/axiosInstance";
// import "./AdminNotifications.css";

// function AdminNotifications() {
//   const [title, setTitle] = useState("");
//   const [message, setMessage] = useState("");
//   const [notifications, setNotifications] = useState([]);

//   const [editingId, setEditingId] = useState(null);

//   // 🔴 DELETE MODAL STATE
//   const [showConfirm, setShowConfirm] = useState(false);
//   const [deleteId, setDeleteId] = useState(null);

//   /* 🔹 LOAD NOTIFICATIONS */
//   const loadNotifications = async () => {
//     const res = await axios.get("/admin/notifications");
//     setNotifications(res.data);
//   };

//   useEffect(() => {
//     loadNotifications();
//   }, []);

//   /* ✅ POST OR UPDATE */
//   const submitNotification = async () => {
//     if (!title || !message) {
//       alert("Title and message required");
//       return;
//     }

//     if (editingId) {
//       await axios.put(`/admin/notifications/${editingId}`, {
//         title,
//         message
//       });
//     } else {
//       await axios.post("/admin/notifications", {
//         title,
//         message
//       });
//     }

//     resetForm();
//     loadNotifications();
//   };

//   /* ✏️ EDIT */
//   const editNotification = (n) => {
//     setEditingId(n.id);
//     setTitle(n.title);
//     setMessage(n.message);
//   };

//   /* 🗑 OPEN DELETE MODAL */
//   const openDeleteModal = (id) => {
//     setDeleteId(id);
//     setShowConfirm(true);
//   };

//   /* ✅ CONFIRM DELETE */
//   const confirmDelete = async () => {
//     await axios.delete(`/admin/notifications/${deleteId}`);
//     setShowConfirm(false);
//     setDeleteId(null);
//     loadNotifications();
//   };

//   /* ❌ CANCEL DELETE */
//   const cancelDelete = () => {
//     setShowConfirm(false);
//     setDeleteId(null);
//   };

//   /* ❌ RESET FORM */
//   const resetForm = () => {
//     setEditingId(null);
//     setTitle("");
//     setMessage("");
//   };

//   return (
//     <div className="notifications-page">
//       {/* FORM */}
//       <div className="post-card">
//         <h2>{editingId ? "Edit Notification" : "Post Notification"}</h2>

//         <input
//           placeholder="Title"
//           value={title}
//           onChange={e => setTitle(e.target.value)}
//         />

//         <textarea
//           placeholder="Message"
//           value={message}
//           onChange={e => setMessage(e.target.value)}
//         />

//         <div className="btn-group">
//           <button className="btn-primary" onClick={submitNotification}>
//             {editingId ? "Update" : "Post"}
//           </button>

//           {editingId && (
//             <button className="btn-secondary" onClick={resetForm}>
//               Cancel
//             </button>
//           )}
//         </div>
//       </div>

//       {/* LIST */}
//       <div className="list-card">
//         <h2>All Notifications</h2>

//         {notifications.length === 0 ? (
//           <p>No notifications</p>
//         ) : (
//           notifications.map(n => (
//             <div key={n.id} className="notification-item">
//               <h3>{n.title}</h3>
//               <p>{n.message}</p>

//               <div className="item-actions">
//                 <button
//                   className="btn-edit"
//                   onClick={() => editNotification(n)}
//                 >
//                   Edit
//                 </button>

//                 <button
//                   className="btn-danger"
//                   onClick={() => openDeleteModal(n.id)}
//                 >
//                   Delete
//                 </button>
//               </div>
//             </div>
//           ))
//         )}
//       </div>

//       {/* 🔥 DELETE CONFIRM MODAL */}
//       {showConfirm && (
//         <div className="modal-overlay">
//           <div className="modal-box">
//             <h3>Delete Notification</h3>
//             <p>Are you sure you want to delete this notification?</p>

//             <div className="modal-actions">
//               <button className="btn-danger" onClick={confirmDelete}>
//                 Delete
//               </button>
//               <button className="btn-secondary" onClick={cancelDelete}>
//                 Cancel
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default AdminNotifications;
import React, { useEffect, useState } from "react";
import "./AdminNotifications.css";

const AdminNotification = () => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [editId, setEditId] = useState(null);

  const token = localStorage.getItem("token");

  // 🔹 Fetch all notifications
  const fetchNotifications = async () => {
    const res = await fetch("https://localhost:7130/api/admin/notifications", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setNotifications(data);
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // 🔹 Create or Update
  const handleSubmit = async () => {
    const url = editId
      ? `https://localhost:7130/api/admin/notifications/${editId}`
      : "https://localhost:7130/api/admin/notifications";

    const method = editId ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ title, message, redirectUrl })
    });

    setTitle("");
    setMessage("");
    setRedirectUrl("");
    setEditId(null);
    fetchNotifications();
  };

  // 🔹 Edit
  const handleEdit = (n) => {
    setTitle(n.title);
    setMessage(n.message);
    setRedirectUrl(n.redirectUrl || "");
    setEditId(n.id);
  };

  // 🔹 Delete
  const handleDelete = async (id) => {
    await fetch(
      `https://localhost:7130/api/admin/notifications/${id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    fetchNotifications();
  };

  return (
    <div className="admin-wrapper">
      <div className="admin-card">
        <h2>Admin - Send Notification</h2>

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

        <button onClick={handleSubmit}>
          {editId ? "Update Notification" : "Send Notification"}
        </button>
      </div>

      {/* Notification List */}
      <div className="admin-list">
        <h3>All Notifications</h3>

        {notifications.map((n) => (
          <div key={n.id} className="admin-notification-card">
            <div>
              <h4>{n.title}</h4>
              <p>{n.message}</p>
              <small>
                {new Date(n.createdAt).toLocaleString()}
              </small>
            </div>

            <div className="action-buttons">
              <button
                className="edit-btn"
                onClick={() => handleEdit(n)}
              >
                Edit
              </button>

              <button
                className="delete-btn"
                onClick={() => handleDelete(n.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminNotification;