import { type ComplianceEnrollmentStatus, toComplianceEnrollmentStatus } from '../enums/ComplianceEnrollmentStatus.js';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

/**
 * A compliance enrollment — the merchant's provisioned e-reporting account for
 * one reporting country/regime (GET/POST /compliance/enrollments).
 */
export class ComplianceEnrollment {
  constructor(
    public readonly id: number,
    public readonly companyId: number,
    public readonly country: string,
    public readonly regime: string,
    public readonly provider: string,
    public readonly status: ComplianceEnrollmentStatus,
    public readonly statusLabel: string,
    public readonly statusError: string | null,
    public readonly providerAccountId: string | null,
    public readonly taxId: string | null,
    public readonly companyRegisterId: string | null,
    public readonly companyRegisterScheme: string | null,
    public readonly regimeConfig: Record<string, unknown> | null,
    /** First date transactions are reported for (YYYY-MM-DD). */
    public readonly reportingStartDate: string | null,
    public readonly notificationEmail: string | null,
    public readonly autoSend: boolean,
    public readonly createdAt: string | null,
    public readonly updatedAt: string | null,
  ) {}

  static fromArray(data: Record<string, unknown>): ComplianceEnrollment {
    const regimeConfig =
      typeof data['regime_config'] === 'object' &&
      data['regime_config'] !== null &&
      !Array.isArray(data['regime_config'])
        ? (data['regime_config'] as Record<string, unknown>)
        : null;

    return new ComplianceEnrollment(
      asNumber(data['id']),
      asNumber(data['company_id']),
      asString(data['country']),
      asString(data['regime']),
      asString(data['provider']),
      toComplianceEnrollmentStatus(data['status']),
      asString(data['status_label']),
      asNullableString(data['status_error']),
      asNullableString(data['provider_account_id']),
      asNullableString(data['tax_id']),
      asNullableString(data['company_register_id']),
      asNullableString(data['company_register_scheme']),
      regimeConfig,
      asNullableString(data['reporting_start_date']),
      asNullableString(data['notification_email']),
      data['auto_send'] === true,
      asNullableString(data['created_at']),
      asNullableString(data['updated_at']),
    );
  }
}
