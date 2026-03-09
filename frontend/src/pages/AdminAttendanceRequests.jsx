import { useEffect, useState } from "react";
import * as signalR from "@microsoft/signalr";
import toast, { Toaster } from "react-hot-toast";
import "./Attendance.css";

const AdminAttendanceRequests = () => {

const [requests,setRequests] = useState([]);
const [loadingId,setLoadingId] = useState(null);

const token = localStorage.getItem("token");

useEffect(()=>{

loadRequests();

/* SIGNALR CONNECTION */

const connection = new signalR.HubConnectionBuilder()
.withUrl("https://localhost:7130/attendanceHub",{
accessTokenFactory:()=>token
})
.withAutomaticReconnect()
.build();

connection.start()
.then(()=>console.log("Admin SignalR Connected"))
.catch(err=>console.log(err));

/* REALTIME NEW REQUEST */

connection.on("NewAttendanceRequest",(req)=>{
setRequests(prev=>[req,...prev]);
toast("New Attendance Request");
});

return ()=>connection.stop();

},[]);


/* LOAD REQUESTS */

const loadRequests = async ()=>{

try{

const res = await fetch(
"https://localhost:7130/api/attendance/requests",
{
headers:{
Authorization:`Bearer ${token}`
}
});

const data = await res.json();

setRequests(data);

}catch{

toast.error("Failed to load attendance requests");

}

};


/* APPROVE */

const approve = async(id)=>{

try{

setLoadingId(id);

const res = await fetch(
`https://localhost:7130/api/attendance/approve/${id}`,
{
method:"POST",
headers:{
Authorization:`Bearer ${token}`
}
});

if(!res.ok)
{
toast.error("Approval failed");
return;
}

setRequests(prev=>prev.map(x=>
x.id===id ? {...x,status:"Approved"} : x
));

toast.success("Attendance Approved");

}catch{

toast.error("Server error");

}

setLoadingId(null);

};


/* REJECT */

const reject = async(id)=>{

try{

setLoadingId(id);

const res = await fetch(
`https://localhost:7130/api/attendance/reject/${id}`,
{
method:"POST",
headers:{
Authorization:`Bearer ${token}`
}
});

if(!res.ok)
{
toast.error("Reject failed");
return;
}

setRequests(prev=>prev.map(x=>
x.id===id ? {...x,status:"Rejected"} : x
));

toast.error("Attendance Rejected");

}catch{

toast.error("Server error");

}

setLoadingId(null);

};


return(

<div className="attendance-page">

<Toaster position="top-right"/>

<h2>Attendance Requests</h2>

<div className="attendance-card">

<table className="attendance-table">

<thead>
<tr>
<th>User</th>
<th>Date</th>
<th>Status</th>
<th>Action</th>
</tr>
</thead>

<tbody>

{requests.length===0 && (
<tr>
<td colSpan="4" className="no-data">
No attendance requests
</td>
</tr>
)}

{requests.map(r=>(

<tr key={r.id}>

{/* USER NAME INSTEAD OF USER ID */}

<td>{r.userName}</td>

<td>{new Date(r.requestDate).toLocaleString()}</td>

<td>
<span className={`status-badge ${r.status?.toLowerCase()}`}>
{r.status || "Pending"}
</span>
</td>

<td>

<button
className="btn-approve"
disabled={loadingId===r.id || r.status==="Approved"}
onClick={()=>approve(r.id)}
>
{loadingId===r.id ? "Processing..." : "Approve"}
</button>

<button
className="btn-reject"
disabled={loadingId===r.id || r.status==="Rejected"}
onClick={()=>reject(r.id)}
>
Reject
</button>

</td>

</tr>

))}

</tbody>

</table>

</div>

</div>

);

};

export default AdminAttendanceRequests;