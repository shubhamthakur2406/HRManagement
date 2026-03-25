import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "../../api/axiosInstance";
import "./AdminEditUserPage.css";

function AdminEditUserPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    address: "",
    phoneNumber: "",
    departmentId: ""
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔹 Load user details
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get(`/admin/users/${id}`);

        setForm({
          fullName: res.data.fullName || "",
          email: res.data.email || "",
          address: res.data.address || "",
          phoneNumber: res.data.phoneNumber || "",
          departmentId: res.data.departmentId?.toString() || ""
        });
      } catch {
        setError("Failed to load user");
      }
    };

    fetchUser();
  }, [id]);

  // 🔹 Load departments
  useEffect(() => {
    axios
      .get("/departments")
      .then(res => setDepartments(res.data))
      .catch(() => setError("Failed to load departments"));
  }, []);

  const updateUser = async () => {
    setError("");
    setSuccess("");

    // ✅ Frontend validation
    if (
      !form.fullName ||
      !form.email ||
      !form.address ||
      !form.phoneNumber ||
      !form.departmentId
    ) {
      setError("All fields are required");
      return;
    }

    setLoading(true);

    try {
      await axios.put(`/admin/users/${id}`, {
        ...form,
        departmentId: Number(form.departmentId)
      });

      setSuccess("User updated successfully");

      // 🔥 Redirect after 2 seconds (professional UX)
      setTimeout(() => {
        navigate("/admin/all-users");
      }, 2000);

    } catch (err) {
      setError(
        err.response?.data?.title ||
        "Update failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="edit-page">
      <div className="edit-card">
        <h2>Edit User</h2>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <input
          placeholder="Full Name"
          value={form.fullName}
          onChange={e => setForm({ ...form, fullName: e.target.value })}
        />

        <input
          placeholder="Email"
          value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
        />

        <input
          placeholder="Address"
          value={form.address}
          onChange={e => setForm({ ...form, address: e.target.value })}
        />

        <input
          placeholder="Phone Number"
          value={form.phoneNumber}
          onChange={e => setForm({ ...form, phoneNumber: e.target.value })}
        />

        <select
          value={form.departmentId}
          onChange={e =>
            setForm({ ...form, departmentId: e.target.value })
          }
        >
          <option value="">Select Department</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>
              {d.departmentName}
            </option>
          ))}
        </select>

        <div className="button-group">
          <button
            className="save-btn"
            onClick={updateUser}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save"}
          </button>

          <button
            className="cancel-btn"
            onClick={() => navigate("/admin/all-users")}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminEditUserPage;
