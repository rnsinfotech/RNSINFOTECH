const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    from: { type: String, enum: ["customer", "admin"], required: true },
    text: { type: String, required: true, trim: true },
    clientMessageId: { type: String, trim: true, default: null },
    ts: { type: Date, default: Date.now },
    readByCustomer: { type: Boolean, default: false },
    readByAdmin: { type: Boolean, default: false },
  },
  { _id: true }
);

const chatThreadSchema = new mongoose.Schema(
  {
    threadId: { type: String, required: true, unique: true, index: true },
    customerName: { type: String, trim: true, default: "Guest" },
    customerEmail: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["open", "closed"], default: "open", index: true },
    messages: { type: [messageSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

chatThreadSchema.index({ status: 1, updatedAt: -1 });

module.exports = mongoose.model("ChatThread", chatThreadSchema);
