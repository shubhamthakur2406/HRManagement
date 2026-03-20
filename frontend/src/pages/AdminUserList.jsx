import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../api/axiosInstance";
import toast, { Toaster } from "react-hot-toast";
import "./AdminUserList.css";

function AdminUserList() {
  const [users, setUsers]               = useState([]);
  const [totalUsers, setTotalUsers]     = useState(0);
  const [currentPage, setCurrentPage]   = useState(1);
  const [showModal, setShowModal]       = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [isDeleting, setIsDeleting]     = useState(false);

  const pageSize  = 10;
  const navigate  = useNavigate();
  const totalPages = Math.ceil(totalUsers / pageSize);

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  };

  const avatarColor = (name) => {
    const colors = ["#4F46E5","#7C3AED","#0891B2","#059669","#D97706","#DC2626","#DB2777"];
    if (!name) return colors[0];
    return colors[name.charCodeAt(0) % colors.length];
  };

  const loadUsers = async (page) => {
    try {
      const res = await axios.get("/admin/users", { params: { pageNumber: page, pageSize } });
      setUsers(res.data.users);
      setTotalUsers(res.data.totalUsers);
    } catch { toast.error("Failed to load users"); }
  };

  useEffect(() => { loadUsers(currentPage); }, [currentPage]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") { setShowModal(false); setSelectedUserId(null); }
    };
    if (showModal) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showModal]);

  const handleDeleteClick   = (userId) => { setSelectedUserId(userId); setShowModal(true); };

  const confirmDeleteUser = async () => {
    setIsDeleting(true);
    try {
      await axios.delete(`/admin/users/${selectedUserId}`);
      toast.success("User deleted successfully");
      setShowModal(false); setSelectedUserId(null);
      loadUsers(currentPage);
    } catch { toast.error("Failed to delete user"); }
    setIsDeleting(false);
  };

  const cancelDelete = () => {
    if (!isDeleting) { setShowModal(false); setSelectedUserId(null); }
  };

  return (
    <div className="users-page">
      <Toaster position="top-right" />

      <div className="users-page-header">
        <h2>All Users</h2>
        {totalUsers > 0 && (
          <span className="users-total-badge">{totalUsers} users</span>
        )}
      </div>

      <div className="users-table-wrapper">
        <table className="users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Edit</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="user-name-cell">
                    {/* ✅ Show profile picture if available, else initials */}
                    <div
                      className="user-avatar-sm"
                      style={{ background: u.profilePicture ? "transparent" : avatarColor(u.fullName) }}
                    >
                      {u.profilePicture
                        ? <img src={u.profilePicture} alt={u.fullName} className="avatar-table-img" />
                        : getInitials(u.fullName)
                      }
                    </div>
                    <span>{u.fullName}</span>
                  </div>
                </td>
                <td>{u.email}</td>
                <td>
                  <span className="dept-badge">{u.departmentName}</span>
                </td>
                <td>
                  <button className="btn-edit" onClick={() => navigate(`/admin/edit/${u.id}`)}>Edit</button>
                </td>
                <td>
                  <button className="btn-delete" onClick={() => handleDeleteClick(u.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>Previous</button>
        <span>Page {currentPage} of {totalPages}</span>
        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>Next</button>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modern-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">⚠️</div>
            <h3>Delete User</h3>
            <p>This action cannot be undone.<br/>Are you sure you want to delete this user?</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={cancelDelete} disabled={isDeleting}>Cancel</button>
              <button className="btn-danger" onClick={confirmDeleteUser} disabled={isDeleting}>
                {isDeleting ? <span className="spinner"></span> : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminUserList;
