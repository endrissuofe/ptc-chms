import mongoose from 'mongoose';

/**
 * The church's brand kit for posts: where it is online and what goes at the end of each post.
 * One document (key "media"). The church's name and logo come from lib/church-profile.js.
 */
const mediaSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'media', unique: true },
    address: { type: String, trim: true, default: '' },
    facebook: { type: String, trim: true, default: '' }, // page link
    instagram: { type: String, trim: true, default: '' }, // handle, without @
    youtube: { type: String, trim: true, default: '' }, // channel link
    hashtags: { type: [String], default: [] }, // without #
    signoff: { type: String, trim: true, default: '' }, // last line of WhatsApp messages
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export default mongoose.models.MediaSettings ||
  mongoose.model('MediaSettings', mediaSettingsSchema);
