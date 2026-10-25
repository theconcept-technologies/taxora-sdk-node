# Changelog

All notable changes to `@taxora/sdk` are documented here. Versions follow [SemVer](https://semver.org/).

## [Unreleased]

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
