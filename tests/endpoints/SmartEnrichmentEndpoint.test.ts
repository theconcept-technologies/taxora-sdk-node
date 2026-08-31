import { describe, it, expect, vi, afterEach } from 'vitest';
import { SmartEnrichmentEndpoint } from '../../src/endpoints/SmartEnrichmentEndpoint.js';
import { InMemoryTokenStorage } from '../../src/http/InMemoryTokenStorage.js';
import { Token } from '../../src/dto/Token.js';
import { SequenceHttpClient } from '../fixtures/SequenceHttpClient.js';
import { SmartEnrichmentJob } from '../../src/dto/SmartEnrichmentJob.js';
import { SmartEnrichmentHistoryPage } from '../../src/dto/SmartEnrichmentHistoryPage.js';
import { SmartEnrichmentStatistics } from '../../src/dto/SmartEnrichmentStatistics.js';
import { type SmartEnrichmentStatisticsInterval } from '../../src/dto/SmartEnrichmentStatistics.js';
import { SmartEnrichmentStatus } from '../../src/enums/SmartEnrichmentStatus.js';
import { SmartEnrichmentMode } from '../../src/enums/SmartEnrichmentMode.js';
import { HttpException } from '../../src/exceptions/HttpException.js';
import { TaxoraException } from '../../src/exceptions/TaxoraException.js';
import { ValidationException } from '../../src/exceptions/ValidationException.js';

const BASE_URL = 'https://sandbox.taxora.io/v1';
const API_KEY = 'test-api-key';

function makeEndpoint(responses: Response[]) {
  const storage = new InMemoryTokenStorage();
  storage.set(new Token('test-token', 'Bearer', new Date(Date.now() + 3600_000)));
  const client = new SequenceHttpClient(responses);
  const endpoint = new SmartEnrichmentEndpoint(BASE_URL, API_KEY, storage, client);
  return { endpoint, client };
}

function processingResponse(jobId: string): Response {
  return SequenceHttpClient.jsonResponse({ jobId, status: 'processing' });
}

describe('SmartEnrichmentEndpoint.lookup', () => {
  it('returns a synchronous found result and posts camelCase body', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({
        jobId: '11111111-1111-1111-1111-111111111111',
        status: 'found',
        vatNumber: 'ATU12345678',
        vatType: 'vat_id',
        confidence: 96,
        matchedCompanyName: 'Example Company GmbH',
        matchedAddress: 'Hauptstraße 10, 1010 Wien, AT',
        country: 'AT',
        source: 'corpus',
      }),
    ]);

    const job = await endpoint.lookup({
      companyName: 'Example Company GmbH',
      country: 'AT',
      street: 'Main Street 10',
      city: 'Vienna',
    });

    expect(job).toBeInstanceOf(SmartEnrichmentJob);
    expect(job.status).toBe(SmartEnrichmentStatus.FOUND);
    expect(job.isProcessing()).toBe(false);
    expect(job.result()?.vatNumber).toBe('ATU12345678');
    expect(job.result()?.confidence).toBe(96);
    expect(job.result()?.matchedAddress).toBe('Hauptstraße 10, 1010 Wien, AT');

    const req = client.requests[0]!;
    expect(req.method).toBe('POST');
    expect(req.url).toBe(`${BASE_URL}/smart-enrichment`);
    const body = JSON.parse(req.options?.body as string);
    expect(body.companyName).toBe('Example Company GmbH');
    expect(body.country).toBe('AT');
    expect(body.street).toBe('Main Street 10');
    expect(body.postalCode).toBeUndefined();
  });

  it('returns a processing job on a 202 async ack', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ jobId: '22222222-2222-2222-2222-222222222222', status: 'processing' }, 202),
    ]);

    const job = await endpoint.lookup({ companyName: 'Unknown Co', country: 'DE' });

    expect(job.status).toBe(SmartEnrichmentStatus.PROCESSING);
    expect(job.isProcessing()).toBe(true);
    expect(job.result()).toBeUndefined();
    expect(job.jobId).toBe('22222222-2222-2222-2222-222222222222');
  });

  it('unwraps a data envelope', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({
        data: { jobId: '11111111-1111-1111-1111-111111111111', status: 'found', vatNumber: 'ATU12345678' },
      }),
    ]);

    const job = await endpoint.lookup({ companyName: 'Example GmbH', country: 'AT' });

    expect(job.status).toBe(SmartEnrichmentStatus.FOUND);
    expect(job.result()?.vatNumber).toBe('ATU12345678');
  });

  it('throws TaxoraException without a request when companyName is empty', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.lookup({ companyName: '   ', country: 'AT' })).rejects.toThrow(TaxoraException);
    await expect(endpoint.lookup({ companyName: '', country: 'AT' })).rejects.toThrow('companyName must not be empty');
    expect(client.requests).toHaveLength(0);
  });

  it('throws TaxoraException without a request when country is not a 2-character code', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.lookup({ companyName: 'Example GmbH', country: 'AUT' })).rejects.toThrow(TaxoraException);
    await expect(endpoint.lookup({ companyName: 'Example GmbH', country: '' })).rejects.toThrow(
      'country must be a 2-character ISO 3166-1 alpha-2 code',
    );
    expect(client.requests).toHaveLength(0);
  });
});

