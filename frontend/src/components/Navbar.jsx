import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "./Navbar.css";

function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  if (!token) return null;

  let role = null;

  try {
    const decoded = jwtDecode(token);
    role =
      decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
  } catch {
    localStorage.removeItem("token");
    return null;
  }

  const logout = () => {
    localStorage.removeItem("token"); // ✅ enough
    navigate("/");
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="logo" onClick={() => navigate("/")}>
          Sahayog
        </div>

        <div className="nav-buttons">
          {role === "Admin" && (
            <>
              <button onClick={() => navigate("/register")}>Register</button>
              <button onClick={() => navigate("/admin/users")}>Search</button>
              <button onClick={() => navigate("/admin/all-users")}>All Users</button>
              <button onClick={() => navigate("/admin/notifications")}>Notifications</button>
              <button onClick={() => navigate("/admin/attendance-requests")}>Attendance Requests</button>
            </>
          )}

          {role === "User" && (
            <>
              <button onClick={() => navigate("/profile")}>Profile</button>
              <button onClick={() => navigate("/user")}>Dashboard</button>
              <button onClick={() => navigate("/user/attendance")}>Attendance</button>
            </>
          )}

          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
