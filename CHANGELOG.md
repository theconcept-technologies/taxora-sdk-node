# Changelog

All notable changes to `@taxora/sdk` are documented here. Versions follow [SemVer](https://semver.org/).

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
