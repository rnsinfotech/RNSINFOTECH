const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const AdminUser = require("../models/AdminUser");
const AdminInvitation = require("../models/AdminInvitation");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { env } = require("../config/env");
const { sendAdminInvitationEmail } = require("../services/email.service");

const SALT_ROUNDS = 12;

function allowedInviteRoles(adminRole) {
  return adminRole === "Owner" ? ["Owner", "Manager", "Staff"] : ["Staff"];
}

const list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, role } = req.query;
  const filter = {};
  if (search) filter.$or = [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }];
  if (role) filter.role = role;
  const [items, total] = await Promise.all([
    AdminUser.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    AdminUser.countDocuments(filter),
  ]);
  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
});

const create = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const name = String(req.body.name || "").trim();
  const password = String(req.body.password || "");
  const role = req.body.role || "Staff";
  if (!name || !email || !password) throw ApiError.badRequest("Name, email, and password are required.");
  if (!allowedInviteRoles(req.admin.role).includes(role)) throw ApiError.forbidden("You cannot create an account with that role.");
  const exists = await AdminUser.exists({ email });
  if (exists) throw ApiError.conflict("An admin account with that email already exists.");
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const admin = await AdminUser.create({ name, email, passwordHash, role, isActive: true });
  res.status(201).json({ admin });
});

const invite = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const name = String(req.body.name || "").trim();
  const role = req.body.role || "Staff";
  if (!name || !email) throw ApiError.badRequest("Name and email are required.");
  if (!allowedInviteRoles(req.admin.role).includes(role)) throw ApiError.forbidden("You cannot invite an account with that role.");
  if (await AdminUser.exists({ email })) throw ApiError.conflict("An admin account with that email already exists.");

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  await AdminInvitation.updateMany({ email, acceptedAt: null, cancelledAt: null }, { $set: { cancelledAt: new Date() } });
  const invitation = await AdminInvitation.create({ email, name, role, tokenHash, expiresAt: new Date(Date.now() + env.adminInvitationTtlMinutes * 60 * 1000), invitedBy: req.admin._id });
  const base = env.adminInvitationUrl || `${req.protocol}://${req.get("host")}/admin/accept-invitation`;
  const inviteUrl = `${base}${base.includes("?") ? "&" : "?"}token=${encodeURIComponent(rawToken)}`;
  try {
    await sendAdminInvitationEmail(email, name, role, inviteUrl);
  } catch (err) {
    invitation.cancelledAt = new Date();
    await invitation.save();
    throw err;
  }
  res.status(201).json({ invitation: { id: invitation._id, email, name, role, expiresAt: invitation.expiresAt } });
});

const acceptInvitation = asyncHandler(async (req, res) => {
  const token = String(req.body.token || "");
  const password = String(req.body.password || "");
  const name = String(req.body.name || "").trim();
  if (!token || password.length < 8) throw ApiError.badRequest("A valid invitation token and password of at least 8 characters are required.");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const invitation = await AdminInvitation.findOne({ tokenHash, expiresAt: { $gt: new Date() }, acceptedAt: null, cancelledAt: null }).select("+tokenHash");
  if (!invitation) throw ApiError.badRequest("This invitation is invalid, expired or already used.");
  if (await AdminUser.exists({ email: invitation.email })) throw ApiError.conflict("An admin account with this email already exists.");
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const admin = await AdminUser.create({ name: name || invitation.name, email: invitation.email, passwordHash, role: invitation.role, isActive: true });
  invitation.acceptedAt = new Date();
  await invitation.save();
  res.status(201).json({ admin: { _id: admin._id, name: admin.name, email: admin.email, role: admin.role, isActive: admin.isActive } });
});

module.exports = { list, create, invite, acceptInvitation };
