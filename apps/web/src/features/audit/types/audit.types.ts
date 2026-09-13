export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface AuditLogActor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface AuditLog {
  id: string;
  createdAt: string;
  actorUserId: string | null;
  actorUser?: AuditLogActor;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata?: Record<string, JsonValue>;
}

export interface AuditLogResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  data: AuditLog[];
}

export interface AuditLogFiltersState {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  dateFrom: string;
  dateTo: string;
}

export const AUDIT_ACTIONS = [
  'AUTH_LOGIN_FAILED', 'AUTH_LOGIN_SUCCEEDED', 'AUTH_REFRESH_REPLAY_DETECTED', 
  'AUTH_REFRESH_SUCCEEDED', 'AUTH_LOGOUT', 'AUTH_LOGOUT_ALL',
  'USER_PROVISIONED', 'USER_ROLE_CHANGED', 'USER_PASSWORD_RESET', 
  'USER_PASSWORD_CHANGED', 'USER_REACTIVATED', 'USER_DEACTIVATED',
  'CLIENT_CREATED', 'CLIENT_UPDATED', 'CLIENT_ARCHIVED', 'CLIENT_RESTORED',
  'INVOICE_CREATED', 'INVOICE_UPDATED', 'INVOICE_ISSUED', 'INVOICE_CANCELLED',
  'INVOICE_EMAIL_ATTEMPTED', 'INVOICE_EMAIL_ACCEPTED', 'INVOICE_EMAIL_FAILED',
  'PAYMENT_CREATED', 'PAYMENT_REVERSED',
  'BUSINESS_SETTINGS_CREATED', 'BUSINESS_SETTINGS_UPDATED'
] as const;

export const AUDIT_ENTITY_TYPES = [
  'AUTH', 'SESSION', 'USER', 'CLIENT', 'INVOICE', 'PAYMENT', 'BUSINESS_SETTINGS'
] as const;
