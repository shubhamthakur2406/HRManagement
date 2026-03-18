import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import { jwtDecode } from "jwt-decode";
import "./Login.css";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setError("");
    setLoading(true);

    try {
      const res = await axiosInstance.post("/auth/login", {
        email,
        password
      });

      localStorage.setItem("token", res.data.token);

      const decoded = jwtDecode(res.data.token);
      const role =
        decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];

      navigate(role === "Admin" ? "/admin/notifications" : "/user");
    } catch {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">

      {/* Animated background blobs */}
      <div className="login-bg">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
        <div className="blob blob-4"></div>
        <div className="grid-overlay"></div>
      </div>

      {/* Floating card */}
      <div className="login-card">

        {/* Logo / Brand */}
        <div className="login-brand">
          <div className="login-logo">
            {/* People / workforce SVG icon */}
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Person left */}
              <circle cx="13" cy="12" r="5" fill="rgba(255,255,255,0.95)"/>
              <path d="M3 30c0-5.523 4.477-9 10-9s10 3.477 10 9" stroke="rgba(255,255,255,0.95)" strokeWidth="2.5" strokeLinecap="round"/>
              {/* Person right (offset, slightly behind) */}
              <circle cx="27" cy="12" r="5" fill="rgba(255,255,255,0.6)"/>
              <path d="M17 30c0-5.523 4.477-9 10-9s10 3.477 10 9" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="login-brand-text">
            <span className="login-app-name">Sahayog</span>
            <span className="login-app-sub">Workforce Management</span>
          </div>
        </div>

        <div className="login-divider"></div>

        <h2 className="login-title">Welcome back</h2>
        <p className="login-subtitle">Sign in to your account to continue</p>

        {error && (
          <div className="error-message">
            <span className="error-icon">!</span>
            {error}
          </div>
        )}

        <div className="input-group">
          <label className="input-label">Email address</label>
          <input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label className="input-label">Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        <button className="login-btn" onClick={login} disabled={loading}>
          {loading ? (
            <span className="login-spinner"></span>
          ) : (
            <>
              <span>Sign In</span>
              <svg className="btn-arrow" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </>
          )}
        </button>

        <p className="login-footer">
          &copy; {new Date().getFullYear()} Sahayog &mdash; All rights reserved
        </p>
      </div>
    </div>
  );
}

export default Login;
