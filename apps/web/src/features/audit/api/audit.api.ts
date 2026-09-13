import { apiClient } from '../../../lib/api/client';
import type { AuditLogResponse } from '../types/audit.types';

export const auditApi = {
  getAuditLogs: async (params?: { 
    page?: number;
    limit?: number;
    actorUserId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<AuditLogResponse> => {
    const searchParams = new URLSearchParams();
    
    if (params) {
      if (params.page !== undefined) searchParams.set('page', params.page.toString());
      if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());
      if (params.actorUserId) searchParams.set('actorUserId', params.actorUserId);
      if (params.action) searchParams.set('action', params.action);
      if (params.entityType) searchParams.set('entityType', params.entityType);
      if (params.entityId) searchParams.set('entityId', params.entityId);
      if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
      if (params.dateTo) searchParams.set('dateTo', params.dateTo);
    }
    
    const queryString = searchParams.toString();
    const url = queryString ? `/audit?${queryString}` : '/audit';
    
    return apiClient.get<AuditLogResponse>(url);
  },
};
