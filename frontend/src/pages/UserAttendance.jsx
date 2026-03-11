// import { useEffect, useState } from "react";
// import * as signalR from "@microsoft/signalr";
// import Calendar from "react-calendar";
// import toast, { Toaster } from "react-hot-toast";
// import "react-calendar/dist/Calendar.css";
// import "./Attendance.css";

// const UserAttendance = () => {

// const [attendanceRecords,setAttendanceRecords] = useState({});
// const [selectedDate,setSelectedDate] = useState(
// new Date().toLocaleDateString("en-CA")
// );
// const [selectedStatus,setSelectedStatus] = useState("Not Marked");

// const token = localStorage.getItem("token");


// /* ================= LOAD ATTENDANCE ================= */

// const loadAttendance = async()=>{

// try{

// const res = await fetch(
// "https://localhost:7130/api/attendance/my-attendance",
// {
// headers:{
// Authorization:`Bearer ${token}`
// }
// });

// const data = await res.json();

// const map = {};

// data.records?.forEach(r=>{
// const date = new Date(r.date).toLocaleDateString("en-CA");
// map[date] = r.status;
// });

// setAttendanceRecords(map);

// if(map[selectedDate]){
// setSelectedStatus(map[selectedDate]);
// }

// }catch{
// console.log("Failed to load attendance");
// }

// };


// /* ================= SIGNALR ================= */

// useEffect(()=>{

// loadAttendance();

// const connection = new signalR.HubConnectionBuilder()
// .withUrl("https://localhost:7130/attendanceHub",{
// accessTokenFactory:()=>token
// })
// .withAutomaticReconnect()
// .build();

// connection.start()
// .then(()=>console.log("SignalR Connected"))
// .catch(err=>console.log(err));


// /* ===== APPROVED EVENT ===== */

// connection.on("AttendanceApproved",(data)=>{

// toast.success("Attendance Approved ✅");

// const date = new Date(data.date).toLocaleDateString("en-CA");

// setAttendanceRecords(prev=>{

// const updated = {
// ...prev,
// [date]:"Approved"
// };

// if(date === selectedDate){
// setSelectedStatus("Approved");
// }

// return updated;

// });

// });


// /* ===== REJECTED EVENT ===== */

// connection.on("AttendanceRejected",(data)=>{

// toast.error("Attendance Rejected ❌");

// const date = new Date(data.date).toLocaleDateString("en-CA");

// setAttendanceRecords(prev=>{

// const updated = {
// ...prev,
// [date]:"Rejected"
// };

// if(date === selectedDate){
// setSelectedStatus("Rejected");
// }

// return updated;

// });

// });

// return ()=>connection.stop();

// },[selectedDate]);


// /* ================= MARK ATTENDANCE ================= */

// const markAttendance = async()=>{

// try{

// const res = await fetch(
// "https://localhost:7130/api/attendance/mark",
// {
// method:"POST",
// headers:{
// Authorization:`Bearer ${token}`,
// "Content-Type":"application/json"
// },
// body: JSON.stringify({
// date:selectedDate
// })
// }
// );

// if(!res.ok){
// toast.error("Attendance already requested");
// return;
// }

// toast.success("Attendance request sent");

// setAttendanceRecords(prev=>({
// ...prev,
// [selectedDate]:"Pending"
// }));

// setSelectedStatus("Pending");

// }catch{
// toast.error("Server error");
// }

// };


// /* ================= FORMAT DATE ================= */

// const formatDate = (date)=>{
// return date.toLocaleDateString("en-CA");
// };


// /* ================= CALENDAR COLORS ================= */

// const highlightAttendance = ({date})=>{

// const formatted = formatDate(date);
// const status = attendanceRecords[formatted];

// if(status === "Approved") return "present-day";
// if(status === "Rejected") return "rejected-day";
// if(status === "Pending") return "pending-day";

// };


// /* ================= CLICK DATE ================= */

// const handleDateClick = (date)=>{

// const formatted = formatDate(date);

// setSelectedDate(formatted);

// if(attendanceRecords[formatted]){
// setSelectedStatus(attendanceRecords[formatted]);
// }else{
// setSelectedStatus("Not Marked");
// }

// };


// /* ================= CURRENT STATUS ================= */

// const currentStatus = attendanceRecords[selectedDate];


// /* ================= UI ================= */

// return(

// <div className="attendance-page">

// <Toaster position="top-right"/>

// <h2>Attendance</h2>

// <div className="attendance-card">

// <button
// className="btn-mark"
// onClick={markAttendance}
// disabled={currentStatus==="Pending"}
// >
// Mark Attendance
// </button>

// {currentStatus==="Pending" &&
// <p className="status pending">
// Waiting for admin approval
// </p>
// }

