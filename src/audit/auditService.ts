import type { Logger } from 'pino';
import type { AuditEvent } from './AuditEvent.js';
import type { AuditRepository } from './AuditRepository.js';

export function createAuditService(repository: AuditRepository, logger: Logger): (event: AuditEvent) => void {
  return event => {
    logger.info({ event: 'tool_decision', ...event });
    try { repository.insert(event); }
    catch { logger.error({ event: 'audit_write_failed', correlationId: event.correlationId }); }
  };
}
