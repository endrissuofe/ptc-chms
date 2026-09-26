import mongoose from 'mongoose';

/** Every SMS attempt: automatic messages, broadcasts and tests. */
const smsLogSchema = new mongoose.Schema(
  {
    person: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
    // Who it was for, whether a first timer ("p:<id>") or a member ("m:<id>").
    recipientKey: { type: String },
    name: { type: String },
    template: { type: String },
    // Which batch this belongs to, e.g. "sunday_thanks:2026-09-27", "broadcast:<id>", "test:…".
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

// Nobody gets the same run twice (only successful sends count, so failures can be retried).
smsLogSchema.index(
  { runKey: 1, recipientKey: 1 },
  { unique: true, partialFilterExpression: { runKey: { $type: 'string' } } },
);
smsLogSchema.index({ createdAt: -1 });
smsLogSchema.index({ run: 1, createdAt: -1 });

export default mongoose.models.SmsLog || mongoose.model('SmsLog', smsLogSchema);