describe('SmartEnrichmentEndpoint.bulkLookup', () => {
  it('posts items and returns a processing job', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse(
        { jobId: '33333333-3333-3333-3333-333333333333', status: 'processing', itemCount: 2 },
        202,
      ),
    ]);

    const job = await endpoint.bulkLookup([
      { companyName: 'A GmbH', country: 'DE' },
      { companyName: 'B SARL', country: 'FR' },
    ]);

    expect(job.itemCount).toBe(2);
    expect(job.isProcessing()).toBe(true);

    const req = client.requests[0]!;
    expect(req.url).toBe(`${BASE_URL}/smart-enrichment/bulk`);
    const body = JSON.parse(req.options?.body as string);
    expect(body.items).toHaveLength(2);
    expect(body.items[0].companyName).toBe('A GmbH');
  });

  it('throws TaxoraException for an empty batch', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.bulkLookup([])).rejects.toThrow(TaxoraException);
    await expect(endpoint.bulkLookup([])).rejects.toThrow('bulkLookup requires at least one item.');
    expect(client.requests).toHaveLength(0);
  });

  it('reports the failing item index for invalid batch items', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(
      endpoint.bulkLookup([
        { companyName: 'A GmbH', country: 'DE' },
        { companyName: '  ', country: 'FR' },
      ]),
    ).rejects.toThrow('companyName must not be empty (items[1]).');
    await expect(
      endpoint.bulkLookup([
        { companyName: 'A GmbH', country: 'DE' },
        { companyName: 'B SARL', country: 'FRA' },
      ]),
    ).rejects.toThrow('country must be a 2-character ISO 3166-1 alpha-2 code (items[1]).');
    expect(client.requests).toHaveLength(0);
  });
});

