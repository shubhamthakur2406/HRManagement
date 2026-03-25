import { useEffect, useState } from "react";
import axios from "../api/axiosInstance";
import "./AdminUserSearch.css";

function AdminUserSearch() {
  const [name, setName]               = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [users, setUsers]             = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]         = useState(false);

  const getInitials = (n) => {
    if (!n) return "?";
    return n.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  };

  const avatarColor = (n) => {
    const colors = ["#4F46E5","#7C3AED","#0891B2","#059669","#D97706","#DC2626","#DB2777"];
    if (!n) return colors[0];
    return colors[n.charCodeAt(0) % colors.length];
  };

  useEffect(() => {
    axios.get("/departments")
      .then(res => setDepartments(res.data))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        if (name.trim() === "") {
          const res = await axios.get("/admin/users");
          setUsers(res.data.users || res.data);
        } else {
          const res = await axios.get("/admin/users/search", {
            params: { name, departmentId: departmentId || null }
          });
          setUsers(res.data);
        }
      } catch (error) {
        console.error("Error loading users:", error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [name, departmentId]);

  return (
    <div className="search-page">

      <div className="search-page-header">
        <h2>Search Users</h2>
        {!loading && users.length > 0 && (
          <span className="search-result-badge">{users.length} found</span>
        )}
      </div>

      <div className="search-controls">
        <div className="search-input-wrapper">
          <svg className="search-icon" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="6" stroke="#9CA3AF" strokeWidth="1.5"/>
            <path d="M13.5 13.5L17 17" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            className="search-input"
            placeholder="Search by name..."
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <select
          className="search-select"
          value={departmentId}
          onChange={e => setDepartmentId(e.target.value)}
        >
          <option value="">All Departments</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.departmentName}</option>
          ))}
        </select>
      </div>

      <div className="search-table-wrapper">
        <table className="search-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="3" className="no-results">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="3" className="no-results">No users found</td></tr>
            ) : (
              users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="search-user-cell">
                      {/* ✅ Show profile picture if available, else initials */}
                      <div
                        className="search-user-avatar"
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
                  <td className="search-email">{u.email}</td>
                  <td>
                    <span className="search-dept-badge">{u.departmentName}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminUserSearch;
