import mongoose from 'mongoose';

/** Every email attempt. runKey (set only on success) stops a daily email going out twice. */
const emailLogSchema = new mongoose.Schema(
  {
    kind: { type: String, required: true }, // followup_report | test
    to: { type: [String], default: [] },
    cc: { type: [String], default: [] },
    subject: { type: String },
    status: { type: String, enum: ['sent', 'failed'], required: true },
    provider: { type: String },
    error: { type: String },
    runKey: { type: String },
  },
  { timestamps: true },
);

emailLogSchema.index(
  { runKey: 1 },
  { unique: true, partialFilterExpression: { runKey: { $type: 'string' } } },
);
emailLogSchema.index({ createdAt: -1 });

export default mongoose.models.EmailLog || mongoose.model('EmailLog', emailLogSchema);
