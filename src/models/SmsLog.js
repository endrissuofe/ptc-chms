import mongoose from 'mongoose';

const smsLogSchema = new mongoose.Schema(
  {
    person: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
    template: { type: String },
    // Which batch this belongs to, e.g. "sunday_thanks:2026-09-27" or "test:2026-09-27".
    run: { type: String },
    to: { type: String, required: true },
    body: { type: String, required: true },
    provider: { type: String, required: true },
    status: { type: String, enum: ['sent', 'failed', 'skipped'], required: true },
    providerRef: { type: String },
    cost: { type: Number },
    error: { type: String },
    runKey: { type: String }, // set only on successful sends — stops double sends
  },
  { timestamps: true },
);

smsLogSchema.index(
  { runKey: 1, person: 1 },
  { unique: true, partialFilterExpression: { runKey: { $type: 'string' } } },
);
smsLogSchema.index({ createdAt: -1 });
smsLogSchema.index({ run: 1, createdAt: -1 });

export default mongoose.models.SmsLog || mongoose.model('SmsLog', smsLogSchema);
