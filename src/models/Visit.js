import mongoose from 'mongoose';

/** One row per person per service they attended. */
const visitSchema = new mongoose.Schema(
  {
    person: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
    serviceDate: { type: Date, required: true },
    service: { type: String, required: true }, // ChurchService key
    source: { type: String, enum: ['card', 'returning'], default: 'card' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

visitSchema.index({ person: 1, serviceDate: 1, service: 1 }, { unique: true });

export default mongoose.models.Visit || mongoose.model('Visit', visitSchema);
