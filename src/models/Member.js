import mongoose from 'mongoose';

/**
 * The church's member list (imported from CSV, or first timers moved in later).
 * Phones are normalised +234...; family members may share one.
 */
const memberSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true, default: '' },
    phone: { type: String, required: true },
    gender: { type: String, enum: ['male', 'female'] },
    birthDay: { type: Number, min: 1, max: 31 },
    birthMonth: { type: Number, min: 1, max: 12 },
    anniversaryDay: { type: Number, min: 1, max: 31 },
    anniversaryMonth: { type: Number, min: 1, max: 12 },
    source: { type: String, enum: ['csv', 'first_timer', 'manual'], default: 'csv' },
    // Set when a first timer is moved into the member list, so their journey stays linked.
    person: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
    smsOptOut: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

memberSchema.index({ phone: 1 });
memberSchema.index({ lastName: 1, firstName: 1 });
memberSchema.index({ birthMonth: 1, birthDay: 1 });
memberSchema.index({ anniversaryMonth: 1, anniversaryDay: 1 });

export default mongoose.models.Member || mongoose.model('Member', memberSchema);
