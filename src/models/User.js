import mongoose from 'mongoose';
import { ALL_ROLES } from '@/lib/roles';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    role: { type: String, enum: ALL_ROLES, required: true },
    passwordHash: { type: String, required: true },
    phone: { type: String },
    email: { type: String, trim: true, lowercase: true },
    active: { type: Boolean, default: true },
    // Signed up with an invite link and waiting for an admin (active stays false until then).
    pending: { type: Boolean, default: false },
    // One person's own login (signed up themselves), as opposed to a team's shared login.
    personal: { type: Boolean, default: false },
    // Which emails this login gets (see ALERTS in lib/users.js).
    alerts: {
      followUp: { type: Boolean, default: false },
      celebrations: { type: Boolean, default: false },
    },
    approvedAt: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastSignInAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
);

export default mongoose.models.User || mongoose.model('User', userSchema);