describe('SmartEnrichmentEndpoint.get', () => {
  it('parses a completed bulk job with per-item results', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({
        jobId: '33333333-3333-3333-3333-333333333333',
        status: 'completed',
        itemCount: 2,
        completedCount: 2,
        foundCount: 1,
        results: [
          { status: 'found', vatNumber: 'DE123456789', confidence: 91, country: 'DE', source: 'ai_web' },
          { status: 'no_vat_exists', vatNumber: null, confidence: 0, country: 'FR', source: 'registry:fr' },
        ],
      }),
    ]);

    const job = await endpoint.get('33333333-3333-3333-3333-333333333333');

    expect(job.status).toBe(SmartEnrichmentStatus.COMPLETED);
    expect(job.foundCount).toBe(1);
    expect(job.results).toHaveLength(2);
    expect(job.results[0]!.status).toBe(SmartEnrichmentStatus.FOUND);
    expect(job.results[0]!.vatNumber).toBe('DE123456789');
    expect(job.results[1]!.status).toBe(SmartEnrichmentStatus.NO_VAT_EXISTS);

    const req = client.requests[0]!;
    expect(req.method).toBe('GET');
    expect(req.url).toBe(`${BASE_URL}/smart-enrichment/33333333-3333-3333-3333-333333333333`);
  });

  it('treats a queued job as processing', async () => {
    const { endpoint } = makeEndpoint([SequenceHttpClient.jsonResponse({ jobId: 'job-1', status: 'queued' })]);

    const job = await endpoint.get('job-1');

    expect(job.status).toBe(SmartEnrichmentStatus.QUEUED);
    expect(job.isProcessing()).toBe(true);
  });

  it('coerces an unrecognized status to unknown', async () => {
    const { endpoint } = makeEndpoint([SequenceHttpClient.jsonResponse({ jobId: 'job-1', status: 'exploded' })]);

    const job = await endpoint.get('job-1');

    expect(job.status).toBe(SmartEnrichmentStatus.UNKNOWN);
    expect(job.isProcessing()).toBe(false);
  });

  it('URL-encodes the jobId', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ jobId: 'job id/1', status: 'completed' }),
    ]);

    await endpoint.get('job id/1');

    expect(client.requests[0]!.url).toBe(`${BASE_URL}/smart-enrichment/job%20id%2F1`);
  });

  it('throws TaxoraException without a request when jobId is empty', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.get('  ')).rejects.toThrow(TaxoraException);
    await expect(endpoint.get('')).rejects.toThrow('jobId must not be empty.');
    expect(client.requests).toHaveLength(0);
  });

  it('throws HttpException on a 500 error', async () => {
    const { endpoint } = makeEndpoint([SequenceHttpClient.jsonResponse({ message: 'Internal Server Error' }, 500)]);

    await expect(endpoint.get('job-1')).rejects.toThrow(HttpException);
  });

  it('throws HttpException on invalid JSON', async () => {
    const { endpoint } = makeEndpoint([SequenceHttpClient.textResponse('<html>oops</html>')]);

    await expect(endpoint.get('job-1')).rejects.toThrow(HttpException);
    const { endpoint: endpoint2 } = makeEndpoint([SequenceHttpClient.textResponse('<html>oops</html>')]);
    await expect(endpoint2.get('job-1')).rejects.toThrow('Invalid JSON response');
  });

  it('throws ValidationException with mapped errors on 422', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse(
        { message: 'Validation failed', errors: { jobId: ['The job id field is invalid.'] } },
        422,
      ),
    ]);

    const error = await endpoint.get('job-1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationException);
    expect((error as ValidationException).getErrors()).toEqual({ jobId: ['The job id field is invalid.'] });
  });
});

describe('SmartEnrichmentEndpoint.waitForCompletion', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns immediately when the first poll is no longer processing', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ jobId: 'job-1', status: 'found', vatNumber: 'ATU12345678' }),
    ]);

    const job = await endpoint.waitForCompletion('job-1');

    expect(job.status).toBe(SmartEnrichmentStatus.FOUND);
    expect(client.requests).toHaveLength(1);
  });

  it('polls until the job completes, without real waiting', async () => {
    vi.useFakeTimers();
    const { endpoint, client } = makeEndpoint([
      processingResponse('job-1'),
      processingResponse('job-1'),
      SequenceHttpClient.jsonResponse({
        jobId: 'job-1',
        status: 'completed',
        itemCount: 1,
        completedCount: 1,
        foundCount: 1,
        results: [{ status: 'found', vatNumber: 'DE123456789', confidence: 91 }],
      }),
    ]);

    const promise = endpoint.waitForCompletion('job-1');
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(2000);
    const job = await promise;

    expect(job.status).toBe(SmartEnrichmentStatus.COMPLETED);
    expect(job.results[0]!.vatNumber).toBe('DE123456789');
    expect(client.requests).toHaveLength(3);
  });

  it('throws TaxoraException when the timeout is exceeded', async () => {
    vi.useFakeTimers();
    const { endpoint, client } = makeEndpoint([processingResponse('job-1'), processingResponse('job-1')]);

    const promise = endpoint.waitForCompletion('job-1', { pollIntervalMs: 1000, timeoutMs: 1500 });
    const expectation = expect(promise).rejects.toThrow('did not complete within 1500ms');
    await vi.advanceTimersByTimeAsync(1000);
    await expectation;

    expect(client.requests).toHaveLength(2);
  });

  it('throws TaxoraException without a request on invalid poll options', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.waitForCompletion('job-1', { pollIntervalMs: 0 })).rejects.toThrow(TaxoraException);
    await expect(endpoint.waitForCompletion('job-1', { pollIntervalMs: -5 })).rejects.toThrow(
      'pollIntervalMs must be greater than 0.',
    );
    await expect(endpoint.waitForCompletion('job-1', { timeoutMs: 0 })).rejects.toThrow(
      'timeoutMs must be greater than 0.',
    );
    expect(client.requests).toHaveLength(0);
  });

  it('throws TaxoraException without a request when jobId is empty', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.waitForCompletion('')).rejects.toThrow('jobId must not be empty.');
    expect(client.requests).toHaveLength(0);
  });
});

