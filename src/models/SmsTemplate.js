import mongoose from 'mongoose';

const smsTemplateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // see TEMPLATE_INFO in lib/sms/templates.js
    name: { type: String, required: true },
    body: { type: String, required: true },
    // Rotating messages (Saturday invites): more wordings after `body`, one used per week.
    variants: { type: [String], default: undefined },
    // A wording for one Saturday only (e.g. Thanksgiving tomorrow): used on `date` in place of
    // that week's turn, then the rotation carries on by itself.
    oneOff: { date: Date, body: String },
    enabled: { type: Boolean, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export default mongoose.models.SmsTemplate || mongoose.model('SmsTemplate', smsTemplateSchema);
