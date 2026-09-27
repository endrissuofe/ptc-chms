import mongoose from 'mongoose';

/** Who gets the app's emails, and which ones are switched on. One document (key "alerts"). */
const alertSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'alerts', unique: true },
    followupEmails: { type: [String], default: [] },
    pastorEmails: { type: [String], default: [] },
    followUpReport: { type: Boolean, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export default mongoose.models.AlertSettings ||
  mongoose.model('AlertSettings', alertSettingsSchema);
