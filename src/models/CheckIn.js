import mongoose from 'mongoose';

/**
 * The one-month check-in: an SMS with a personal link to a short survey, sent once to each
 * first timer who agreed to messages, about a month after their first visit.
 */
const checkInSchema = new mongoose.Schema(
  {
    person: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true, unique: true },
    // The link's secret part: /c/<token>. Anyone with the link can answer, so it's random.
    token: { type: String, required: true, unique: true },
    answeredAt: { type: Date },
    rating: { type: Number, min: 1, max: 5 },
    wantsCall: { type: Boolean },
    comment: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

checkInSchema.index({ answeredAt: -1 });

export default mongoose.models.CheckIn || mongoose.model('CheckIn', checkInSchema);