// {currentStatus==="Approved" &&
// <p className="status approved">
// Attendance Approved
// </p>
// }

// {currentStatus==="Rejected" &&
// <p className="status rejected">
// Attendance Rejected
// </p>
// }

// {!currentStatus &&
// <p className="status">
// Not Marked
// </p>
// }

// </div>


// <div className="calendar-card">

// <h3>My Attendance Calendar</h3>

// <Calendar
// tileClassName={highlightAttendance}
// onClickDay={handleDateClick}
// />

// {selectedDate && (

// <div className="attendance-info">

// <h4>Attendance for {selectedDate}</h4>

// <p className={`status ${selectedStatus.toLowerCase().replace(" ","-")}`}>
// {selectedStatus}
// </p>

// </div>

// )}

// </div>

// </div>

// );

// };

// export default UserAttendance;

// import { useEffect, useState } from "react";
// import * as signalR from "@microsoft/signalr";
// import Calendar from "react-calendar";
// import toast, { Toaster } from "react-hot-toast";
// import "react-calendar/dist/Calendar.css";
// import "./Attendance.css";

// const UserAttendance = () => {

// const todayString = new Date().toLocaleDateString("en-CA");

// const [attendanceRecords,setAttendanceRecords] = useState({});
// const [selectedDate,setSelectedDate] = useState(todayString);
// const [selectedStatus,setSelectedStatus] = useState("Not Marked");

// const [showModal,setShowModal] = useState(false);
// const [reason,setReason] = useState("");

// const token = localStorage.getItem("token");


// /* ================= LOAD ATTENDANCE ================= */

// const loadAttendance = async()=>{

// try{

// const res = await fetch(
// "https://localhost:7130/api/attendance/my-attendance",
// {
// headers:{
// Authorization:`Bearer ${token}`
// }
// });

// const data = await res.json();

// const map = {};

// data.records?.forEach(r=>{
// const date = new Date(r.date).toLocaleDateString("en-CA");
// map[date] = r.status;
// });

// setAttendanceRecords(map);

// if(map[selectedDate]){
// setSelectedStatus(map[selectedDate]);
// }

// }catch{
// console.log("Failed to load attendance");
// }

// };


// /* ================= SIGNALR ================= */

// useEffect(()=>{

// loadAttendance();

// const connection = new signalR.HubConnectionBuilder()
// .withUrl("https://localhost:7130/attendanceHub",{
// accessTokenFactory:()=>token
// })
// .withAutomaticReconnect()
// .build();

// connection.start()
// .then(()=>console.log("SignalR Connected"))
// .catch(err=>console.log(err));


// /* APPROVED EVENT */

// connection.on("AttendanceApproved",(data)=>{

// const date = new Date(data.date).toLocaleDateString("en-CA");

// toast.success(`Attendance approved for ${date}`);

// setAttendanceRecords(prev=>{

// const updated = {
// ...prev,
// [date]:"Approved"
// };

// if(date === selectedDate){
// setSelectedStatus("Approved");
// }

// return updated;

// });

// });


// /* REJECTED EVENT */

// connection.on("AttendanceRejected",(data)=>{

// const date = new Date(data.date).toLocaleDateString("en-CA");

// toast.error(`Attendance rejected for ${date}`);

// setAttendanceRecords(prev=>{

// const updated = {
// ...prev,
// [date]:"Rejected"
// };

// if(date === selectedDate){
// setSelectedStatus("Rejected");
// }

// return updated;

// });

// });

// return ()=>connection.stop();

// },[selectedDate]);


// /* ================= CLOSE MODAL (ESC KEY) ================= */

// useEffect(()=>{

// const handleEsc = (e)=>{
// if(e.key === "Escape"){
// setShowModal(false);
// }
// };

// window.addEventListener("keydown",handleEsc);

// return ()=>{
// window.removeEventListener("keydown",handleEsc);
// };

// },[]);


// /* ================= MARK / REGULARIZE ================= */

// const applyAttendance = async()=>{

// try{

// const res = await fetch(
// "https://localhost:7130/api/attendance/mark",
// {
// method:"POST",
// headers:{
// Authorization:`Bearer ${token}`,
// "Content-Type":"application/json"
// },
// body: JSON.stringify({
// requestDate:selectedDate,
// reason:reason
// })
// }
// );

// if(!res.ok){
// toast.error("Attendance already requested");
// return;
// }

// toast.success("Attendance request sent");

// setAttendanceRecords(prev=>({
// ...prev,
// [selectedDate]:"Pending"
// }));

// setSelectedStatus("Pending");
// setShowModal(false);
// setReason("");

// }catch{

// toast.error("Server error");

// }

// };


// /* ================= DATE FORMAT ================= */

// const formatDate = (date)=>{
// return date.toLocaleDateString("en-CA");
// };


