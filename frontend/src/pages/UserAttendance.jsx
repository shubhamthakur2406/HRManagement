import { useEffect, useState } from "react";
import * as signalR from "@microsoft/signalr";
import Calendar from "react-calendar";
import toast, { Toaster } from "react-hot-toast";
import "react-calendar/dist/Calendar.css";
import "./Attendance.css";

const UserAttendance = () => {

const [status,setStatus] = useState("");
const [attendanceRecords,setAttendanceRecords] = useState({});

const [selectedDate,setSelectedDate] = useState(null);
const [selectedStatus,setSelectedStatus] = useState("");

const token = localStorage.getItem("token");


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

if(data.todayStatus)
{
setStatus(data.todayStatus.toLowerCase());
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


/* ===== APPROVED ===== */

connection.on("AttendanceApproved",(data)=>{

toast.success("Attendance Approved ✅");

setStatus("approved");

/* update calendar instantly */

const date = new Date(data.date).toLocaleDateString("en-CA");

setAttendanceRecords(prev=>({
...prev,
[date]:"Approved"
}));

if(selectedDate === date)
{
setSelectedStatus("Approved");
}

});


/* ===== REJECTED ===== */

connection.on("AttendanceRejected",(data)=>{

toast.error("Attendance Rejected ❌");

setStatus("rejected");

const date = new Date(data.date).toLocaleDateString("en-CA");

setAttendanceRecords(prev=>({
...prev,
[date]:"Rejected"
}));

if(selectedDate === date)
{
setSelectedStatus("Rejected");
}

});


return ()=>connection.stop();

},[selectedDate]);


/* ================= MARK ATTENDANCE ================= */

const markAttendance = async()=>{

try{

const res = await fetch(
"https://localhost:7130/api/attendance/mark",
{
method:"POST",
headers:{
Authorization:`Bearer ${token}`
}
}
);

if(!res.ok)
{
toast.error("Attendance already requested today");
return;
}

toast.success("Attendance request sent");

setStatus("pending");

}catch{

toast.error("Server error");

}

};


/* ================= FORMAT DATE ================= */

const formatDate = (date)=>{
return date.toLocaleDateString("en-CA");
};


/* ================= CALENDAR COLOR ================= */

const highlightAttendance = ({date})=>{

const formatted = formatDate(date);

const status = attendanceRecords[formatted];

if(status === "Approved") return "present-day";
if(status === "Rejected") return "rejected-day";
if(status === "Pending") return "pending-day";

};


/* ================= CLICK DATE ================= */

const handleDateClick = (date)=>{

const formatted = formatDate(date);

setSelectedDate(formatted);

const status = attendanceRecords[formatted];

if(status)
{
setSelectedStatus(status);
}
else
{
setSelectedStatus("Not Marked");
}

};


/* ================= UI ================= */

return(

<div className="attendance-page">

<Toaster position="top-right"/>

<h2>Attendance</h2>

<div className="attendance-card">

<button
className="btn-mark"
onClick={markAttendance}
disabled={status==="pending"}
>
Mark Attendance
</button>

{status==="pending" &&
<p className="status pending">
Waiting for admin approval
</p>
}

{status==="approved" &&
<p className="status approved">
Attendance Approved
</p>
}

{status==="rejected" &&
<p className="status rejected">
Attendance Rejected
</p>
}

</div>


<div className="calendar-card">

<h3>My Attendance Calendar</h3>

<Calendar
tileClassName={highlightAttendance}
onClickDay={handleDateClick}
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

</div>

);

};

export default UserAttendance;