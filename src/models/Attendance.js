import mongoose from 'mongoose';

/** Attendance count per service — the figures ushers already take. */
const attendanceSchema = new mongoose.Schema(
  {
    serviceDate: { type: Date, required: true },
    service: { type: String, required: true }, // ChurchService key
    men: { type: Number, default: 0, min: 0 },
    women: { type: Number, default: 0, min: 0 },
    teens: { type: Number, default: 0, min: 0 },
    children: { type: Number, default: 0, min: 0 },
    note: { type: String, trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

attendanceSchema.index({ serviceDate: 1, service: 1 }, { unique: true });

attendanceSchema.virtual('total').get(function total() {
  return this.men + this.women + this.teens + this.children;
});

attendanceSchema.set('toJSON', { virtuals: true });

export default mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);
