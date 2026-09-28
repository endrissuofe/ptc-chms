import mongoose from 'mongoose';

/**
 * One invite link per team. Anyone with the link can ask to join that team; an admin approves
 * each person. Resetting a link gives it a new token, so the old one stops working.
 */
const joinLinkSchema = new mongoose.Schema(
  {
    role: { type: String, required: true, unique: true },
    token: { type: String, required: true, unique: true },
    uses: { type: Number, default: 0 },
    resetBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export default mongoose.models.JoinLink || mongoose.model('JoinLink', joinLinkSchema);
