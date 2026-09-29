import mongoose from 'mongoose';

/**
 * One thing on the media team's list (see lib/media.js for `ref`).
 * Items the app lists by itself (announcements, YouTube lives, birthdays) are only saved once
 * someone changes their status. Quick posts are saved when they are added, with their text.
 */
const mediaItemSchema = new mongoose.Schema(
  {
    ref: { type: String, required: true, unique: true },
    kind: {
      type: String,
      enum: ['announcement', 'livestream', 'celebrations', 'post'],
      required: true,
    },
    date: { type: Date, required: true }, // service date, birthday date, or the day a post is for
    status: { type: String, enum: ['todo', 'ready', 'posted'], default: 'todo' },
    postedAt: { type: Date },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Quick posts only
    title: { type: String, trim: true },
    details: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

mediaItemSchema.index({ date: 1 });

export default mongoose.models.MediaItem || mongoose.model('MediaItem', mediaItemSchema);
