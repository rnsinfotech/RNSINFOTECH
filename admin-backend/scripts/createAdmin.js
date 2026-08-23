// One-off bootstrap script — this service has no public signup route (by
// design: every route is staff-only, see HANDOFF.md), so the very first
// Owner account has to be created out-of-band. Later phases may add an
// in-app "invite staff" flow for Owners/Managers to create further
// accounts; this script stays useful either way as a break-glass tool.
//
// Usage:
//   node scripts/createAdmin.js --email <admin-email> --password "..." --name "Jane Doe" --role Owner
//   npm run seed:admin -- --email <admin-email> --password "..." --name "Jane Doe"
//
// If an account with that email already exists, updates its name/role and
// resets its password instead of failing — makes the script idempotent for
// re-running in a fresh environment.

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const { env } = require("../src/config/env");
const logger = require("../src/utils/logger");
const AdminUser = require("../src/models/AdminUser");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true;
      args[key] = value;
      if (value !== true) i += 1;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = (args.email || "").toLowerCase().trim();
  const password = args.password;
  const name = args.name || "Store Owner";
  const role = args.role || "Owner";

  if (!email || !password) {
    logger.error("Usage: node scripts/createAdmin.js --email <email> --password <password> [--name <name>] [--role Owner|Manager|Staff]");
    process.exit(1);
  }
  if (!AdminUser.ROLES.includes(role)) {
    logger.error(`--role must be one of: ${AdminUser.ROLES.join(", ")}`);
    process.exit(1);
  }
  if (password.length < 8) {
    logger.error("--password must be at least 8 characters.");
    process.exit(1);
  }

  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await AdminUser.findOne({ email });

  if (existing) {
    existing.name = name;
    existing.role = role;
    existing.isActive = true;
    existing.passwordHash = passwordHash;
    await existing.save();
    logger.info(`Updated existing admin account: ${email} (role: ${role})`);
  } else {
    await AdminUser.create({ email, name, role, passwordHash, isActive: true });
    logger.info(`Created admin account: ${email} (role: ${role})`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  logger.error("Failed to create/update admin account:", err.message);
  process.exit(1);
});
