// Client
export { TaxoraClient } from './client/TaxoraClient.js';
export { TaxoraClientFactory } from './client/TaxoraClientFactory.js';
export type { TaxoraClientOptions } from './client/TaxoraClient.js';

// Endpoints
export { AuthEndpoint } from './endpoints/AuthEndpoint.js';
export { CompanyEndpoint } from './endpoints/CompanyEndpoint.js';
export { VatEndpoint } from './endpoints/VatEndpoint.js';
export { SmartEnrichmentEndpoint } from './endpoints/SmartEnrichmentEndpoint.js';
export type {
  SmartEnrichmentInput,
  SmartEnrichmentUsage,
  SmartEnrichmentUsageHistoryEntry,
  SmartEnrichmentExportOptions,
  SmartEnrichmentStatisticsOptions,
  SmartEnrichmentWaitOptions,
} from './endpoints/SmartEnrichmentEndpoint.js';
export { EReportingEndpoint } from './endpoints/EReportingEndpoint.js';
export type {
  RevenueStatisticsFilters,
  EReportingInterval,
  ComplianceEnterpriseSize,
  ComplianceTypeOperation,
  ComplianceTransactionRequestType,
  ComplianceTransactionRequestState,
  ComplianceTaxReportRequestState,
  CreateComplianceEnrollmentInput,
  CreateComplianceTransactionInput,
  UpdateComplianceTransactionInput,
  ComplianceInvoiceLineInput,
  ComplianceInvoiceTaxInput,
  ComplianceTransactionFilters,
  EReportingAccessRequestInput,
} from './endpoints/EReportingEndpoint.js';

// DTOs
export { Token } from './dto/Token.js';
export { ScoreBreakdown } from './dto/ScoreBreakdown.js';
export { CompanyAddress } from './dto/CompanyAddress.js';
export type { CompanyResource } from './dto/CompanyResource.js';
export { VatValidationAddressInput } from './dto/VatValidationAddressInput.js';
export { ProviderDocumentLine } from './dto/ProviderDocumentLine.js';
export { ProviderDocument } from './dto/ProviderDocument.js';
export { VatResource } from './dto/VatResource.js';
export { VatCollection } from './dto/VatCollection.js';
export { VatCertificateExport } from './dto/VatCertificateExport.js';
export { SmartEnrichmentResource } from './dto/SmartEnrichmentResource.js';
export type {
  SmartEnrichmentProviderVerdict,
  SmartEnrichmentAddressQuality,
} from './dto/SmartEnrichmentResource.js';
export { SmartEnrichmentJob } from './dto/SmartEnrichmentJob.js';
export { SmartEnrichmentHistoryRow } from './dto/SmartEnrichmentHistoryRow.js';
export type { SmartEnrichmentHistoryInput } from './dto/SmartEnrichmentHistoryRow.js';
export { SmartEnrichmentHistoryPage } from './dto/SmartEnrichmentHistoryPage.js';
export type { SmartEnrichmentHistoryStats } from './dto/SmartEnrichmentHistoryPage.js';
export { SmartEnrichmentStatistics } from './dto/SmartEnrichmentStatistics.js';
export type {
  SmartEnrichmentStatisticsInterval,
  SmartEnrichmentStatisticsRange,
  SmartEnrichmentStatisticsTotals,
  SmartEnrichmentTimeBucket,
  SmartEnrichmentSourceBreakdown,
  SmartEnrichmentOutcomeBreakdown,
  SmartEnrichmentConfidenceBucket,
} from './dto/SmartEnrichmentStatistics.js';
export { RevenueStatistics } from './dto/RevenueStatistics.js';
export type {
  RevenueTotals,
  RevenueTimeBucket,
  RevenueTypeBreakdown,
  RevenueCountryBreakdown,
  RevenueStateBreakdown,
  RevenueCurrencyBreakdown,
} from './dto/RevenueStatistics.js';
export { ComplianceEnrollment } from './dto/ComplianceEnrollment.js';
export { ComplianceEnrollmentPage } from './dto/ComplianceEnrollmentPage.js';
export { ComplianceTransaction } from './dto/ComplianceTransaction.js';
export { ComplianceTransactionPage } from './dto/ComplianceTransactionPage.js';
export { ComplianceTaxReport } from './dto/ComplianceTaxReport.js';
export { ComplianceTaxReportPage } from './dto/ComplianceTaxReportPage.js';
export { SireneLookupResult } from './dto/SireneLookupResult.js';
export { VatRates } from './dto/VatRates.js';
export type { VatRate } from './dto/VatRates.js';
export { ImportResult } from './dto/ImportResult.js';

// Enums
export { Environment, getBaseUrl } from './enums/Environment.js';
export type { Environment as EnvironmentType } from './enums/Environment.js';
export { ApiVersion } from './enums/ApiVersion.js';
export { Language } from './enums/Language.js';
export { LoginIdentifier } from './enums/LoginIdentifier.js';
export { VatState, getFailedVatStates, describeVatState } from './enums/VatState.js';
export {
  SmartEnrichmentStatus,
  toSmartEnrichmentStatus,
  describeSmartEnrichmentStatus,
} from './enums/SmartEnrichmentStatus.js';
export {
  SmartEnrichmentMode,
  toSmartEnrichmentMode,
  describeSmartEnrichmentMode,
} from './enums/SmartEnrichmentMode.js';
export {
  ComplianceEnrollmentStatus,
  toComplianceEnrollmentStatus,
  describeComplianceEnrollmentStatus,
} from './enums/ComplianceEnrollmentStatus.js';
export {
  ComplianceTransactionState,
  toComplianceTransactionState,
  describeComplianceTransactionState,
} from './enums/ComplianceTransactionState.js';
export {
  ComplianceTransactionType,
  toComplianceTransactionType,
  describeComplianceTransactionType,
} from './enums/ComplianceTransactionType.js';
export {
  ComplianceTaxReportState,
  toComplianceTaxReportState,
  describeComplianceTaxReportState,
} from './enums/ComplianceTaxReportState.js';

// Exceptions
export { TaxoraException } from './exceptions/TaxoraException.js';
export { AuthenticationException } from './exceptions/AuthenticationException.js';
export { HttpException } from './exceptions/HttpException.js';
export { ValidationException } from './exceptions/ValidationException.js';
export { describeApiError } from './exceptions/apiErrorMessage.js';

// Retries
export { RetryPolicy, type RetryPolicyOptions } from './http/RetryPolicy.js';

// HTTP
export type { TokenStorageInterface } from './http/TokenStorageInterface.js';
export { InMemoryTokenStorage } from './http/InMemoryTokenStorage.js';
export type { HttpClientInterface } from './http/HttpClientInterface.js';
export { FetchHttpClient } from './http/FetchHttpClient.js';
export { AuthRetryHttpClient } from './http/AuthRetryHttpClient.js';
