import React, { useEffect, useState } from "react";
import { adminApiRequest, getStoredAdminAuth } from "../lib/adminApi";

export default function StaffPage() {
  const role = getStoredAdminAuth().admin?.role;
  const [items, setItems] = useState([]); const [form, setForm] = useState({ name: "", email: "", role: "Staff" }); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const load = () => adminApiRequest("/staff").then((p) => setItems(p.items || []));
  useEffect(() => { load(); }, []);
  async function invite(e) { e.preventDefault(); setBusy(true); setMessage(""); try { await adminApiRequest("/staff/invitations", { method: "POST", body: form }); setForm({ name: "", email: "", role: "Staff" }); setMessage("Invitation sent."); load(); } catch (err) { setMessage(err.message); } finally { setBusy(false); } }
  const roles = role === "Owner" ? ["Staff", "Manager", "Owner"] : ["Staff"];
  return <div><div className="admin-page-header"><div><h1>Staff</h1><p>Invite and manage administrator access.</p></div></div>
    <div className="admin-card" style={{ padding: 18, marginBottom: 18 }}><form onSubmit={invite} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 160px auto", gap:10, alignItems:"end" }}><label className="admin-field"><span>Name</span><input className="admin-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label className="admin-field"><span>Email</span><input className="admin-input" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label className="admin-field"><span>Role</span><select className="admin-input" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>{roles.map(r=><option key={r}>{r}</option>)}</select></label><button className="admin-btn admin-btn--primary" disabled={busy}>{busy?"Sending…":"Send invitation"}</button></form>{message&&<p style={{marginTop:10}}>{message}</p>}</div>
    <div className="admin-card"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th></tr></thead><tbody>{items.map(a=><tr key={a._id}><td>{a.name}</td><td>{a.email}</td><td>{a.role}</td><td>{a.isActive?"Active":"Inactive"}</td><td>{a.lastLoginAt?new Date(a.lastLoginAt).toLocaleString():"Never"}</td></tr>)}</tbody></table></div></div>
  </div>;
}
