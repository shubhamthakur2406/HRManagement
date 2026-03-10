import { useEffect, useState } from "react";
import * as signalR from "@microsoft/signalr";
import Calendar from "react-calendar";
import toast, { Toaster } from "react-hot-toast";
import "react-calendar/dist/Calendar.css";
import "./Attendance.css";

const UserAttendance = () => {

const [attendanceRecords,setAttendanceRecords] = useState({});
const [selectedDate,setSelectedDate] = useState(
new Date().toLocaleDateString("en-CA")
);
const [selectedStatus,setSelectedStatus] = useState("Not Marked");

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


/* ===== APPROVED EVENT ===== */

connection.on("AttendanceApproved",(data)=>{

toast.success("Attendance Approved ✅");

const date = new Date(data.date).toLocaleDateString("en-CA");

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


/* ===== REJECTED EVENT ===== */

connection.on("AttendanceRejected",(data)=>{

toast.error("Attendance Rejected ❌");

const date = new Date(data.date).toLocaleDateString("en-CA");

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


/* ================= MARK ATTENDANCE ================= */

const markAttendance = async()=>{

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
date:selectedDate
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

}catch{
toast.error("Server error");
}

};


/* ================= FORMAT DATE ================= */

const formatDate = (date)=>{
return date.toLocaleDateString("en-CA");
};


/* ================= CALENDAR COLORS ================= */

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

if(attendanceRecords[formatted]){
setSelectedStatus(attendanceRecords[formatted]);
}else{
setSelectedStatus("Not Marked");
}

};


/* ================= CURRENT STATUS ================= */

const currentStatus = attendanceRecords[selectedDate];


/* ================= UI ================= */

return(

<div className="attendance-page">

<Toaster position="top-right"/>

<h2>Attendance</h2>

<div className="attendance-card">

<button
className="btn-mark"
onClick={markAttendance}
disabled={currentStatus==="Pending"}
>
Mark Attendance
</button>

{currentStatus==="Pending" &&
<p className="status pending">
Waiting for admin approval
</p>
}

{currentStatus==="Approved" &&
<p className="status approved">
Attendance Approved
</p>
}

{currentStatus==="Rejected" &&
<p className="status rejected">
Attendance Rejected
</p>
}

{!currentStatus &&
<p className="status">
Not Marked
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