import mongoose from 'mongoose';

/** Pastoral team only. Never returned by any API an usher or follow-up worker can call. */
const prayerRequestSchema = new mongoose.Schema(
  {
    person: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
    text: { type: String, required: true, trim: true },
    status: { type: String, enum: ['new', 'prayed', 'needs_visit'], default: 'new' },
    serviceDate: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

prayerRequestSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.PrayerRequest ||
  mongoose.model('PrayerRequest', prayerRequestSchema);
