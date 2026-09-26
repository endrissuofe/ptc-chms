import mongoose from 'mongoose';

const followUpSchema = new mongoose.Schema(
  {
    person: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    outcome: {
      type: String,
      enum: ['reached', 'no_answer', 'call_back', 'wrong_number'],
      required: true,
    },
    channel: { type: String, enum: ['call', 'whatsapp', 'in_person'], default: 'call' },
    note: { type: String, trim: true },
  },
  { timestamps: true },
);

followUpSchema.index({ person: 1, createdAt: -1 });

export default mongoose.models.FollowUp || mongoose.model('FollowUp', followUpSchema);
