import React, { useEffect, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { useNavigate } from "react-router-dom";
import "./UserNotifications.css";

const UserDashboard = () => {
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  // 🔹 1️⃣ Fetch existing notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch(
          "https://localhost:7130/api/user/notifications",
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        if (!res.ok) throw new Error("Failed to fetch");

        const data = await res.json();
        setNotifications(data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchNotifications();
  }, [token]);

  // 🔹 2️⃣ SignalR Real-Time Setup (NEW CLEAN CONNECTION)
  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl("https://localhost:7130/notificationHub", {
        accessTokenFactory: () => localStorage.getItem("token")
      })
      .withAutomaticReconnect()
      .build();

    const startConnection = async () => {
      try {
        await connection.start();
        console.log("✅ User SignalR Connected");
      } catch (err) {
        console.error("SignalR Error:", err);
      }
    };

    startConnection();

    // 🔥 RECEIVE CREATE + UPDATE
    connection.on("ReceiveNotification", (notification) => {
      console.log("🔥 Received:", notification);

      setNotifications((prev) => {
        const exists = prev.some((n) => n.id === notification.id);

        if (exists) {
          return prev.map((n) =>
            n.id === notification.id ? notification : n
          );
        } else {
          return [notification, ...prev];
        }
      });
    });

    // 🔥 RECEIVE DELETE
    connection.on("DeleteNotification", (id) => {
      setNotifications((prev) =>
        prev.filter((n) => n.id !== id)
      );
    });

    return () => {
      connection.stop();
    };
  }, []);

  return (
    <div className="dashboard-container">
      <div className="dashboard-card">
        <h1 className="dashboard-title">User Dashboard</h1>

        <h2 className="notification-heading">Notifications</h2>

        {notifications.length === 0 && (
          <p className="no-notification">
            No notifications available
          </p>
        )}

        {notifications.map((n) => (
          <div
            key={n.id}
            className="notification-card"
            onClick={() =>
              n.redirectUrl && navigate(n.redirectUrl)
            }
          >
            <h3>{n.title}</h3>
            <p>{n.message}</p>
            <span>
              {new Date(n.createdAt).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserDashboard;