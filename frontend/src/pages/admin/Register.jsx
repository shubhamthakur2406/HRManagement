import { useEffect, useState } from "react";
import axios from "../api/axiosInstance";
import "./Register.css";

function Register() {
  const [departments, setDepartments] = useState([]);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    address: "",
    phoneNumber: "",
    departmentId: ""
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔹 Load departments
  useEffect(() => {
    axios
      .get("/departments")
      .then(res => setDepartments(res.data))
      .catch(err => console.error(err));
  }, []);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

const register = async () => {
  setError("");
  setSuccess("");

  // ✅ FRONTEND REQUIRED VALIDATION
  if (
    !form.fullName ||
    !form.email ||
    !form.password ||
    !form.confirmPassword ||
    !form.address ||
    !form.phoneNumber ||
    !form.departmentId
  ) {
    setError("All fields are required");
    return;
  }

  if (form.password !== form.confirmPassword) {
    setError("Passwords do not match");
    return;
  }

  setLoading(true);

  try {
    await axios.post("/auth/register", {
      fullName: form.fullName,
      email: form.email,
      password: form.password,
      address: form.address,
      phoneNumber: form.phoneNumber,
      departmentId: Number(form.departmentId)  // 🔥 important fix
    });

    setSuccess("User registered successfully");

    setForm({
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      address: "",
      phoneNumber: "",
      departmentId: ""
    });

  } catch (err) {
    setError("Registration failed");
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="register-container">
      <div className="register-card">
        <h2>Register User</h2>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <input
          name="fullName"
          placeholder="Full Name"
          value={form.fullName}
          onChange={handleChange}
        />

        <input
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
        />

        <input
          name="password"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
        />

        <input
          name="confirmPassword"
          type="password"
          placeholder="Confirm Password"
          value={form.confirmPassword}
          onChange={handleChange}
        />

        <input
          name="address"
          placeholder="Address"
          value={form.address}
          onChange={handleChange}
        />

        <input
          name="phoneNumber"
          placeholder="Phone Number"
          value={form.phoneNumber}
          onChange={handleChange}
        />

        <select
          name="departmentId"
          value={form.departmentId}
          onChange={handleChange}
        >
          <option value="">Select Department</option>
          {departments.map(dep => (
            <option key={dep.id} value={dep.id}>
              {dep.departmentName}
            </option>
          ))}
        </select>

        <button onClick={register} disabled={loading}>
          {loading ? "Registering..." : "Register User"}
        </button>
      </div>
    </div>
  );
}

export default Register;
