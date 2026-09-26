import mongoose from 'mongoose';

/** A regular service the church runs, e.g. "Sunday Service" at 08:00. Managed by admins. */
const churchServiceSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, immutable: true },
    name: { type: String, required: true, trim: true },
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ }, // HH:mm, Lagos
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.models.ChurchService ||
  mongoose.model('ChurchService', churchServiceSchema);