describe('SmartEnrichmentEndpoint.history', () => {
  it('GET /smart-enrichment/history returns a paginated page with meta preserved', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({
        data: [
          {
            jobId: 'aaaa1111-1111-1111-1111-111111111111',
            status: 'found',
            isBulk: false,
            itemCount: 1,
            foundCount: 1,
            query: { companyName: 'Example GmbH', country: 'AT', city: 'Vienna' },
            result: { status: 'found', vatNumber: 'ATU12345678', confidence: 96 },
            createdAt: '2026-06-23T10:00:00Z',
            finishedAt: '2026-06-23T10:00:01Z',
          },
        ],
        meta: { currentPage: 1, perPage: 25, total: 1, lastPage: 1 },
      }),
    ]);

    const page = await endpoint.history();

    expect(page).toBeInstanceOf(SmartEnrichmentHistoryPage);
    expect(page.length).toBe(1);
    expect(page.total).toBe(1);
    expect(page.rows[0]!.status).toBe(SmartEnrichmentStatus.FOUND);
    expect(page.rows[0]!.queryCompanyName).toBe('Example GmbH');
    expect(page.rows[0]!.result?.vatNumber).toBe('ATU12345678');
    expect(page.rows[0]!.input).toBeUndefined();
    expect(page.stats).toBeUndefined();

    const req = client.requests[0]!;
    expect(req.method).toBe('GET');
    expect(req.url).toBe(`${BASE_URL}/smart-enrichment/history?page=1&perPage=25`);
  });

  it('includes search and non-default pagination in the query string', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse({ data: [], meta: {} })]);

    await endpoint.history(2, 50, 'Example GmbH');

    expect(client.requests[0]!.url).toBe(`${BASE_URL}/smart-enrichment/history?page=2&perPage=50&search=Example+GmbH`);
  });

  it('maps the full input object and top-level stats', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({
        data: [
          {
            jobId: 'aaaa1111-1111-1111-1111-111111111111',
            status: 'not_found',
            isBulk: false,
            itemCount: 1,
            foundCount: 0,
            query: { companyName: 'Example GmbH', country: 'AT', city: 'Vienna' },
            input: {
              companyName: 'Example GmbH',
              street: 'Hauptstraße 10',
              postalCode: '1010',
              city: 'Vienna',
              country: 'AT',
            },
            result: null,
            createdAt: '2026-06-23T10:00:00Z',
            finishedAt: null,
          },
        ],
        meta: { currentPage: 1, perPage: 25, total: 1, lastPage: 1 },
        stats: { total: 42, found: 30 },
      }),
    ]);

    const page = await endpoint.history();

    const row = page.rows[0]!;
    expect(row.status).toBe(SmartEnrichmentStatus.NOT_FOUND);
    expect(row.input).toEqual({
      companyName: 'Example GmbH',
      street: 'Hauptstraße 10',
      postalCode: '1010',
      city: 'Vienna',
      country: 'AT',
    });
    expect(row.finishedAt).toBeUndefined();
    expect(page.stats).toEqual({ total: 42, found: 30 });
  });

  it('falls back to defaults on an empty page without meta', async () => {
    const { endpoint } = makeEndpoint([SequenceHttpClient.jsonResponse({ data: [] })]);

    const page = await endpoint.history();

    expect(page.length).toBe(0);
    expect(page.currentPage).toBe(1);
    expect(page.perPage).toBe(0);
    expect(page.total).toBe(0);
    expect(page.lastPage).toBe(1);
    expect(page.stats).toBeUndefined();
  });

  it('throws ValidationException on 422', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse(
        { message: 'Validation failed', errors: { perPage: ['The per page field must not be greater than 100.'] } },
        422,
      ),
    ]);

    await expect(endpoint.history(1, 500)).rejects.toThrow(ValidationException);
  });
});

