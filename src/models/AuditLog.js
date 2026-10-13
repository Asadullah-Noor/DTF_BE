import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true }, // create | update | delete | import
  entity: { type: String, required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId },
  before: mongoose.Schema.Types.Mixed,
  after: mongoose.Schema.Types.Mixed,
  at: { type: Date, default: Date.now },
});

export default mongoose.model('AuditLog', auditLogSchema);