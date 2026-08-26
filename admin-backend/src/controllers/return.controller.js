const ReturnRequest = require("../models/ReturnRequest");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { transitionReturn } = require("../services/return.service");
const { initiateRefund } = require("../services/refund.service");
const { transitionOrder } = require("../services/orderLifecycle.service");
const { sendTransactionalEmail } = require("../services/email.service");

const getCustomerEmail = async (userId) => (await User.findById(userId).select("email name").lean()) || {};

const list = asyncHandler(async (req,res)=>{
  const {page=1,limit=20,status,search}=req.query;
  const filter={};
  if(status) filter.status=status;
  if(search){
    const orders=await Order.find({$or:[
      ...(String(search).match(/^[a-f0-9]{24}$/i)?[{_id:search}]:[]),
      { "shippingAddress.phone": { $regex:String(search).replace(/[.*+?^${}()|[\]\\]/g,"\\$&"), $options:"i" } }
    ]}).select("_id");
    filter.order={$in:orders.map(o=>o._id)};
  }
  const [items,total]=await Promise.all([
    ReturnRequest.find(filter).populate("order","items itemsTotal status shippingAddress createdAt").populate("user","name email").sort({createdAt:-1}).skip((page-1)*limit).limit(limit),
    ReturnRequest.countDocuments(filter)
  ]);
  res.json({items,page:Number(page),limit:Number(limit),total,totalPages:Math.ceil(total/limit)});
});
const getById=asyncHandler(async(req,res)=>{
  const item=await ReturnRequest.findById(req.params.id).populate("order").populate("user","name email");
  if(!item) throw ApiError.notFound("Return request not found.");
  res.json({returnRequest:item});
});
async function transition(req,res,to){
  const rr=await ReturnRequest.findById(req.params.id);
  if(!rr) throw ApiError.notFound("Return request not found.");
  const updated=await transitionReturn(rr,to,{actorType:"admin",actorId:req.admin?._id||null,note:req.body?.note||""});
  const user=await getCustomerEmail(rr.user);
  await sendTransactionalEmail("return",user.email,{orderId:rr.order,status:to,reason:req.body?.note||""},`return:${rr._id}:${to}`);
  res.json({returnRequest:updated});
}
const approve=asyncHandler((req,res)=>transition(req,res,"approved"));
const reject=asyncHandler((req,res)=>transition(req,res,"rejected"));
const schedulePickup=asyncHandler((req,res)=>transition(req,res,"pickup-scheduled"));
const receive=asyncHandler(async(req,res)=>{
  const rr=await ReturnRequest.findById(req.params.id);
  if(!rr) throw ApiError.notFound("Return request not found.");
  const updated=await transitionReturn(rr,"received",{actorType:"admin",actorId:req.admin?._id||null,note:req.body?.note||"Return received"});
  const order=await Order.findById(rr.order);
  if(order?.status==="return-requested") await transitionOrder(order,"returned",{actorType:"admin",actorId:req.admin?._id||null,note:"Returned to seller"});
  const user=await getCustomerEmail(rr.user);
  await sendTransactionalEmail("return",user.email,{orderId:rr.order,status:"received",reason:req.body?.note||""},`return:${rr._id}:received`);
  res.json({returnRequest:updated});
});
const replacement=asyncHandler((req,res)=>transition(req,res,"replacement-initiated"));
const complete=asyncHandler((req,res)=>transition(req,res,"completed"));
const refund=asyncHandler(async(req,res)=>{
  const rr=await ReturnRequest.findById(req.params.id);
  if(!rr) throw ApiError.notFound("Return request not found.");
  if(rr.status!=="received") throw ApiError.conflict("Only received returns can be refunded.");
  const order=await Order.findById(rr.order);
  if(!order) throw ApiError.notFound("Order not found.");
  const payment=await Payment.findOne({order:order._id,status:"paid"}).sort({createdAt:-1});
  if(!payment) throw ApiError.conflict("No refundable paid payment exists for this order.");
  const refund=await initiateRefund(payment,{amount:req.body?.amount ?? payment.amount,reason:req.body?.reason||"Approved return",actorId:req.admin?._id||null});
  const amount=Number(refund.refundedAmount||0);
  let updated=rr;
  if (refund.refundStatus === "processed") {
    updated=await transitionReturn(rr,"refunded",{actorType:"admin",actorId:req.admin?._id||null,note:"Refund processed"});
    updated.refundAmount=amount; await updated.save();
    if(order.status!=="refunded") await transitionOrder(order,"refunded",{actorType:"admin",actorId:req.admin?._id||null,note:"Return refund processed"});
  }
  const user=await getCustomerEmail(rr.user);
  await sendTransactionalEmail("refund",user.email,{orderId:order._id,amount, status:refund.refundStatus,refundId:refund.gatewayRefundId},`refund:return:${rr._id}:${refund.gatewayRefundId||"pending"}`);
  res.json({returnRequest:updated,payment:refund});
});
module.exports={list,getById,approve,reject,schedulePickup,receive,replacement,complete,refund};
