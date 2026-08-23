import React,{useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {getReturns,approveReturn,rejectReturn,scheduleReturnPickup,receiveReturn,refundReturn,replacementReturn,completeReturn} from "../../services/returnsService";
import Badge from "../../components/Badge";
import Toast from "../../components/Toast";
import useToast from "../../hooks/useToast";
import PermissionBoundary from "../../components/PermissionBoundary";
import PageLoader from "../../components/PageLoader";

const labels={"requested":"Requested","approved":"Approved","rejected":"Rejected","pickup-scheduled":"Pickup scheduled","received":"Received","refunded":"Refunded","replacement-initiated":"Replacement initiated","completed":"Completed","cancelled":"Cancelled"};
export default function ReturnsPage(){
 const [data,setData]=useState({items:[],total:0}); const [status,setStatus]=useState(""); const [loading,setLoading]=useState(true); const {toast,showToast,clearToast}=useToast();
 async function load(){setLoading(true);try{setData(await getReturns({status,limit:50}));}catch(e){showToast(e.message||"Unable to load returns","danger");}finally{setLoading(false);}}
 useEffect(()=>{load();},[status]);
 async function run(fn,id,msg){try{await fn(id);showToast(msg);load();}catch(e){showToast(e.message||"Action failed","danger");}}
 return <PermissionBoundary permission="orders.write"><div>
  <div className="admin-page-header"><div><h1>Returns</h1><p>Review customer return requests and process approved returns.</p></div></div>
  <div className="admin-card" style={{marginBottom:16,display:"flex",gap:8}}>
   {["","requested","approved","pickup-scheduled","received","refunded","rejected"].map(s=><button key={s} className={`admin-btn ${status===s?"admin-btn--primary":"admin-btn--ghost"}`} onClick={()=>setStatus(s)}>{s?labels[s]:"All"}</button>)}
  </div>
  <div className="admin-card">{loading?<PageLoader />:data.items.length===0?<p>No return requests.</p>:
   <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Reason</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>
   {data.items.map(r=><tr key={r._id}><td><Link to={`/orders/${r.order?._id}`}>{r.order?._id}</Link></td><td>{r.user?.name||"—"}<br/><small>{r.user?.email}</small></td><td>{r.reason}</td><td><Badge>{labels[r.status]||r.status}</Badge></td><td>{new Date(r.createdAt).toLocaleDateString("en-IN")}</td><td style={{display:"flex",gap:6,flexWrap:"wrap"}}>
   {r.status==="requested"&&<><button className="admin-btn admin-btn--sm admin-btn--primary" onClick={()=>run(approveReturn,r._id,"Return approved")}>Approve</button><button className="admin-btn admin-btn--sm" onClick={()=>run(rejectReturn,r._id,"Return rejected")}>Reject</button></>}
   {r.status==="approved"&&<button className="admin-btn admin-btn--sm" onClick={()=>run(scheduleReturnPickup,r._id,"Pickup scheduled")}>Schedule pickup</button>}
   {r.status==="pickup-scheduled"&&<button className="admin-btn admin-btn--sm" onClick={()=>run(receiveReturn,r._id,"Return received")}>Received</button>}
   {r.status==="received"&&<button className="admin-btn admin-btn--sm admin-btn--primary" onClick={()=>run(()=>refundReturn(r._id),r._id,"Refund initiated")}>Refund</button>}
   {r.status==="received"&&<button className="admin-btn admin-btn--sm" onClick={()=>run(replacementReturn,r._id,"Replacement initiated")}>Replacement</button>}
   {r.status==="refunded"&&<button className="admin-btn admin-btn--sm" onClick={()=>run(completeReturn,r._id,"Return completed")}>Complete</button>}
   </td></tr>)}
   </tbody></table></div>}
  </div><Toast message={toast.message} tone={toast.tone} onClose={clearToast}/>
 </div></PermissionBoundary>
}
