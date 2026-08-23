import { adminApiRequest } from "../lib/adminApi";
export async function getReturns(filters={}) {
  const p=new URLSearchParams({page:String(filters.page||1),limit:String(filters.limit||20)});
  if(filters.status)p.set("status",filters.status); if(filters.search)p.set("search",filters.search);
  return adminApiRequest(`/returns?${p.toString()}`);
}
export async function getReturn(id){ const p=await adminApiRequest(`/returns/${id}`); return p.returnRequest; }
async function action(id,name,body={}){ const p=await adminApiRequest(`/returns/${id}/${name}`,{method:"POST",body}); return p.returnRequest; }
export const approveReturn=(id,note)=>action(id,"approve",{note});
export const rejectReturn=(id,note)=>action(id,"reject",{note});
export const scheduleReturnPickup=(id,note)=>action(id,"pickup-scheduled",{note});
export const receiveReturn=(id,note)=>action(id,"received",{note});
export const refundReturn=(id,amount,reason)=>action(id,"refund",{amount,reason});
export const replacementReturn=(id,note)=>action(id,"replacement",{note});
export const completeReturn=(id,note)=>action(id,"complete",{note});
