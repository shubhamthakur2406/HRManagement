import axios from "../api/axiosInstance";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./Profile.css";

const BASE_URL = "https://localhost:7130";

function UserProfile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState({
    fullName: "",
    address: "",
    phoneNumber: "",
    email: ""
  });

  const [profilePicture, setProfilePicture] = useState("");
  const [picLoading, setPicLoading]           = useState(false);
  const [loading, setLoading]                 = useState(true);
  const [profileMessage, setProfileMessage]   = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [error, setError]                     = useState("");

  const [password, setPassword] = useState({
    oldPassword: "",
    newPassword: ""
  });

  // ── Fetch profile on mount ───────────────────────────────────────────
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get("/user/profile");
        setProfile({
          fullName:    res.data.fullName    || "",
          address:     res.data.address     || "",
          phoneNumber: res.data.phoneNumber || "",
          email:       res.data.email       || ""
        });
        setProfilePicture(res.data.profilePicture || "");
      } catch {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────
  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  };

  const notifyNavbar = (base64) => {
    window.dispatchEvent(new CustomEvent("profile-pic-updated", { detail: base64 }));
  };

  // ── Logout ───────────────────────────────────────────────────────────
  const logout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  // ── Handle file selection → Base64 → upload ──────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Image size must be under 2MB");
      return;
    }

    setPicLoading(true);
    setError("");

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result;
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${BASE_URL}/api/user/profile-picture`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ base64Image: base64 })
        });
        if (!res.ok) throw new Error("Upload failed");
        setProfilePicture(base64);
        notifyNavbar(base64);
        setProfileMessage("Profile picture updated!");
        setTimeout(() => setProfileMessage(""), 3000);
      } catch {
        setError("Failed to upload picture");
      } finally {
        setPicLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // ── Remove profile picture ───────────────────────────────────────────
  const removePicture = async () => {
    setPicLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BASE_URL}/api/user/profile-picture`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to remove");
      setProfilePicture("");
      notifyNavbar("");
      setProfileMessage("Profile picture removed");
      setTimeout(() => setProfileMessage(""), 3000);
    } catch {
      setError("Failed to remove picture");
    } finally {
      setPicLoading(false);
    }
  };

  // ── Update profile ───────────────────────────────────────────────────
  const updateProfile = async () => {
    setError("");
    setProfileMessage("");
    if (!profile.fullName || !profile.address || !profile.phoneNumber) {
      setError("All profile fields are required");
      return;
    }
    try {
      await axios.put("/user/profile", {
        fullName:    profile.fullName,
        address:     profile.address,
        phoneNumber: profile.phoneNumber
      });
      setProfileMessage("Profile updated successfully");
      setTimeout(() => navigate("/user"), 2000);
    } catch (err) {
      setError(err.response?.data?.title || "Error updating profile");
    }
  };

  // ── Change password ──────────────────────────────────────────────────
  const changePassword = async () => {
    setError("");
    setPasswordMessage("");
    if (!password.oldPassword || !password.newPassword) {
      setError("Both password fields are required");
      return;
    }
    try {
      await axios.put("/user/change-password", password);
      setPasswordMessage("Password changed successfully");
      setPassword({ oldPassword: "", newPassword: "" });
    } catch (err) {
      setError(err.response?.data?.title || "Error changing password");
    }
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-card">
          <h3>Loading profile...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-card">

        {/* ── Avatar ── */}
        <div className="avatar-section">
          <div
            className={`avatar-circle ${picLoading ? "avatar-loading" : ""}`}
            onClick={() => !picLoading && fileInputRef.current.click()}
            title="Click to change photo"
          >
            {profilePicture ? (
              <img src={profilePicture} alt="Profile" className="avatar-img" />
            ) : (
              <span className="avatar-initials">{getInitials(profile.fullName)}</span>
            )}
            {!picLoading && (
              <div className="avatar-overlay">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="13" r="4" stroke="white" strokeWidth="2"/>
                </svg>
                <span>Change Photo</span>
              </div>
            )}
            {picLoading && <div className="avatar-spinner"></div>}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          <p className="avatar-name">{profile.fullName}</p>
          <p className="avatar-email">{profile.email}</p>

          {profilePicture && !picLoading && (
            <button className="remove-pic-btn" onClick={removePicture}>
              Remove photo
            </button>
          )}
        </div>

        {/* ── Edit Profile ── */}
        <h2>Edit Profile</h2>

        {error && <div className="error-message">{error}</div>}
        {profileMessage && <div className="success-message">{profileMessage}</div>}

        <input
          placeholder="Full Name"
          value={profile.fullName}
          onChange={e => setProfile({ ...profile, fullName: e.target.value })}
        />
        <input
          placeholder="Address"
          value={profile.address}
          onChange={e => setProfile({ ...profile, address: e.target.value })}
        />
        <input
          placeholder="Phone"
          value={profile.phoneNumber}
          onChange={e => setProfile({ ...profile, phoneNumber: e.target.value })}
        />
        <button className="save-btn" onClick={updateProfile}>Save</button>

        <hr />

        {/* ── Change Password ── */}
        <h2>Change Password</h2>

        {passwordMessage && <div className="success-message">{passwordMessage}</div>}

        <input
          type="password"
          placeholder="Old Password"
          value={password.oldPassword}
          onChange={e => setPassword({ ...password, oldPassword: e.target.value })}
        />
        <input
          type="password"
          placeholder="New Password"
          value={password.newPassword}
          onChange={e => setPassword({ ...password, newPassword: e.target.value })}
        />
        <button className="save-btn" onClick={changePassword}>Change Password</button>

        <hr />

        {/* ── Logout ── */}
        <button className="logout-profile-btn" onClick={logout}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Logout
        </button>

      </div>
    </div>
  );
}

export default UserProfile;