// /* ================= CALENDAR COLORS ================= */

// const highlightAttendance = ({date})=>{

// const formatted = formatDate(date);
// const status = attendanceRecords[formatted];

// if(status==="Approved") return "present-day";
// if(status==="Rejected") return "rejected-day";
// if(status==="Pending") return "pending-day";

// };


// /* ================= CLICK DATE ================= */

// const handleDateClick = (date)=>{

// const formatted = formatDate(date);

// const today = new Date();
// const clickedDate = new Date(formatted);

// const diffDays = Math.floor(
// (today - clickedDate) / (1000*60*60*24)
// );

// setSelectedDate(formatted);

// if(attendanceRecords[formatted]){
// setSelectedStatus(attendanceRecords[formatted]);
// }else{
// setSelectedStatus("Not Marked");
// }

// /* BLOCK FUTURE */

// if(clickedDate > today){
// toast.error("Future attendance not allowed");
// return;
// }

// /* TODAY → MARK ATTENDANCE */

// if(diffDays === 0){

// if(!attendanceRecords[formatted]){
// setShowModal(true);
// }

// return;
// }

// /* BLOCK OLDER THAN 7 DAYS */

// if(diffDays > 7){
// toast.error("You can regularize only last 7 days");
// return;
// }

// /* LAST 7 DAYS → REGULARIZE */

// if(diffDays > 0 && diffDays <= 7 && !attendanceRecords[formatted]){
// setShowModal(true);
// }

// };


// /* ================= UI ================= */

// return(

// <div className="attendance-page">

// <Toaster position="top-right"/>

// <h2>Attendance</h2>

// <div className="calendar-card">

// <h3>My Attendance Calendar</h3>

// <Calendar
// tileClassName={highlightAttendance}
// onClickDay={handleDateClick}
// maxDate={new Date()}
// />

// {selectedDate && (

// <div className="attendance-info">

// <h4>Attendance for {selectedDate}</h4>

// <p className={`status ${selectedStatus.toLowerCase().replace(" ","-")}`}>
// {selectedStatus}
// </p>

// </div>

// )}

// </div>


// {/* ================= REGULARIZATION MODAL ================= */}

// {showModal && (

// <div
// className="modal-overlay"
// onClick={()=>setShowModal(false)}
// >

// <div
// className="modern-modal"
// onClick={(e)=>e.stopPropagation()}
// >

// <h3>
// {selectedDate === todayString
// ? "Mark Attendance"
// : "Regularize Attendance"}
// </h3>

// <p>Date: {selectedDate}</p>

// <textarea
// placeholder="Enter reason"
// value={reason}
// onChange={(e)=>setReason(e.target.value)}
// />

// <div className="modal-actions">

// <button
// className="btn-cancel"
// onClick={()=>setShowModal(false)}
// >
// Cancel
// </button>

// <button
// className="btn-approve"
// onClick={applyAttendance}
// disabled={!reason}
// >
// Submit
// </button>

// </div>

// </div>

// </div>

// )}

// </div>

// );

// };

// export default UserAttendance;

import { useEffect, useState } from "react";
import * as signalR from "@microsoft/signalr";
import Calendar from "react-calendar";
import toast, { Toaster } from "react-hot-toast";
import "react-calendar/dist/Calendar.css";
import "./Attendance.css";