describe('SmartEnrichmentEndpoint.usage', () => {
  it('GET /smart-enrichment/usage returns quota info with an empty history fallback', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({
        period: '2026-06',
        used: 312,
        included: 300,
        remaining: 0,
        overageCount: 12,
        overagePrice: 0.08,
        hardCap: null,
      }),
    ]);

    const usage = await endpoint.usage();

    expect(usage.used).toBe(312);
    expect(usage.included).toBe(300);
    expect(usage.overageCount).toBe(12);
    expect(usage.hardCap).toBeNull();
    expect(usage.history).toEqual([]);
    expect(client.requests[0]!.url).toBe(`${BASE_URL}/smart-enrichment/usage`);
  });

  it('maps billing history entries and a numeric hardCap', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({
        period: '2026-06',
        used: 312,
        included: 300,
        remaining: 0,
        overageCount: 12,
        overagePrice: 0.08,
        overageAmount: 0.96,
        hardCap: 500,
        history: [
          {
            period: '2026-05',
            matches: 420,
            amount: '9.60',
            state: 'billed',
            billingType: 'manual',
            manualReference: 'INV-2026-0042',
          },
          {
            period: '2026-06',
            matches: 312,
            amount: '0.96',
            state: 'pending',
            billingType: null,
            manualReference: null,
          },
        ],
      }),
    ]);

    const usage = await endpoint.usage();

    expect(usage.overageAmount).toBe(0.96);
    expect(usage.hardCap).toBe(500);
    expect(usage.history).toHaveLength(2);
    expect(usage.history[0]).toEqual({
      period: '2026-05',
      matches: 420,
      amount: '9.60',
      state: 'billed',
      billingType: 'manual',
      manualReference: 'INV-2026-0042',
    });
    expect(usage.history[1]!.state).toBe('pending');
    expect(usage.history[1]!.billingType).toBeNull();
    expect(usage.history[1]!.manualReference).toBeNull();
  });
});

describe('SmartEnrichmentEndpoint.export', () => {
  const CSV_BODY =
    'companyName,street,postalCode,city,country,vatNumber,vatType,matchedCompanyName,matchedAddress,confidence,status,createdAt\r\n' +
    '"Example GmbH","Hauptstraße 10","1010","Wien","AT","ATU12345678","vat_id","Example Company GmbH","Hauptstraße 10, 1010 Wien, AT",96,found,2026-06-23T10:00:00+00:00\r\n';

  it('GET /smart-enrichment/export without filters returns the CSV body verbatim', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.textResponse(CSV_BODY, 200, 'text/csv; charset=UTF-8'),
    ]);

    const csv = await endpoint.export();

    expect(csv).toBe(CSV_BODY);
    const req = client.requests[0]!;
    expect(req.method).toBe('GET');
    expect(req.url).toBe(`${BASE_URL}/smart-enrichment/export`);
  });

  it('serializes all filters as snake_case query params (status[] repeated, only_found as 1)', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.textResponse(CSV_BODY, 200, 'text/csv; charset=UTF-8'),
    ]);

    await endpoint.export({
      dateFrom: '2026-01-01',
      dateTo: '2026-06-30',
      minConfidence: 80,
      status: [SmartEnrichmentStatus.FOUND, SmartEnrichmentStatus.NOT_FOUND],
      onlyFound: true,
    });

    expect(client.requests[0]!.url).toBe(
      `${BASE_URL}/smart-enrichment/export` +
        '?date_from=2026-01-01&date_to=2026-06-30&min_confidence=80' +
        '&status%5B%5D=found&status%5B%5D=not_found&only_found=1',
    );
  });

  it('serializes onlyFound false as only_found=0 and omits undefined filters', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.textResponse(CSV_BODY, 200, 'text/csv; charset=UTF-8'),
    ]);

    await endpoint.export({ onlyFound: false });

    expect(client.requests[0]!.url).toBe(`${BASE_URL}/smart-enrichment/export?only_found=0`);
  });

  it('throws ValidationException on 422', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse(
        { message: 'Validation failed', errors: { date_from: ['The date from field must be a valid date.'] } },
        422,
      ),
    ]);

    const error = await endpoint.export({ dateFrom: 'not-a-date' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationException);
    expect((error as ValidationException).getErrors()).toEqual({
      date_from: ['The date from field must be a valid date.'],
    });
  });

  it('throws HttpException on a 500 error', async () => {
    const { endpoint } = makeEndpoint([SequenceHttpClient.jsonResponse({ message: 'Internal Server Error' }, 500)]);

    await expect(endpoint.export()).rejects.toThrow(HttpException);
  });
});

