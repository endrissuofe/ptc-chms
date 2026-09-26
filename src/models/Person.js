import mongoose from 'mongoose';
import { STAGES } from '@/lib/stages';

/** Anyone the church is following up: first timers now, all members later. */
const personSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    // Normalised +234... Not unique: family members sometimes share one phone.
    phone: { type: String, required: true },
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

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // no longer used
    // Follow-up: the last time someone got through, and the last attempt of any kind.
    lastContactAt: { type: Date },
    lastAttemptAt: { type: Date },
    lastOutcome: { type: String, enum: ['reached', 'no_answer', 'call_back', 'wrong_number'] },

    // Moved into the Members list: no longer followed up as a first timer.
    movedToMembersAt: { type: Date },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

personSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName}`;
});

personSchema.index({ phone: 1 });
personSchema.index({ stage: 1, firstVisitDate: -1 });
personSchema.index({ movedToMembersAt: 1, lastVisitDate: -1 });

export default mongoose.models.Person || mongoose.model('Person', personSchema);
