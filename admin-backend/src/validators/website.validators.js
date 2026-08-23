const { z } = require("zod");
const websitePayloadSchema = z.record(z.string(), z.any());
module.exports = { websitePayloadSchema };
