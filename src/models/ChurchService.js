import mongoose from 'mongoose';

/**
 * A service the church holds. Regular ones repeat on `days` (0 = Sunday … 6 = Saturday);
 * special ones happen once, on `date` (midnight UTC of the Lagos day).
 */
const churchServiceSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, immutable: true },
    name: { type: String, required: true, trim: true },
    kind: { type: String, enum: ['regular', 'special'], default: 'regular', immutable: true },
    days: { type: [{ type: Number, min: 0, max: 6 }], default: undefined },
    date: { type: Date },
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ }, // HH:mm, Lagos
    active: { type: Boolean, default: true },
    livestream: { type: Boolean }, // streamed live on YouTube; unset: see isStreamed in lib/church
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

churchServiceSchema.index({ kind: 1, date: 1 });

export default mongoose.models.ChurchService ||
  mongoose.model('ChurchService', churchServiceSchema);
