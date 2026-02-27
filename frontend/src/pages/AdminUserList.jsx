import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../api/axiosInstance";
import "./AdminUserList.css";

function AdminUserList() {
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const pageSize = 10;
  const navigate = useNavigate();
  const totalPages = Math.ceil(totalUsers / pageSize);

  const loadUsers = async (page) => {
    try {
      const res = await axios.get("/admin/users", {
        params: { pageNumber: page, pageSize }
      });

      setUsers(res.data.users);
      setTotalUsers(res.data.totalUsers);
    } catch {
      alert("Failed to load users");
    }
  };

  useEffect(() => {
    loadUsers(currentPage);
  }, [currentPage]);

  // ESC KEY SUPPORT
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowModal(false);
        setSelectedUserId(null);
      }
    };

    if (showModal) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showModal]);

  const handleDeleteClick = (userId) => {
    setSelectedUserId(userId);
    setShowModal(true);
  };

  const confirmDeleteUser = async () => {
    setIsDeleting(true);

    try {
      await axios.delete(`/admin/users/${selectedUserId}`);

      setShowModal(false);
      setSelectedUserId(null);
      loadUsers(currentPage);
    } catch {
      alert("Failed to delete user");
    }

    setIsDeleting(false);
  };

  const cancelDelete = () => {
    if (!isDeleting) {
      setShowModal(false);
      setSelectedUserId(null);
    }
  };

  return (
    <div className="users-page">
      <h2>All Users</h2>

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
                <td>{u.fullName}</td>
                <td>{u.email}</td>
                <td>{u.departmentName}</td>

                <td>
                  <button
                    className="btn-edit"
                    onClick={() => navigate(`/admin/edit/${u.id}`)}
                  >
                    Edit
                  </button>
                </td>

                <td>
                  <button
                    className="btn-delete"
                    onClick={() => handleDeleteClick(u.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div className="pagination">
        <button
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((p) => p - 1)}
        >
          Previous
        </button>

        <span>
          Page {currentPage} of {totalPages}
        </span>

        <button
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage((p) => p + 1)}
        >
          Next
        </button>
      </div>

      {/* MODERN DELETE MODAL */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={cancelDelete}
        >
          <div
            className="modern-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-icon">⚠️</div>

            <h3>Delete User</h3>
            <p>
              This action cannot be undone.
              <br />
              Are you sure you want to delete this user?
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
                onClick={confirmDeleteUser}
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
}

export default AdminUserList;