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
