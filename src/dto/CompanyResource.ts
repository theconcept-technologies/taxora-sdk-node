export interface CompanyResource {
  id?: number;
  uuid?: string;
  name?: string;
  vat_uid?: string;
  address_line_1?: string | null;
  address_line_2?: string | null;
  street?: string | null;
  zip_code?: string | null;
  city?: string | null;
  country_code?: string | null;
  email?: string;
  phone_number?: string | null;
  api_rate_limit: number;
  vat_rate_limit: number;
  /**
   * @deprecated Use api_rate_limit and vat_rate_limit instead.
   */
  rate_limit?: number;
  state?: string;
  source?: string;
  [key: string]: unknown;
}

export function normalizeCompanyResource(data: Record<string, unknown>): CompanyResource {
  const apiRateLimit = typeof data['api_rate_limit'] === 'number' ? data['api_rate_limit'] : undefined;
  const vatRateLimit = typeof data['vat_rate_limit'] === 'number' ? data['vat_rate_limit'] : undefined;
  const legacyRateLimit = typeof data['rate_limit'] === 'number' ? data['rate_limit'] : undefined;

  return {
    ...data,
    api_rate_limit: apiRateLimit ?? legacyRateLimit ?? 0,
    vat_rate_limit: vatRateLimit ?? legacyRateLimit ?? 0,
  };
}