describe('SmartEnrichmentEndpoint.statistics', () => {
  const STATISTICS_RESPONSE = {
    range: { date_from: '2025-07-06', date_to: '2026-07-06', interval: 'month' },
    totals: { jobs: 42, items: 120, found: 96, found_rate: 80, avg_confidence: 87.4 },
    time_series: [
      { bucket: '2026-05', jobs: 10, items: 30, found: 24 },
      { bucket: '2026-06', jobs: 12, items: 40, found: 32 },
    ],
    by_source: [
      { source: 'api', jobs: 30, found: 70 },
      { source: 'dashboard', jobs: 12, found: 26 },
    ],
    by_outcome: [
      { outcome: 'found', count: 96 },
      { outcome: 'not_found', count: 20 },
    ],
    confidence_buckets: [
      { bucket: 'high', count: 80 },
      { bucket: 'medium', count: 12 },
      { bucket: 'low', count: 4 },
    ],
  };

  it('GET /smart-enrichment/statistics maps the snake_case payload to camelCase', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse(STATISTICS_RESPONSE)]);

    const stats = await endpoint.statistics();

    expect(stats).toBeInstanceOf(SmartEnrichmentStatistics);
    expect(stats.range).toEqual({ dateFrom: '2025-07-06', dateTo: '2026-07-06', interval: 'month' });
    expect(stats.totals).toEqual({ jobs: 42, items: 120, found: 96, foundRate: 80, avgConfidence: 87.4 });
    expect(stats.timeSeries).toEqual([
      { bucket: '2026-05', jobs: 10, items: 30, found: 24 },
      { bucket: '2026-06', jobs: 12, items: 40, found: 32 },
    ]);
    expect(stats.bySource).toEqual([
      { source: 'api', jobs: 30, found: 70 },
      { source: 'dashboard', jobs: 12, found: 26 },
    ]);
    expect(stats.byOutcome).toEqual([
      { outcome: 'found', count: 96 },
      { outcome: 'not_found', count: 20 },
    ]);
    expect(stats.confidenceBuckets).toEqual([
      { bucket: 'high', count: 80 },
      { bucket: 'medium', count: 12 },
      { bucket: 'low', count: 4 },
    ]);

    const req = client.requests[0]!;
    expect(req.method).toBe('GET');
    expect(req.url).toBe(`${BASE_URL}/smart-enrichment/statistics`);
  });

  it('serializes date range and interval as snake_case query params', async () => {
    const { endpoint, client } = makeEndpoint([SequenceHttpClient.jsonResponse(STATISTICS_RESPONSE)]);

    await endpoint.statistics({ dateFrom: '2026-01-01', dateTo: '2026-06-30', interval: 'week' });

    expect(client.requests[0]!.url).toBe(
      `${BASE_URL}/smart-enrichment/statistics?date_from=2026-01-01&date_to=2026-06-30&interval=week`,
    );
  });

  it('throws TaxoraException without a request on an invalid interval', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.statistics({ interval: 'year' as SmartEnrichmentStatisticsInterval })).rejects.toThrow(
      TaxoraException,
    );
    await expect(endpoint.statistics({ interval: 'year' as SmartEnrichmentStatisticsInterval })).rejects.toThrow(
      'Invalid statistics interval "year". Expected one of: day, week, month.',
    );
    expect(client.requests).toHaveLength(0);
  });

  it('throws ValidationException on 422', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse(
        { message: 'Validation failed', errors: { date_to: ['The date to field must be after date from.'] } },
        422,
      ),
    ]);

    await expect(endpoint.statistics({ dateFrom: '2026-06-30', dateTo: '2026-01-01' })).rejects.toThrow(
      ValidationException,
    );
  });
});

