# Changelog

All notable changes to `@taxora/sdk` are documented here. Versions follow [SemVer](https://semver.org/).

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
