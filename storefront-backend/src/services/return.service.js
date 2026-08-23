const ApiError = require("../utils/ApiError");
const ReturnRequest = require("../models/ReturnRequest");

const TRANSITIONS = Object.freeze({
  requested: ["approved", "rejected", "cancelled"],
  approved: ["pickup-scheduled", "received", "cancelled"],
  "pickup-scheduled": ["received", "cancelled"],
  received: ["refunded", "replacement-initiated"],
  refunded: ["completed"],
  "replacement-initiated": ["completed"],
  rejected: [],
  completed: [],
  cancelled: [],
});

const TIMESTAMPS = {
  "pickup-scheduled": "pickupScheduledAt",
  received: "receivedAt",
};

function canTransition(from,to){ return Boolean(TRANSITIONS[from]?.includes(to)); }

async function transitionReturn(returnRequest,to,{actorType="system",actorId=null,note=""}={}) {
  if (!returnRequest) throw ApiError.notFound("Return request not found.");
  if (!canTransition(returnRequest.status,to)) throw ApiError.conflict(`Invalid return transition: "${returnRequest.status}" -> "${to}".`);
  const now=new Date();
  const set={status:to};
  if(TIMESTAMPS[to]) set[TIMESTAMPS[to]]=now;
  if(to==="rejected") set.rejectionReason=note||"Return rejected";
  const updated=await ReturnRequest.findOneAndUpdate(
    {_id:returnRequest._id,status:returnRequest.status},
    {$set:set,$push:{statusHistory:{status:to,at:now,actorType,actorId,note}}},
    {new:true}
  );
  if(!updated) throw ApiError.conflict("Return request changed concurrently. Refresh and retry.");
  return updated;
}
module.exports={TRANSITIONS,canTransition,transitionReturn};
