import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AuditEvent } from './AuditEvent.js';

export class AuditRepository {
  private readonly db: Database.Database;
  private readonly insertStatement: Database.Statement;
  private readonly readStatement: Database.Statement;
  constructor(path: string, busyTimeoutMs = 5000) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { timeout: busyTimeoutMs });
    try {
      this.db.pragma('foreign_keys = ON');
      if (path !== ':memory:') this.db.pragma('journal_mode = WAL');
      const version = this.db.pragma('user_version', { simple: true });
      if (version !== 0 && version !== 1) throw new Error('Unsupported audit schema');
      this.db.transaction(() => this.db.exec(readFileSync(new URL('../../migrations/001-create-audit-events.sql', import.meta.url), 'utf8')))();
      this.insertStatement = this.db.prepare('INSERT INTO audit_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      this.readStatement = this.db.prepare('SELECT * FROM audit_events WHERE correlation_id = ?');
    } catch (error) { this.db.close(); throw error; }
  }
  insert(event: AuditEvent): void {
    this.insertStatement.run(event.eventId, event.correlationId, event.occurredAt, event.toolName,
      event.sanitizedArguments === undefined ? null : JSON.stringify(event.sanitizedArguments), event.validationStatus,
      event.providerEvaluation === undefined ? null : JSON.stringify(event.providerEvaluation), JSON.stringify(event.policyDecision),
      JSON.stringify(event.upstreamOutcome), event.totalLatencyMs, event.configurationId, event.schemaVersion);
  }
  findByCorrelationId(id: string): AuditEvent | undefined {
    const row = this.readStatement.get(id) as Record<string, string | number | null> | undefined;
    if (!row) return undefined;
    return {
      schemaVersion: 1, eventId: String(row.event_id), correlationId: String(row.correlation_id), occurredAt: String(row.occurred_at),
      toolName: String(row.tool_name), validationStatus: row.validation_status as AuditEvent['validationStatus'],
      ...(row.sanitized_arguments_json === null ? {} : { sanitizedArguments: JSON.parse(String(row.sanitized_arguments_json)) }),
      ...(row.provider_json === null ? {} : { providerEvaluation: JSON.parse(String(row.provider_json)) }),
      policyDecision: JSON.parse(String(row.policy_json)), upstreamOutcome: JSON.parse(String(row.upstream_json)),
      totalLatencyMs: Number(row.total_latency_ms), configurationId: String(row.config_id),
    };
  }
  close(): void { this.db.close(); }
}
