const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
function loadEnvironment() {
  const environment = process.env.APP_ENV || process.env.NODE_ENV || "development";
  const root = path.resolve(__dirname, "..", "..");
  const envFile = path.join(root, `.env.${environment}`);
  if (fs.existsSync(envFile)) dotenv.config({ path: envFile });
  else if (environment === "development" && fs.existsSync(path.join(root, ".env"))) dotenv.config({ path: path.join(root, ".env") });
  return environment;
}
module.exports = { loadEnvironment };
