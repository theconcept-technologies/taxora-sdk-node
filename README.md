# @taxora/sdk

Node.js/TypeScript SDK for the [Taxora VAT Validation API](https://taxora.io).

## Features

- API key + Bearer token authentication with automatic refresh
- Single and batch VAT number validation
- VAT state history, search, and certificates
- Bulk certificate export (ZIP/PDF)
- Strict TypeScript with full type coverage
- Native `fetch` (Node 18+) — zero runtime dependencies
- Dual ESM + CJS output

## Installation

```bash
npm install @taxora/sdk
```

**Requirements:** Node.js 18+

## Quick Start

```ts
import { TaxoraClientFactory, Environment } from '@taxora/sdk';

const client = TaxoraClientFactory.create({
  apiKey: 'your-api-key',
  environment: Environment.SANDBOX, // default
});

// Authenticate
await client.auth.login('user@example.com', 'password');

// Validate a VAT number
const vat = await client.vat.validate('ATU12345678', 'Alpha Handels GmbH');
console.log(vat.state);        // 'valid'
console.log(vat.score);        // 0.95
console.log(vat.companyName);  // 'Alpha Handels GmbH'

// Fetch company context
const company = await client.company.get();
console.log(company);
```

## Authentication

### Email / Password

```ts
const token = await client.auth.login('user@example.com', 'password');
```

### Client ID / Secret

```ts
const token = await client.auth.loginWithClientId('my-client-id', 'secret');
// or equivalently:
import { LoginIdentifier } from '@taxora/sdk';
await client.auth.login('my-client-id', 'secret', undefined, LoginIdentifier.CLIENT_ID);
```

### Manual Token Refresh

```ts
const refreshed = await client.auth.refresh();
```

### Automatic Token Refresh

The SDK automatically refreshes the Bearer token when:

1. **Preemptive**: The stored token has expired (15-second buffer) — refreshes before the request
2. **Reactive**: A `401 Unauthorized` response is received — refreshes and retries once

You do not need to handle token refresh manually in normal usage.

## VAT Validation

### Single Validation

```ts
import { VatValidationAddressInput } from '@taxora/sdk';

// Basic
const vat = await client.vat.validate('ATU12345678');

// With company name matching
const vat = await client.vat.validate('ATU12345678', 'Alpha Handels GmbH');

// With address input for score enhancement
const addressInput = new VatValidationAddressInput({
  addressLine1: 'Ringstraße 1',
  postalCode: '1010',
  city: 'Wien',
  countryCode: 'AT',
});
const vat = await client.vat.validate('ATU12345678', 'Alpha Handels GmbH', undefined, addressInput);

console.log(vat.state);         // VatState.VALID | INVALID | FRAUD | UNKNOWN
console.log(vat.score);         // 0.0 – 1.0
console.log(vat.breakdown);     // ScoreBreakdown[]
console.log(vat.companyName);   // Official name from registry
console.log(vat.companyAddress?.toString()); // Full address string
```

### Schema Validation (format only)

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
```

### VAT State Snapshot

```ts
const vat = await client.vat.state('ATU12345678');
```

### History

```ts
// All history
const history = await client.vat.history();

// Filtered by VAT number
const history = await client.vat.history('ATU12345678');

for (const entry of history) {
  console.log(entry.checkedAt, entry.state);
}
```

### Search

```ts
const results = await client.vat.search('Alpha Handels', 25);
```

## Certificates

### Single Certificate (PDF)

```ts
import { Language } from '@taxora/sdk';
import { writeFileSync } from 'fs';

const pdf = await client.vat.certificate('uuid-123', Language.GERMAN);
writeFileSync('certificate.pdf', pdf);
```

### Bulk Export

```ts
const exportJob = await client.vat.certificatesBulkExport(
  '2024-01-01',
  '2024-12-31',
  ['AT', 'DE'],        // optional country filter
  Language.ENGLISH,    // optional language
);

console.log(exportJob.exportId); // Use this to poll/download

// Download when ready
const zip = await client.vat.downloadBulkExport(exportJob.exportId);
writeFileSync('certificates.zip', zip);
```

### List Export

```ts
const exportJob = await client.vat.certificatesListExport(
  new Date('2024-01-01'),
  new Date('2024-12-31'),
);
```

## Environments

| Environment | Base URL |
|---|---|
| `Environment.SANDBOX` | `https://sandbox.taxora.io/v1` |
| `Environment.PRODUCTION` | `https://api.taxora.io/v1` |

```ts
import { TaxoraClientFactory, Environment } from '@taxora/sdk';

const client = TaxoraClientFactory.create({
  apiKey: 'your-api-key',
  environment: Environment.PRODUCTION,
});
```

## Token Storage

By default, tokens are stored in-memory and lost on process restart. You can provide a custom storage implementation:

```ts
import { TokenStorageInterface, Token } from '@taxora/sdk';

class RedisTokenStorage implements TokenStorageInterface {
  get(): Token | null { /* read from Redis */ }
  set(token: Token): void { /* write to Redis with TTL */ }
  clear(): void { /* delete from Redis */ }
}

const client = TaxoraClientFactory.create({
  apiKey: 'your-api-key',
  tokenStorage: new RedisTokenStorage(),
});
```

## DTOs

| Class | Description |
|---|---|
| `Token` | Access token with expiry |
| `VatResource` | Single VAT validation result |
| `VatCollection` | Iterable collection of `VatResource` |
| `ScoreBreakdown` | Per-step scoring breakdown |
| `CompanyAddress` | Structured company address |
| `VatValidationAddressInput` | Input for address-based scoring |
| `VatCertificateExport` | Bulk export job reference |
| `ProviderDocument` | Attached provider document metadata |

All DTOs implement `toArray()` and a static `fromArray()` factory.

## VatState Enum

```ts
import { VatState, getFailedVatStates, describeVatState } from '@taxora/sdk';

VatState.VALID    // 'valid'
VatState.INVALID  // 'invalid'
VatState.FRAUD    // 'fraud'
VatState.UNKNOWN  // 'unknown'

getFailedVatStates()            // [VatState.INVALID, VatState.FRAUD]
describeVatState(VatState.VALID) // 'The VAT number is valid and active.'
```

## Error Handling

```ts
import { AuthenticationException, HttpException, ValidationException } from '@taxora/sdk';

try {
  await client.vat.validate('ATU12345678');
} catch (err) {
  if (err instanceof AuthenticationException) {
    // 401 — login again
  } else if (err instanceof ValidationException) {
    console.log(err.getErrors()); // Record<string, string[]>
  } else if (err instanceof HttpException) {
    console.log(err.getStatusCode(), err.getResponseBody());
  }
}
```

## Custom HTTP Client

```ts
import { HttpClientInterface } from '@taxora/sdk';

class CustomHttpClient implements HttpClientInterface {
  async request(method: string, url: string, options?: RequestInit): Promise<Response> {
    // custom implementation
    return fetch(url, { ...options, method });
  }
}

const client = TaxoraClientFactory.create({
  apiKey: 'your-api-key',
  httpClient: new CustomHttpClient(),
});
```

## Architecture

```
TaxoraClientFactory.create()
  └── TaxoraClient
        ├── auth    → AuthEndpoint   (raw HTTP, no retry interception)
        ├── vat     → VatEndpoint    (AuthRetryHttpClient wrapper)
        └── company → CompanyEndpoint (AuthRetryHttpClient wrapper)

AuthRetryHttpClient
  ├── Preemptive refresh on expired token
  ├── Reactive refresh + retry on 401
  └── Injects Authorization: Bearer <token>
```

## Testing

```bash
npm test             # Run all tests
npm run test:coverage  # Run with coverage report
npm run test:watch   # Watch mode
```

Coverage target: ≥ 80% lines, branches, functions.

## Build

```bash
npm run build  # Produces dist/ with ESM + CJS + type declarations
```

## License

MIT
