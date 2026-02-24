// import { useEffect, useState } from "react";
// import axios from "../api/axiosInstance";
// import "./UserNotifications.css";

// function UserDashboard() {
//   const [notifications, setNotifications] = useState([]);

//   useEffect(() => {
//     axios.get("/user/notifications")
//       .then(res => setNotifications(res.data));
//   }, []);

//    return (
//     <div className="notifications-page">
//       <h2>Notifications</h2>

//       {notifications.length === 0 ? (
//         <p>No notifications</p>
//       ) : (
//         notifications.map(n => (
//           <div key={n.id} className="notification-card">
//             <div className="notification-title">{n.title}</div>
//             <div className="notification-message">{n.message}</div>
//             <div className="notification-date">
//               {new Date(n.createdAt).toLocaleString()}
//             </div>
//           </div>
//         ))
//       )}
//     </div>
//   );
// }

// export default UserDashboard;


import React, { useEffect, useState } from "react";
import { connection } from "../signalRConnection";
import { useNavigate } from "react-router-dom";
import "./UserNotifications.css";

const UserDashboard = () => {
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();

  // 🔹 1️⃣ Fetch old notifications from DB
  useEffect(() => {
    fetch("https://localhost:7130/api/user/notifications", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    })
      .then(res => res.json())
      .then(data => setNotifications(data))
      .catch(err => console.log(err));
  }, []);

  // 🔹 2️⃣ Real-time SignalR listener
  useEffect(() => {
    connection.start()
      .then(() => console.log("SignalR Connected"))
      .catch(err => console.log(err));

    connection.on("ReceiveNotification", (notification) => {
      setNotifications(prev => {
        const exists = prev.some(n => n.id === notification.id);

        if (exists) {
          // 🔄 Update existing notification (NO DUPLICATE)
          return prev.map(n =>
            n.id === notification.id ? notification : n
          );
        } else {
          // ➕ Add new notification
          return [notification, ...prev];
        }
      });

      // Optional auto redirect
      if (notification.redirectUrl) {
        navigate(notification.redirectUrl);
      }
    });

    connection.on("DeleteNotification", (id) => {
      setNotifications(prev =>
        prev.filter(n => n.id !== id)
      );
    });

    return () => {
      connection.off("ReceiveNotification");
      connection.off("DeleteNotification");
    };
  }, [navigate]);

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
            onClick={() => n.redirectUrl && navigate(n.redirectUrl)}
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