import mongoose from 'mongoose';
import { ALL_ROLES } from '@/lib/roles';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    role: { type: String, enum: ALL_ROLES, required: true },
    passwordHash: { type: String, required: true },
    phone: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.models.User || mongoose.model('User', userSchema);
