import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import "./App.css";
import Login from "./pages/Login";
import Register from "./pages/Register";
import UserDashboard from "./pages/UserDashboard";
import ProtectedRoute from "./auth/ProtectedRoute";
import AdminUserSearch from "./pages/AdminUserSearch";
import UserProfile from "./pages/UserProfile";
import AdminUserList from "./pages/AdminUserList";
import AdminEditUserPage from "./pages/AdminEditUserPage";
import AdminNotifications from "./pages/AdminNotifications";
import AdminAttendanceRequests from "./pages/AdminAttendanceRequests";
import UserAttendance from "./pages/UserAttendance";


/* 👇 Separate component because useLocation must be inside Router */
function AppContent() {
  const location = useLocation();
  const isLoginPage = location.pathname === "/";

  return (
    <>
      <Navbar />

      {/* Remove margin on login page */}
      <div className={isLoginPage ? "" : "main-content"}>
        <Routes>
          <Route path="/" element={<Login />} />

          <Route
            path="/register"
            element={
              <ProtectedRoute role="Admin">
                <Register />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/notifications"
            element={
              <ProtectedRoute role="Admin">
                <AdminNotifications />
              </ProtectedRoute>
            }
          />

          <Route
            path="/user"
            element={
              <ProtectedRoute role="User">
                <UserDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/edit/:id"
            element={
              <ProtectedRoute role="Admin">
                <AdminEditUserPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/all-users"
            element={
              <ProtectedRoute role="Admin">
                <AdminUserList />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/attendance-requests"
            element={
              <ProtectedRoute role="Admin">
                <AdminAttendanceRequests />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/users"
            element={
              <ProtectedRoute role="Admin">
                <AdminUserSearch />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute role="User">
                <UserProfile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/user/attendance"
            element={
              <ProtectedRoute role="User">
                <UserAttendance/>
              </ProtectedRoute>
            }
          />

          <Route
            path="/user"
            element={
              <ProtectedRoute role="User">
                <UserDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
