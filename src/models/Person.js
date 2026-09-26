import mongoose from 'mongoose';
import { STAGES } from '@/lib/stages';

/** Anyone the church is following up: first timers now, all members later. */
const personSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true }, // normalised +234...
    email: { type: String, trim: true, lowercase: true },
    birthDay: { type: Number, min: 1, max: 31 },
    birthMonth: { type: Number, min: 1, max: 12 },
    smsConsent: { type: Boolean, default: false },
    cardUnclear: { type: Boolean, default: false },

    stage: { type: String, enum: Object.values(STAGES), default: STAGES.FIRST_TIMER },
    inBelieversClass: { type: Boolean, default: false },
    isMember: { type: Boolean, default: false },
    firstVisitDate: { type: Date, required: true },
    lastVisitDate: { type: Date },
    visitCount: { type: Number, default: 0 },

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastContactAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

personSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName}`;
});

personSchema.index({ stage: 1, firstVisitDate: -1 });

export default mongoose.models.Person || mongoose.model('Person', personSchema);
