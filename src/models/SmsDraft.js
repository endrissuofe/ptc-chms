import mongoose from 'mongoose';

/**
 * One week's wording for an automatic SMS, written by the AI writer (or edited by an admin).
 * A week runs Saturday to Friday; `weekOf` is that Saturday (a service date). With no draft for
 * the week, the message's backup wordings are used.
 */
const smsDraftSchema = new mongoose.Schema(
  {
    template: { type: String, required: true },
    weekOf: { type: Date, required: true },
    body: { type: String, required: true },
    source: { type: String, enum: ['ai', 'edited'], required: true },
    model: { type: String },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

smsDraftSchema.index({ template: 1, weekOf: 1 }, { unique: true });

export default mongoose.models.SmsDraft || mongoose.model('SmsDraft', smsDraftSchema);
