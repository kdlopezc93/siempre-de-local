/**
 * Registro de auditoría (03 · audit_log): exportaciones, importaciones, cambios en tarjetas
 * y ajustes del equipo. Lo implementa el módulo audit; vive aquí para que cualquier caso de
 * uso registre sin depender de él.
 */
export interface AuditEntry {
  actorUserId: string;
  /** Verbo con punto, p. ej. `team.exported`, `rating.created`. */
  action: string;
  entity: string;
  entityId: string;
  teamId?: string;
  meta?: Record<string, unknown>;
}

export interface AuditLog {
  record(entry: AuditEntry): Promise<void>;
}

export const AUDIT_LOG = Symbol('AUDIT_LOG');