describe('SmartEnrichmentEndpoint search mode', () => {
  it('omits mode entirely when the caller does not pick one', async () => {
    const { endpoint, client } = makeEndpoint([processingResponse('job-no-mode')]);

    await endpoint.lookup({ companyName: 'Example GmbH', country: 'DE' });

    const body = JSON.parse(client.requests[0]!.options?.body as string);
    // The server default must stay the server's decision — sending an explicit 'default' would
    // pin the SDK to today's default if that ever changes.
    expect('mode' in body).toBe(false);
  });

  it('sends the requested mode on a single lookup', async () => {
    const { endpoint, client } = makeEndpoint([processingResponse('job-complex')]);

    await endpoint.lookup({
      companyName: 'Vodafone D2 GmbH',
      country: 'DE',
      postalCode: '40547',
      mode: SmartEnrichmentMode.COMPLEX,
    });

    const body = JSON.parse(client.requests[0]!.options?.body as string);
    expect(body.mode).toBe('complex');
    expect(body.postalCode).toBe('40547');
  });

  it('sends a batch-level mode alongside the items', async () => {
    const { endpoint, client } = makeEndpoint([processingResponse('job-bulk')]);

    await endpoint.bulkLookup(
      [
        { companyName: 'A GmbH', country: 'DE' },
        { companyName: 'B GmbH', country: 'AT' },
      ],
      SmartEnrichmentMode.COMPLEX,
    );

    const body = JSON.parse(client.requests[0]!.options?.body as string);
    expect(body.mode).toBe('complex');
    expect(body.items).toHaveLength(2);
  });

  it('lets a per-row mode ride along for mixed batches', async () => {
    const { endpoint, client } = makeEndpoint([processingResponse('job-mixed')]);

    await endpoint.bulkLookup([
      { companyName: 'Cheap GmbH', country: 'DE' },
      { companyName: 'Hard GmbH', country: 'DE', mode: SmartEnrichmentMode.COMPLEX },
    ]);

    const body = JSON.parse(client.requests[0]!.options?.body as string);
    expect('mode' in body).toBe(false);
    expect(body.items[1].mode).toBe('complex');
  });

  it('reads the mode and cross-check diagnostics back off a result', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({
        jobId: 'job-verdicts',
        status: 'found',
        vatNumber: 'DE811704788',
        confidence: 92,
        country: 'DE',
        source: 'ai_web:consensus',
        mode: 'complex',
        providerVerdicts: [
          {
            provider: 'gemini',
            model: 'gemini-3.1-flash-lite',
            status: 'not_found',
            vatNumber: null,
            confidence: 0,
            grounded: true,
            sourceUrl: null,
          },
          {
            provider: 'perplexity',
            model: 'sonar-pro',
            status: 'found',
            vatNumber: 'DE811704788',
            confidence: 92,
            grounded: true,
            sourceUrl: 'https://example.test/impressum',
          },
        ],
        addressQuality: {
          providedPostalCode: '40547',
          providedCity: null,
          postalCodeFormatValid: true,
          postalCodeAssigned: true,
          postalCodeTrusted: true,
          derivedPlace: 'Düsseldorf',
          cityMatchesPostalCode: null,
          warnings: ['city_derived_from_postal_code'],
        },
      }),
    ]);

    const job = await endpoint.lookup({ companyName: 'Vodafone D2 GmbH', country: 'DE' });
    const result = job.result();

    expect(result?.mode).toBe(SmartEnrichmentMode.COMPLEX);
    expect(result?.providerVerdicts).toHaveLength(2);
    expect(result?.providerVerdicts[1]?.provider).toBe('perplexity');
    expect(result?.addressQuality?.derivedPlace).toBe('Düsseldorf');
  });

  it('leaves mode undefined when the API does not report one', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ jobId: 'job-plain', status: 'not_found', country: 'DE' }),
    ]);

    const job = await endpoint.lookup({ companyName: 'Example GmbH', country: 'DE' });

    expect(job.result()?.mode).toBeUndefined();
    expect(job.result()?.providerVerdicts).toEqual([]);
  });
});
