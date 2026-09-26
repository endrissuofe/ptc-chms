import mongoose from 'mongoose';

/**
 * One message sent to a group (e.g. all members). The recipient list is copied in when the
 * broadcast is created, then sent in small batches; `cursor` is how far the sending has got.
 */
const broadcastSchema = new mongoose.Schema(
  {
    audience: { type: String, required: true },
    body: { type: String, required: true },
    recipients: [
      {
        _id: false,
        key: String, // "m:<memberId>" or "p:<personId>"
        firstName: String,
        lastName: String,
        phone: String,
      },
    ],
    total: { type: Number, required: true },
    cursor: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    status: { type: String, enum: ['sending', 'done'], default: 'sending' },
    finishedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

broadcastSchema.index({ createdAt: -1 });

export default mongoose.models.Broadcast || mongoose.model('Broadcast', broadcastSchema);
