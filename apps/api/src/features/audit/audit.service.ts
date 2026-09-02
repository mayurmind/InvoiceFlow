import { AuditRepository, AuditLogFilters } from './audit.repository';

export class AuditService {
  static async listAuditLogs(filters: AuditLogFilters) {
    const { total, data } = await AuditRepository.getAuditLogs(filters);

    return {
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
      data,
    };
  }
}
