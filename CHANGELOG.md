# Changelog

All notable changes to `@taxora/sdk` are documented here. Versions follow [SemVer](https://semver.org/).

## [Unreleased]

### Added

- **`eReporting.getNotificationSettings()` / `eReporting.updateNotificationSettings(input)`** —
  `GET` / `PUT /compliance/notification-settings`: the company's opt-in compliance emails as
  `ComplianceNotificationSettings` (`{ recipients, language, notOnPeppol, digest, digestSentAt }`). `notOnPeppol` =
  hourly email listing invoices held back because the buyer is not on Peppol; `digest` = `'off' | 'daily' | 'weekly'`
  summary. Updates send only the provided fields (`UpdateComplianceNotificationSettingsInput`, at least one; max 5
  recipients, validated before the request); 422 when an email is switched on without recipients, 403 `admin_only` /
  `read_only_role` for non-admins.
- **`eReporting.exportTransactionsCsv(filters)`** — `GET /compliance/transactions/export.csv`: all transactions
  matching the `listTransactions()` filters (without pagination, type `ComplianceTransactionExportFilters`) as a
  semicolon-separated CSV for bookkeeping, incl. internal reference, delivery state, buyer rejection and ECB EUR
  columns (max 50,000 rows). Returned verbatim as a string.
- **`ComplianceTransaction.eurEquivalent`** (`{ subtotal, taxAmount, total, rate, rateDate, source: 'ECB' }`): the
  amounts of a non-EUR invoice in EUR at the ECB reference rate of the invoice date; null for EUR invoices or when no
  rate is known.
- **E-invoicing status signals:** `compliance.transaction.state_changed` now fires for every real change (Taxora's
  own state and the provider's delivery state: accepted, refused, paid, …; never twice, never for `sending`).
  `ComplianceTransactionWebhookObject` gained the optional `internal_reference`, `previous_state`,
  `previous_provider_state`, `buyer_rejected`, `rejection_reason`, `submission_error` and `delivery_check`, plus the
  helper **`isTransactionBuyerRejected(object)`**.
- **`ComplianceTransaction.buyerRejected` / `.rejectionReason`** and the **`providerState`** filter on
  `listTransactions()` (e.g. `'refused'` = rejected by the buyer).
- **`eReporting.getTransactionPdf(id)`** downloads the invoice as a readable PDF (the attached seller PDF or the
  provider's rendering of the e-invoice) as `{ content, contentType, filename }`; 409 while no PDF is available.
  **`ComplianceTransaction.pdfUrl`** is set once a PDF is available.
- **Internal reference:** `internalReference` on `createTransaction()` and `updateTransaction()` (max 100 chars;
  an empty string clears it on update) and `ComplianceTransaction.internalReference`. Your own reference (order
  number, ERP id) for searching — never sent to the buyer or the tax authority. Also an optional CSV import column
  `internal_reference`.
- **`listTransactions()` filters `search`** (contains-match over invoice number, internal reference and buyer name)
  **and `internalReference`** (exact match), both max 100 chars.
- **`eReporting.getTransactionDocument(id)`** downloads the legal e-invoice of a sent transaction
  (`{ content: Uint8Array, contentType, filename }`); 409 while it is not available yet.
- **Invoice PDF attachment:** `invoicePdf` / `invoicePdfFilename` on `createTransaction()` and `updateTransaction()`
  (e-invoicing only). Bytes (`Buffer` / `Uint8Array` / `ArrayBuffer`) are checked (PDF, max 10 MB) and base64-encoded;
  strings are sent as-is (already base64).
- **`ComplianceTransaction.documentUrl`, `.deliveryCheck` and `.invoicePdf`** (`{ filename, size, attached }`).
- **`ComplianceTransactionState.NOT_REQUIRED`** (`not_required`): the buyer cannot receive e-invoices, so nothing was
  sent or billed.
- **`eReporting.exportRevenueTaxRatesCsv(filters)`**: net and VAT per month and tax rate as CSV (BOM preserved).
- **Self-service plans:** `eReporting.getOfferings()` (`ComplianceOfferings`), `createCheckout(country, plan)`,
  `confirmCheckout(sessionId)` and `createBillingPortalSession()`.
- **`client.billing`** (`BillingEndpoint`): `listUsageSummaries(page, perPage)` (`UsageSummaryPage`) and
  `getUsageSummaries(period)` (`UsageSummary[]` with events).
- **Per-country filters:** `complianceEnrollmentId` on `getRevenueStatistics()` and `exportRevenueTaxRatesCsv()`;
  `country` as 4th argument of `listTaxReports(page, perPage, state, country)`.
- README: compliance write requests by a read-only user return 403 with code `read_only_role` (HttpException).
- README: compliance webhook events (`compliance.transaction.state_changed`, `compliance.ledger.state_changed`) listed
  with their payloads.

### Fixed

- **`ComplianceOfferingPlan.requires`** is now typed `{ country: string; service: string } | null` and parsed from the
  object the API sends (e.g. `{ country: 'FR', service: 'e_reporting' }`). It was typed `unknown[] | null` and always
  came back `null`. Public type change.
- `createTransaction()` / `updateTransaction()` reject `invoicePdfFilename` without `invoicePdf`
  (`invoicePdfFilename requires invoicePdf.`), like the PHP SDK.
- README: `admin_only` (403) listed with the compliance error codes; the webhook example no longer mentions a
  `not_required` state event (it is never sent).

## [1.8.0] — 2026-10-25

### Added

- **`smartEnrichment.recheck(jobId, { rows?, dryRun? })`** searches again for rows without a usable answer
  (`not_found`, or a number registered to another company). Every recheck counts as a check like a new lookup (Deep
  Verify ×2), found or not; max 3 per row, 7 days apart; `no_vat_exists` and found rows are never rechecked.
  `dryRun` reports rows, skipped rows and cost without starting anything. Returns `SmartEnrichmentRecheck`
  (`rows`, `checks`, `skipped`, `dryRun`).
- **`SmartEnrichmentJob.recheck`** (`SmartEnrichmentRecheckState`: `eligible`, `runs`, `maxPerRow`, `cooldownDays`,
  `isActive()`) and **`recheckCount` / `lastRecheckedAt`** on each result.

### Changed

- Bundled OpenAPI specs (`resources/`) refreshed from the current API.

## [1.7.1] — 2026-10-24

### Fixed

- **`smartEnrichment.export()` keeps the CSV's UTF-8 BOM.** `Response.text()` silently dropped it, so Excel opened a
  saved export as ANSI and garbled umlauts. The body is now returned byte-for-byte, as documented.

## [1.7.0] — 2026-10-24

### Added

- **Smart Enrichment: `taxNumberType`, `taxNumberLabel`, `taxNumberSource`** next to `taxNumber`. `taxNumber` is now
  the company's local tax / business number: on `found` it is read off the confirmed VAT ID where that country's
  VAT ID contains it (`taxNumberSource` = `'vat_id'`: FR SIREN, IT Partita IVA, ES NIF, PL NIP, BE enterprise
  number, DK CVR, PT, RO, CZ IČO, SK DIČ, SE/NO orgnr, FI Y-tunnus, SI, HR OIB, BG EIK, GR AFM), otherwise a
  domestic number the company published (`'company_website'`, e.g. a DE/AT Steuernummer — not a VAT ID).
  `taxNumberType` is the code (`pl_nip`, `fr_siren`, `de_steuernummer` …), `taxNumberLabel` its national name.
  New type `SmartEnrichmentTaxNumberSource`.
- **Local tax numbers report** on `client.vat`: `localTaxNumbersCsv()` (raw CSV, UTF-8 with BOM),
  `localTaxNumbers()` (parsed `LocalTaxNumberRow[]` — BOM dropped, the Excel TAB guard before digit-only tax numbers
  trimmed, empty cells `null`) and `localTaxNumbersSummary()` (`{ companies, withTaxNumber }`). Filters: `dateFrom`,
  `dateTo`, `countries`, `onlyWithTaxNumber`. `parseLocalTaxNumbersCsv()` parses a saved file.

### Changed

- Bundled OpenAPI specs (`resources/`) refreshed from the current API.

## [1.6.0] — 2026-10-22

### Added

- **Smart Enrichment: `taxNumber`** — a domestic tax number (e.g. a German Steuernummer) a company's page shows
  instead of a VAT ID. It is not a VAT ID; the lookup stays `not_found`.
- **Smart Enrichment: the official VAT check behind a found number** — `vatValid`, `aiScore`, `nameMatch`
  (`'ok' | 'mismatch'`, plus `nameMismatch()`), `officialName` and `officialAddress`
  (`SmartEnrichmentOfficialAddress`). Lets you write the register's name and address back into your records.

### Changed

- Bundled OpenAPI specs (`resources/`) refreshed from the current API.

## [1.5.0] — 2026-10-22

### Added

- **Smart Enrichment: `sourceUrl` and `registeredOwner`** on `SmartEnrichmentResource`. `sourceUrl` is the page
  the VAT number was read from (usually the company's Impressum; only http(s) addresses are accepted).
  `registeredOwner` names the person the tax authority has the VAT ID under when that is not the trading name —
  typical for a German sole proprietorship (e.K.). `sourceUrls` lists every page the number was read from,
  `sourceUrl` first (each research pass that found the same number contributes its page).

### Changed

- Bundled OpenAPI specs (`resources/`) refreshed from the current API.

## [1.4.0] — 2026-10-21

### Added

- **Smart Enrichment: rejected VAT candidates.** `SmartEnrichmentResource.rejectedCandidates` lists VAT numbers
  a `not_found` lookup DID find but the official check threw out, each with a `reason`
  (`SmartEnrichmentRejectionReason`: `vat_invalid`, `name_mismatch`, `unbound`, `unverified`, `rejected`;
  unknown values map to `unknown`). Lets you tell "found one, it is invalid" apart from "found nothing".
  Plus `hasRejectedCandidates()`, `toSmartEnrichmentRejectionReason()` and
  `describeSmartEnrichmentRejectionReason()`.

### Changed

- Bundled OpenAPI specs (`resources/`) refreshed from the current API.

## [1.3.0] — 2026-10-13

### Added

- **Webhook signature verification** for Taxora's opt-in HMAC-signed webhooks (`Taxora-Signature: t=…,v1=…`):
  - `verifyWebhookSignature(rawBody, header, secret, { tolerance })` — constant-time comparison, timestamp
    tolerance against replays (default 300 s), accepts several `v1` entries (rotation) and several secrets.
  - `constructWebhookEvent(rawBody, header, secret, options)` — verifies, then returns a typed
    `TaxoraWebhookEvent` (discriminated union on `event`).
  - `generateWebhookSignatureHeader()` for testing your own handlers, plus `parseWebhookSignatureHeader()` and
    `computeWebhookSignature()`.
  - `WebhookSignatureVerificationError` with a machine-readable `reason`.
  - Event types: `vat.validated`, `vat.state_changed`, `compliance.ledger.state_changed`,
    `compliance.transaction.state_changed`, `enrichment.completed`, `enrichment.updated`, `webhook.test`.

## [1.2.0]

- Per-country compliance services incl. Norway e-invoicing (EHF / Peppol). See the GitHub release notes.
