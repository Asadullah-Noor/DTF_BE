import AuditLog from '../models/AuditLog.js';

const plain = (d) => (d && typeof d.toObject === 'function' ? d.toObject() : d);

export function logAudit(action, entity, entityId, before, after) {
  return AuditLog.create({
    action,
    entity,
    entityId,
    before: plain(before),
    after: plain(after),
  }).catch((e) => console.error('Audit log failed:', e.message));
}