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
import AdminLeaveRequests from "./pages/AdminLeaveRequests";
import UserAttendance from "./pages/UserAttendance";
import AdminPayroll from "./pages/AdminPayroll";
import UserPayroll from "./pages/UserPayroll";

function AppContent() {
  const location = useLocation();
  const isLoginPage = location.pathname === "/";

  return (
    <>
      {!isLoginPage && <Navbar />}
      <div className={isLoginPage ? "" : "main-content"}>
        <Routes>

          {/* Login */}
          <Route path="/" element={<Login />} />

          {/* Admin Routes */}
          <Route path="/register"                    element={<ProtectedRoute role="Admin"><Register /></ProtectedRoute>} />
          <Route path="/admin/notifications"         element={<ProtectedRoute role="Admin"><AdminNotifications /></ProtectedRoute>} />
          <Route path="/admin/edit/:id"              element={<ProtectedRoute role="Admin"><AdminEditUserPage /></ProtectedRoute>} />
          <Route path="/admin/all-users"             element={<ProtectedRoute role="Admin"><AdminUserList /></ProtectedRoute>} />
          <Route path="/admin/attendance-requests"   element={<ProtectedRoute role="Admin"><AdminAttendanceRequests /></ProtectedRoute>} />
          <Route path="/admin/users"                 element={<ProtectedRoute role="Admin"><AdminUserSearch /></ProtectedRoute>} />
          <Route path="/admin/leave-requests"        element={<ProtectedRoute role="Admin"><AdminLeaveRequests /></ProtectedRoute>} />
          <Route path="/admin/payroll"               element={<ProtectedRoute role="Admin"><AdminPayroll /></ProtectedRoute>} />

          {/* User Routes */}
          <Route path="/user"             element={<ProtectedRoute role="User"><UserDashboard /></ProtectedRoute>} />
          <Route path="/profile"          element={<ProtectedRoute role="User"><UserProfile /></ProtectedRoute>} />
          <Route path="/user/attendance"  element={<ProtectedRoute role="User"><UserAttendance /></ProtectedRoute>} />
          <Route path="/user/payroll"     element={<ProtectedRoute role="User"><UserPayroll /></ProtectedRoute>} />

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