const UserAttendance = () => {

const todayString = new Date().toLocaleDateString("en-CA");

const [attendanceRecords,setAttendanceRecords] = useState({});
const [selectedDate,setSelectedDate] = useState(todayString);
const [selectedStatus,setSelectedStatus] = useState("Not Marked");

const [showModal,setShowModal] = useState(false);
const [reason,setReason] = useState("");

const token = localStorage.getItem("token");

const isToday = selectedDate === todayString;


/* ================= LOAD ATTENDANCE ================= */

const loadAttendance = async()=>{

try{

const res = await fetch(
"https://localhost:7130/api/attendance/my-attendance",
{
headers:{
Authorization:`Bearer ${token}`
}
});

const data = await res.json();

const map = {};

data.records?.forEach(r=>{
const date = new Date(r.date).toLocaleDateString("en-CA");
map[date] = r.status;
});

setAttendanceRecords(map);

if(map[selectedDate]){
setSelectedStatus(map[selectedDate]);
}

}catch{
console.log("Failed to load attendance");
}

};


/* ================= SIGNALR ================= */

useEffect(()=>{

loadAttendance();

const connection = new signalR.HubConnectionBuilder()
.withUrl("https://localhost:7130/attendanceHub",{
accessTokenFactory:()=>token
})
.withAutomaticReconnect()
.build();

connection.start()
.then(()=>console.log("SignalR Connected"))
.catch(err=>console.log(err));


connection.on("AttendanceApproved",(data)=>{

const date = new Date(data.date).toLocaleDateString("en-CA");

toast.success(`Attendance approved for ${date}`);

setAttendanceRecords(prev=>{

const updated = {
...prev,
[date]:"Approved"
};

if(date === selectedDate){
setSelectedStatus("Approved");
}

return updated;

});

});


connection.on("AttendanceRejected",(data)=>{

const date = new Date(data.date).toLocaleDateString("en-CA");

toast.error(`Attendance rejected for ${date}`);

setAttendanceRecords(prev=>{

const updated = {
...prev,
[date]:"Rejected"
};

if(date === selectedDate){
setSelectedStatus("Rejected");
}

return updated;

});

});

return ()=>connection.stop();

},[selectedDate]);


/* ================= CLOSE MODAL (ESC KEY) ================= */

useEffect(()=>{

const handleEsc = (e)=>{
if(e.key === "Escape"){
setShowModal(false);
}
};

window.addEventListener("keydown",handleEsc);

return ()=>{
window.removeEventListener("keydown",handleEsc);
};

},[]);


/* ================= MARK / REGULARIZE ================= */

const applyAttendance = async()=>{

try{

const res = await fetch(
"https://localhost:7130/api/attendance/mark",
{
method:"POST",
headers:{
Authorization:`Bearer ${token}`,
"Content-Type":"application/json"
},
body: JSON.stringify({
requestDate:selectedDate,
reason:isToday ? "" : reason
})
}
);

if(!res.ok){
toast.error("Attendance already requested");
return;
}

toast.success("Attendance request sent");

setAttendanceRecords(prev=>({
...prev,
[selectedDate]:"Pending"
}));

setSelectedStatus("Pending");
setShowModal(false);
setReason("");

}catch{

toast.error("Server error");

}

};


/* ================= DATE FORMAT ================= */

const formatDate = (date)=>{
return date.toLocaleDateString("en-CA");
};


/* ================= CALENDAR COLORS ================= */

const highlightAttendance = ({date})=>{

const formatted = formatDate(date);
const status = attendanceRecords[formatted];

if(status==="Approved") return "present-day";
if(status==="Rejected") return "rejected-day";
if(status==="Pending") return "pending-day";

};


/* ================= CLICK DATE ================= */

const handleDateClick = (date)=>{

const formatted = formatDate(date);

const today = new Date();
const clickedDate = new Date(formatted);

const diffDays = Math.floor(
(today - clickedDate) / (1000*60*60*24)
);

setSelectedDate(formatted);

if(attendanceRecords[formatted]){
setSelectedStatus(attendanceRecords[formatted]);
}else{
setSelectedStatus("Not Marked");
}

/* BLOCK FUTURE */

if(clickedDate > today){
toast.error("Future attendance not allowed");
return;
}

/* TODAY → MARK ATTENDANCE */

if(diffDays === 0){

if(!attendanceRecords[formatted]){
setShowModal(true);
}

return;
}

/* BLOCK OLDER THAN 7 DAYS */

if(diffDays > 7){
toast.error("You can regularize only last 7 days");
return;
}

/* LAST 7 DAYS → REGULARIZE */

if(diffDays > 0 && diffDays <= 7 && !attendanceRecords[formatted]){
setShowModal(true);
}

};


/* ================= UI ================= */

return(

<div className="attendance-page">

<Toaster position="top-right"/>

<h2>Attendance</h2>

<div className="calendar-card">

<h3>My Attendance Calendar</h3>

<Calendar
tileClassName={highlightAttendance}
onClickDay={handleDateClick}
maxDate={new Date()}
/>

{selectedDate && (

<div className="attendance-info">

<h4>Attendance for {selectedDate}</h4>

<p className={`status ${selectedStatus.toLowerCase().replace(" ","-")}`}>
{selectedStatus}
</p>

</div>

)}

</div>


{/* ================= ATTENDANCE MODAL ================= */}

{showModal && (

<div
className="modal-overlay"
onClick={()=>setShowModal(false)}
>

<div
className="modern-modal"
onClick={(e)=>e.stopPropagation()}
>

<h3>
{isToday ? "Mark Attendance" : "Regularize Attendance"}
</h3>

<p>Date: {selectedDate}</p>

{/* REASON ONLY FOR REGULARIZATION */}

{!isToday && (
<textarea
placeholder="Enter reason for regularization"
value={reason}
onChange={(e)=>setReason(e.target.value)}
/>
)}

<div className="modal-actions">

<button
className="btn-cancel"
onClick={()=>setShowModal(false)}
>
Cancel
</button>

<button
className="btn-approve"
onClick={applyAttendance}
disabled={!isToday && !reason}
>
Submit
</button>

</div>

</div>

</div>

)}

</div>

);

};

export default UserAttendance;