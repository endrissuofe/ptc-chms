import mongoose from 'mongoose';

/**
 * What one service was about on one date: theme, preacher, Bible text, and the YouTube video
 * once it has been streamed. Filled in by the media team or a pastor; together these make the
 * church's sermon list.
 */
const serviceDaySchema = new mongoose.Schema(
  {
    service: { type: String, required: true }, // ChurchService key
    serviceDate: { type: Date, required: true }, // midnight UTC of the Lagos day
    theme: { type: String, trim: true, default: '' },
    preacher: { type: String, trim: true, default: '' },
    bibleText: { type: String, trim: true, default: '' },
    youtubeUrl: { type: String, trim: true, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

serviceDaySchema.index({ service: 1, serviceDate: 1 }, { unique: true });
serviceDaySchema.index({ serviceDate: -1 });

export default mongoose.models.ServiceDay || mongoose.model('ServiceDay', serviceDaySchema);
