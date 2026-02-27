import { useEffect, useState } from "react";
import axios from "../api/axiosInstance";
import "./AdminUserSearch.css";

function AdminUserSearch() {
  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);

  /* ================= FETCH DEPARTMENTS ================= */
  useEffect(() => {
    axios.get("/departments")
      .then(res => setDepartments(res.data))
      .catch(err => console.error(err));
  }, []);

  /* ================= LOAD USERS ================= */
  useEffect(() => {

    const fetchUsers = async () => {
      try {
        setLoading(true);

        // If no search text → load ALL users
        if (name.trim() === "") {
          const res = await axios.get("/admin/users");
          setUsers(res.data.users || res.data);
          setLoading(false);
          return;
        }

        // If search text exists → search API
        const res = await axios.get("/admin/users/search", {
          params: {
            name,
            departmentId: departmentId || null
          }
        });

        setUsers(res.data);
        setLoading(false);

      } catch (error) {
        console.error("Error loading users:", error);
        setUsers([]);
        setLoading(false);
      }
    };

    fetchUsers();

  }, [name, departmentId]);

  return (
    <div className="search-page">
      <h2>Search Users</h2>

      {/* SEARCH CONTROLS */}
      <div className="search-controls">

        <input
          className="search-input"
          placeholder="Search by name"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        <select
          className="search-select"
          value={departmentId}
          onChange={e => setDepartmentId(e.target.value)}
        >
          <option value="">All Departments</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>
              {d.departmentName}
            </option>
          ))}
        </select>
      </div>

      {/* TABLE */}
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
              <tr>
                <td colSpan="3" className="no-results">
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="3" className="no-results">
                  No users found
                </td>
              </tr>
            ) : (
              users.map(u => (
                <tr key={u.id}>
                  <td>{u.fullName}</td>
                  <td>{u.email}</td>
                  <td>{u.departmentName}</td>
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