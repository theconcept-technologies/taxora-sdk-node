<p>
  <img src="https://taxora.io/assets/logo/taxora_logo.svg" alt="Taxora Logo" width="220"/>
</p>

# @taxora/sdk

> **Official Node.js/TypeScript SDK for the [Taxora VAT Validation API](https://taxora.io)**
> Validate EU VAT numbers, generate compliance certificates, and integrate VAT checks into your Node.js services — with clean, modern TypeScript and zero runtime dependencies.

[![CI](https://github.com/theconcept-technologies/taxora-sdk-node/actions/workflows/ci.yml/badge.svg)](https://github.com/theconcept-technologies/taxora-sdk-node/actions)
[![npm](https://img.shields.io/npm/v/@taxora/sdk?color=cb3837&logo=npm&label=npm)](https://www.npmjs.com/package/@taxora/sdk)
[![Coverage](https://img.shields.io/badge/coverage-97%25-brightgreen)](#-testing)
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

---

## 🚀 Overview

The **Taxora SDK** provides a clean, type-safe interface to the [Taxora API](https://taxora.io), supporting:

- ✅ Secure **API-Key** and **Bearer Token** authentication with auto-refresh
- ✅ Single & multiple VAT validation with AI-based company name matching
- ✅ VAT state history and full-text search endpoints
- ✅ Certificate generation (PDF) and bulk/list exports (ZIP or PDF)
- ✅ Strict TypeScript — full type coverage, zero `any`
- ✅ Native `fetch` (Node 18+) — **zero runtime dependencies**
- ✅ Dual **ESM + CJS** output for maximum compatibility

> 🔒 The SDK itself is free to use, but a **Taxora API subscription** is required.
> Obtain your `x-api-key` from your [Taxora account developer settings](https://app.taxora.io).

---

## 🧮 Installation

```bash
npm install @taxora/sdk
```

**Requirements:** Node.js ≥ 18 (uses native `fetch` — no polyfill needed)

---

## ⚙️ Quick Start

```ts
import { TaxoraClientFactory, Environment } from '@taxora/sdk';

const client = TaxoraClientFactory.create({
  apiKey: 'YOUR_X_API_KEY',
  environment: Environment.SANDBOX, // or Environment.PRODUCTION
});

// 1️⃣ Authenticate
await client.auth.login('user@example.com', 'superSecret');

// 2️⃣ Validate a VAT number
const vat = await client.vat.validate('ATU12345678', 'Example GmbH');
console.log(vat.state); // 'valid' | 'invalid' | 'fraud' | 'unknown'
console.log(vat.companyName); // Official company name from registry
console.log(vat.score); // Overall confidence score (0.0 – 1.0)
console.log(vat.hasApiError); // true when the official provider had a technical failure
console.log(vat.errorMessage); // technical provider error details, if returned
console.log(vat.nextApiRecheckAt); // planned retry timestamp, if returned

for (const step of vat.breakdown ?? []) {
  console.log(`${step.stepName} → ${step.scoreContribution}`);
}

// Optional: typed address input for fallback name scoring
import { VatValidationAddressInput } from '@taxora/sdk';

const addressInput = new VatValidationAddressInput({
  addressLine1: 'Ringstraße 1',
  postalCode: '1010',
  city: 'Vienna',
  countryCode: 'AT',
});
const vatWithAddress = await client.vat.validate('ATU12345678', 'Example GmbH', 'vies', addressInput);

// 3️⃣ Access company context
const company = await client.company.get();
console.log(company.api_rate_limit); // General API request limit
console.log(company.vat_rate_limit); // VAT validation request limit
console.log(company.rate_limit); // Deprecated legacy field, if returned by older API payloads

// 4️⃣ Export certificates
const exportJob = await client.vat.certificatesBulkExport('2024-01-01', '2024-12-31');
const zip = await client.vat.downloadBulkExport(exportJob.exportId);
import { writeFileSync } from 'fs';
writeFileSync('certificates.zip', zip);
```

`vat.validate()` returns a `VatResource` with the canonical VAT UID, status, company data, optional scoring details, and optional API error metadata. `state` remains backward-compatible and still reflects the canonical business result, while `hasApiError`, `errorMessage`, and `nextApiRecheckAt` let you detect cases where the official provider response was technically unreliable. The `score` reflects overall confidence (higher is better), while `breakdown` is an array of `ScoreBreakdown` objects describing each validation step, its score contribution, and metadata (e.g. matched addresses or mismatched fields).

Need a custom HTTP client (e.g. for logging or retries)? Pass it via the factory:

```ts
import { TaxoraClientFactory, HttpClientInterface } from '@taxora/sdk';

class LoggingHttpClient implements HttpClientInterface {
  async request(method: string, url: string, options?: RequestInit): Promise<Response> {
    console.log(`→ ${method} ${url}`);
    return fetch(url, { ...options, method });
  }
}

const client = TaxoraClientFactory.create({
  apiKey: 'YOUR_X_API_KEY',
  httpClient: new LoggingHttpClient(),
});
```

---

## 🧩 Architecture

The SDK follows clean separation of concerns:

```
TaxoraClientFactory.create()
  └── TaxoraClient
        ├── auth    → AuthEndpoint    (login, loginWithClientId, refresh)
        ├── vat     → VatEndpoint     (validate, history, search, certificates)
        └── company → CompanyEndpoint (company info)
```

Each endpoint handles:

- Request signing with `x-api-key`
- Bearer token injection and proactive refresh if expired
- JSON/binary response parsing into typed DTOs

`client.company.get()` returns a typed company resource. Prefer `api_rate_limit` and `vat_rate_limit`; legacy `rate_limit` remains available only for older compatibility payloads and is deprecated.

`VatEndpoint` and `CompanyEndpoint` use the `AuthRetryHttpClient` wrapper, which transparently handles preemptive token refresh and 401 retry — `AuthEndpoint` always uses the raw HTTP client to avoid circular refresh calls.

---

## 📦 DTOs

| Class                       | Description                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `VatResource`               | Single VAT validation result: state, score, breakdown, company name, address, provider document |
| `VatCollection`             | Iterable collection of `VatResource` objects with optional pagination `self` link               |
| `ScoreBreakdown`            | Per-step scoring fragment: step name, score contribution, and metadata context                  |
| `CompanyAddress`            | Structured company address; assembles `fullAddress` from components or parses JSON strings      |
| `VatValidationAddressInput` | Typed input for address-based fallback scoring (validates lengths, country code format)         |
| `Token`                     | Access token with type and expiry; 15-second buffer for proactive refresh                       |
| `VatCertificateExport`      | Bulk export job reference (`exportId` + optional message)                                       |
| `ProviderDocument`          | Attached provider document metadata (type, date, MIME, hash, nested line item)                  |

All DTOs expose `toArray()` for serialization and a static `fromArray()` factory.

```ts
const dto = await client.vat.validate('ATU12345678');
console.log(dto.toArray());
```

---

## 🔄 Authentication Flow

### 1. Login

```ts
// Email + password
await client.auth.login('user@example.com', 'password', 'my-server-01');
// device_name is optional; omitted value falls back to os.hostname()

// Client ID + secret
await client.auth.loginWithClientId('client_abc123', 'client-secret', 'integration-box');

// Explicit identifier enum
import { LoginIdentifier } from '@taxora/sdk';
await client.auth.login('client_abc123', 'client-secret', undefined, LoginIdentifier.CLIENT_ID);
```

→ Stores and returns a `Token` DTO (valid for ~3600 seconds).

### 2. Auto-refresh

The SDK automatically refreshes the token in two scenarios:

| Trigger                                      | Behaviour                                       |
| -------------------------------------------- | ----------------------------------------------- |
| **Preemptive** (token expired + 15 s buffer) | Refreshes before the next request               |
| **Reactive** (API returns `401`)             | Refreshes once and retries the original request |

You never need to call `refresh()` manually in normal usage.

### 3. Manual refresh

```ts
await client.auth.refresh();
```

### 4. Custom token storage

By default, tokens are stored in-memory and lost on process restart. Provide your own storage for persistence:

```ts
import { TokenStorageInterface, Token } from '@taxora/sdk';

class RedisTokenStorage implements TokenStorageInterface {
  get(): Token | null {
    /* read from Redis */ return null;
  }
  set(token: Token): void {
    /* write with TTL = token.expiresAt */
  }
  clear(): void {
    /* delete key */
  }
}

const client = TaxoraClientFactory.create({
  apiKey: 'YOUR_X_API_KEY',
  tokenStorage: new RedisTokenStorage(),
});
```

---

## 🧾 VAT Validation

### Single Validation

```ts
// Basic — state only
const vat = await client.vat.validate('ATU12345678');

// With company name matching
const vat = await client.vat.validate('ATU12345678', 'Alpha Handels GmbH');

// With address input for enhanced score
const vat = await client.vat.validate('ATU12345678', 'Alpha Handels GmbH', 'vies', {
  address_line_1: 'Ringstraße 1',
  postal_code: '1010',
  city: 'Wien',
  country_code: 'AT',
});

console.log(vat.state); // VatState value
console.log(vat.score); // 0.0 – 1.0
console.log(vat.companyAddress?.toString()); // Full address string
console.log(vat.getBackendLink()); // https://app.taxora.io/vat/history/{uuid}

// Technical provider errors are additive and do not replace the canonical state.
const retryCase = await client.vat.validate('ATU44000001', 'Example GmbH');
if (retryCase.state === 'invalid' && retryCase.hasApiError) {
  console.log(retryCase.errorMessage);
  console.log(retryCase.nextApiRecheckAt);
}
```

### Schema Validation (format check only)

```ts
const result = await client.vat.validateSchema('ATU12345678');
```

### Batch Validation

```ts
const collection = await client.vat.validateMultiple(
  ['ATU12345678', 'DE123456789'],
  ['Alpha Handels GmbH', 'Beta Technik GmbH'],
);

for (const vat of collection) {
  console.log(vat.vatUid, vat.state);
}
console.log(collection.length); // 2
```

### VAT State Snapshot

```ts
const vat = await client.vat.state('ATU12345678');
```

### History

```ts
const history = await client.vat.history(); // all entries
const history = await client.vat.history('ATU12345678'); // filtered

for (const entry of history) {
  console.log(entry.checkedAt, entry.state);
}
```

### Search

```ts
const results = await client.vat.search('Alpha Handels', 25 /* perPage */);
```

---

## 🔎 Smart Enrichment (reverse VAT lookup)

Resolve a company **name + address + country → VAT number + confidence**. A confident match
returns synchronously; harder cases (and all bulk batches) are processed asynchronously and
delivered via the `enrichment.completed` webhook — poll with `get(jobId)` in the meantime.
Requires the Smart Enrichment add-on to be active on your account.

```ts
// Single lookup
let job = await client.smartEnrichment.lookup({
  companyName: 'Example Company GmbH',
  country: 'AT',
  street: 'Main Street 10',
  postalCode: '1010',
  city: 'Vienna',
});

if (job.isProcessing()) {
  // Resolved asynchronously — poll until done (or wait for the webhook)
  job = await client.smartEnrichment.waitForCompletion(job.jobId, {
    pollIntervalMs: 2000, // optional, default 2000
    timeoutMs: 120_000, // optional, default 120000 — throws TaxoraException on timeout
  });
}

const result = job.result();
console.log(result?.status); // 'found' | 'no_vat_exists' | 'not_found'
console.log(result?.vatNumber); // e.g. 'ATU12345678'
console.log(result?.confidence); // 0–100

// Bulk lookup (always async → webhook + polling)
const bulk = await client.smartEnrichment.bulkLookup([
  { companyName: 'A GmbH', country: 'DE', city: 'Berlin' },
  { companyName: 'B SARL', country: 'FR' },
]);
const done = await client.smartEnrichment.waitForCompletion(bulk.jobId);
for (const r of done.results) {
  console.log(r.status, r.vatNumber ?? '—', r.matchedAddress ?? '');
}

// Lookup history (paginated, newest first; perPage is capped at 100 server-side)
const history = await client.smartEnrichment.history(1, 25, 'Example GmbH' /* optional free-text search */);
console.log(`${history.total} lookups`);
console.log(history.stats?.total, history.stats?.found); // account-wide tiles (independent of the search filter)
for (const row of history) {
  console.log(row.queryCompanyName, '→', row.result?.vatNumber ?? row.status);
}
```

### Quota usage & billing history

```ts
const usage = await client.smartEnrichment.usage();
console.log(usage.period, `${usage.used}/${usage.included}`, 'remaining:', usage.remaining);
console.log(usage.overageCount, '×', usage.overagePrice, '=', usage.overageAmount);
for (const entry of usage.history) {
  console.log(entry.period, entry.matches, entry.amount, entry.state); // 'billed' | 'pending'
}
```

### CSV export

Download your lookups as CSV in the bulk-input shape plus the resolved VAT columns (bulk jobs
are flattened to one line per input row). All filters are optional.

```ts
import { SmartEnrichmentStatus } from '@taxora/sdk';
import { writeFileSync } from 'fs';

const csv = await client.smartEnrichment.export({
  dateFrom: '2026-01-01', // job created_at lower bound (YYYY-MM-DD)
  dateTo: '2026-06-30', // job created_at upper bound (YYYY-MM-DD)
  minConfidence: 80, // 0–100
  status: [SmartEnrichmentStatus.FOUND, SmartEnrichmentStatus.NO_VAT_EXISTS],
  onlyFound: true, // only rows that resolved to a VAT number
});
writeFileSync('smart-enrichment.csv', csv);
```

### Statistics

Aggregated lookup statistics: headline totals, a time series and breakdowns by source, outcome
and confidence band. Defaults to the last 12 months and a monthly interval (server-side).

```ts
const stats = await client.smartEnrichment.statistics({
  dateFrom: '2026-01-01', // optional (YYYY-MM-DD)
  dateTo: '2026-06-30', // optional (YYYY-MM-DD)
  interval: 'month', // 'day' | 'week' | 'month'
});

console.log(stats.totals.items, 'items,', stats.totals.found, `found (${stats.totals.foundRate}%)`);
console.log('avg confidence:', stats.totals.avgConfidence);
for (const bucket of stats.timeSeries) {
  console.log(`${bucket.bucket}: ${bucket.found}/${bucket.items}`);
}
for (const band of stats.confidenceBuckets) {
  console.log(band.bucket, band.count); // high / medium / low
}
```

> Note: `no_vat_exists` means the company was identified but legitimately has **no** VAT/UID
> number (common for purely-domestic German firms). It is a definitive answer — not a failure —
> and is not billed.

---

## 🇫🇷 E-Reporting / Compliance (DGFiP Flux 10)

Full French e-reporting integration: enroll a company with the compliance provider, record and
submit transactions (individually or via CSV import), and track the resulting DGFiP tax reports.
All `compliance` routes require an active E-Reporting subscription / feature grant on your
account — except `requestEReportingAccess()`, which is how you ask for one.

### Request feature activation

Not enabled yet? This route is deliberately **not** gated — it requests activation of the
E-Reporting feature for your account (the authenticated user's name/email take precedence over
the form values):

```ts
await client.eReporting.requestEReportingAccess({
  company: 'Example GmbH',
  phone: '+43 660 1234567',
  message: 'Please activate e-reporting for our account.',
  language: 'de', // locale of the confirmation mail
});
```

### 1. SIRENE lookup (prefill enrollment data)

Resolve company data by SIRET, SIREN or French VAT number via the French SIRENE registry.
**Rate-limited to 3 requests/minute per user** (protects the external French government API).

```ts
const company = await client.eReporting.sireneLookup('FR32123456789'); // or a SIRET/SIREN

console.log(company.companyName, company.siret);
console.log(company.nafCode, company.enterpriseSize); // e.g. "47", "pme"
```

### 2. Create an enrollment

Creates the local enrollment, provisions the provider account and (by default) activates the
DGFiP regime. Either `siret` or `siren` is required. On provider failure the API responds 502
(an `HttpException`) and the enrollment is persisted in an error state for retries.

```ts
const enrollment = await client.eReporting.createEnrollment({
  siret: company.siret!, // or siren: company.siren
  companyName: company.companyName,
  address: company.address ?? undefined,
  city: company.city ?? undefined,
  postalcode: company.postalcode ?? undefined,
  email: 'tax@acme.fr',
  nafCode: company.nafCode!, // 2-digit NAF division, e.g. "47"
  enterpriseSize: 'pme', // 'micro' | 'pme' | 'eti' | 'ge'
  typeOperation: 'mixed', // 'services' | 'goods' | 'mixed'
  reportingStartDate: '2026-09-01', // or a Date
  autoActivate: true, // optional — false creates the account without regime activation
});

console.log(enrollment.id, enrollment.status, enrollment.statusLabel);

const page = await client.eReporting.listEnrollments(1, 25); // paginated
const single = await client.eReporting.getEnrollment(enrollment.id);
```

### 3. Record & submit transactions

Records the transaction and (by default) submits it right away; pass `submitNow: false` to defer.
Creation is **idempotent** on the invoice's natural key (enrollment, type, invoice number,
invoice date, counterparty VAT) — a client retry returns the existing transaction instead of
creating a duplicate.

> **Note:** Immediate per-invoice submission (and `submitTransaction()`) requires the
> **e-invoicing** feature on your account. In pure e-reporting mode transactions are only
> recorded here and reported automatically via the aggregated daily ledgers —
> `submitTransaction()` then returns a 422 `ValidationException` explaining this.

```ts
const tx = await client.eReporting.createTransaction({
  complianceEnrollmentId: enrollment.id,
  transactionType: 'b2c_outbound', // | 'b2b_domestic_outbound' | 'b2b_domestic_inbound'
  //                                  | 'crossborder_outbound' | 'crossborder_inbound'
  invoiceNumber: 'TKT-2026-00001',
  invoiceDate: '2026-07-01', // or a Date
  currency: 'EUR', // optional, default EUR
  subtotal: 100,
  taxAmount: 20,
  total: 120,
  invoiceLines: [
    {
      description: 'Ticket',
      quantity: 1,
      price: 100,
      taxes: [{ name: 'TVA', percent: 20, category: 'S' }], // category E needs a VATEX `comment`
    },
  ],
  submitNow: false, // record now, submit later
});

// Submit (or retry) a pending/error transaction later — replays the stored invoice lines
const submitted = await client.eReporting.submitTransaction(tx.id);
console.log(submitted.state, submitted.stateLabel); // e.g. "submitted"

// Manage recorded transactions (only `pending` ones can be edited/deleted)
const transactions = await client.eReporting.listTransactions({
  dateFrom: '2026-07-01', // or a Date
  dateTo: '2026-07-31',
  state: 'pending', // 'pending' | 'sending' | 'submitted' | 'error'
  transactionType: 'b2c_outbound',
  page: 1,
  perPage: 25,
});
const one = await client.eReporting.getTransaction(tx.id);
await client.eReporting.updateTransaction(tx.id, { total: 130, taxAmount: 21.67 });
await client.eReporting.deleteTransaction(tx.id); // resolves void on 204
```

### CSV import

Bulk-import from a semicolon-separated CSV (one row per invoice line; rows sharing an
`invoice_number` are grouped into one transaction). Idempotent: re-uploading skips rows whose
invoice already exists.

```ts
import { readFileSync } from 'fs';

const result = await client.eReporting.importTransactions(
  enrollment.id,
  readFileSync('transactions.csv', 'utf8'),
  'transactions.csv', // optional filename
);

console.log(result.created, result.skippedDuplicates);
for (const error of result.errors) console.warn(error); // row-level errors
```

### 4. Track tax reports

Every submitted transaction is tracked through the aggregated DGFiP ledger lifecycle
(`new → sent → acknowledged → registered` or `refused`/`error`).

```ts
const reports = await client.eReporting.listTaxReports(1, 25, 'refused'); // state filter optional
for (const report of reports) {
  console.log(report.state, report.stateLabel, report.isTerminal, report.refusalReason);
}

const report = await client.eReporting.getTaxReport(reports.rows[0]!.id);
console.log(report.baseAmount, report.taxAmount, report.totalAmount); // precision-safe strings
```

### VAT rates & DGFiP tax categories

The canonical rates for a reporting country (the seller's reporting-country rates). Use these to
build the `taxes` entries of your invoice lines.

```ts
const rates = await client.eReporting.getVatRates('FR'); // defaults to FR when omitted

for (const rate of rates.rates) {
  console.log(rate.percent, rate.category, rate.taxName, rate.requiresVatex);
  // 20 'S' 'TVA' false … 0 'E' 'TVA' true (VATEX code required in the line's comment)
}
```

### Revenue statistics

Read-only turnover aggregation over your e-reporting transactions — totals, a time series and
breakdowns by transaction type, counterparty country and state. All headline figures are
expressed in the most frequent currency in the range (`primaryCurrency`); when more than one
currency is present, `isMultiCurrency` is `true` and `byCurrency` lists each one. Monetary values
are returned as 4-decimal strings to preserve precision.

```typescript
const stats = await client.eReporting.getRevenueStatistics({
  dateFrom: '2026-01-01', // optional — defaults to 12 months ago (server-side)
  dateTo: new Date(), // optional — defaults to today
  interval: 'month', // 'day' | 'week' | 'month' (default 'month')
  transactionType: 'b2c_outbound', // optional filter
  state: 'submitted', // optional filter
});

console.log(stats.primaryCurrency); // e.g. EUR
console.log(stats.totals.total); // e.g. 120000.0000
for (const bucket of stats.timeSeries) {
  console.log(`${bucket.bucket}: ${bucket.total}`); // 2026-01: 10800.0000
}
for (const row of stats.byCountry) {
  console.log(`${row.country} → ${row.total}`); // 'unknown' groups NULL partners
}
```

---

## 📜 Certificates

### Single Certificate (PDF)

```ts
import { Language } from '@taxora/sdk';
import { writeFileSync } from 'fs';

const pdf = await client.vat.certificate('uuid-123', Language.GERMAN);
writeFileSync('certificate.pdf', pdf);
```

### Bulk Export (ZIP)

```ts
const exportJob = await client.vat.certificatesBulkExport(
  '2024-01-01', // or new Date('2024-01-01')
  '2024-12-31',
  ['AT', 'DE'], // optional: filter by country
  Language.ENGLISH, // optional: language
);

console.log(exportJob.exportId); // poll or use directly

const zip = await client.vat.downloadBulkExport(exportJob.exportId);
writeFileSync('certificates.zip', zip);
```

### List Export

```ts
const exportJob = await client.vat.certificatesListExport(new Date('2024-01-01'), new Date('2024-12-31'));
```

---

## 🌍 Environments

| Environment              | Base URL                       |
| ------------------------ | ------------------------------ |
| `Environment.SANDBOX`    | `https://sandbox.taxora.io/v1` |
| `Environment.PRODUCTION` | `https://api.taxora.io/v1`     |

```ts
const client = TaxoraClientFactory.create({
  apiKey: 'YOUR_X_API_KEY',
  environment: Environment.PRODUCTION,
});
```

Need sandbox sample data? Known VAT UIDs with deterministic responses live in `tests/fixtures/SandboxVatFixtures.ts`.

---

## ⚠️ Error Handling

```ts
import { AuthenticationException, HttpException, ValidationException } from '@taxora/sdk';

try {
  await client.vat.validate('ATU12345678');
} catch (err) {
  if (err instanceof AuthenticationException) {
    // HTTP 401 — credentials invalid or token refresh failed
    console.error('Auth failed:', err.message);
  } else if (err instanceof ValidationException) {
    // HTTP 422 — request payload rejected by the API
    console.error('Validation errors:', err.getErrors()); // Record<string, string[]>
  } else if (err instanceof HttpException) {
    // Any other HTTP error
    console.error(`HTTP ${err.getStatusCode()}:`, err.getResponseBody());
  }
}
```

---

## 🔌 VatState Helpers

```ts
import { VatState, getFailedVatStates, describeVatState } from '@taxora/sdk';

VatState.VALID; // 'valid'
VatState.INVALID; // 'invalid'
VatState.FRAUD; // 'fraud'
VatState.UNKNOWN; // 'unknown'

getFailedVatStates(); // ['invalid', 'fraud']
describeVatState(VatState.VALID); // 'The VAT number is valid and active.'
```

---

## 🧪 Testing

```bash
npm test                # Run all 129 tests
npm run test:coverage   # Run with v8 coverage report
npm run test:watch      # Watch mode during development
```

CI runs on **Node 18**, **20**, and **22**, verifying:

- 129 Vitest unit tests across 18 test files
- 97.8 % statement coverage / 87 % branch coverage / 100 % function coverage
- Strict TypeScript compilation

---

## 🏗️ Build

```bash
npm run build
# → dist/index.js   (ESM)
# → dist/index.cjs  (CommonJS)
# → dist/index.d.ts (TypeScript declarations)
```

---

## ⚠️ Deprecations

So fresh there aren't even any deprecated features yet. Check back in a few months when we're on v47 and have made some regrettable decisions. 🎉

---

## 🪪 License

Licensed under the **MIT License** © 2025 [theconcept technologies](https://www.theconcept-technologies.com).
The SDK is open-source, but API usage requires a valid **Taxora subscription**.

---

## 🤝 Contributing

Contributions and pull requests are welcome!

- Follow the existing TypeScript code style (strict mode, no `any`).
- Run `npm test` before submitting a PR.
- Ensure new endpoints include DTOs + tests.

---

## 💬 Support

Need help or enterprise support?
📧 **[support@taxora.io](mailto:support@taxora.io)**
🌐 [https://taxora.io](https://taxora.io)
