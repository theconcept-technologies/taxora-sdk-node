import { describe, it, expect } from 'vitest';
import { BillingEndpoint } from '../../src/endpoints/BillingEndpoint.js';
import { InMemoryTokenStorage } from '../../src/http/InMemoryTokenStorage.js';
import { RetryPolicy } from '../../src/http/RetryPolicy.js';
import { Token } from '../../src/dto/Token.js';
import { UsageSummary, UsageSummaryPage } from '../../src/dto/UsageSummary.js';
import { HttpException } from '../../src/exceptions/HttpException.js';
import { SequenceHttpClient } from '../fixtures/SequenceHttpClient.js';

const BASE_URL = 'https://sandbox.taxora.io/v1';

const SUMMARY_PAYLOAD = {
  id: 123,
  company_id: 1,
  feature: 'ereporting_transaction',
  country: 'FR',
  regime: 'dgfip_flux10',
  billing_period: '2026-09',
  event_count: 500,
  billable_amount: '49.00',
  state: 'open',
  state_label: 'Open',
  period_closed_at: null,
  billing_triggered_at: null,
  billed_at: null,
  stripe_invoice_id: null,
  stripe_subscription_item_id: 'si_123',
  billing_notes: null,
  created_at: '2026-09-01T00:00:00+00:00',
  updated_at: '2026-09-30T23:00:00+00:00',
};

const EVENT_PAYLOAD = {
  id: 9,
  company_id: 1,
  usage_summary_id: 123,
  feature: 'ereporting_transaction',
  country: 'FR',
  regime: 'dgfip_flux10',
  billing_period: '2026-09',
  resource_type: 'compliance_transaction',
  resource_id: 99,
  stripe_usage_record_id: null,
  stripe_reported_at: null,
  created_at: '2026-09-02T10:00:00+00:00',
};

function makeEndpoint(responses: Response[], retryPolicy?: RetryPolicy) {
  const storage = new InMemoryTokenStorage();
  storage.set(new Token('test-token', 'Bearer', new Date(Date.now() + 3600_000)));
  const client = new SequenceHttpClient(responses);
  const endpoint = new BillingEndpoint(BASE_URL, 'test-api-key', storage, client, retryPolicy);
  return { endpoint, client };
}

describe('BillingEndpoint.listUsageSummaries', () => {
  it('GETs /billing/usage-summaries with page params and returns a UsageSummaryPage', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({
        success: true,
        data: { data: [SUMMARY_PAYLOAD], meta: { current_page: 2, per_page: 10, total: 11, last_page: 2 } },
      }),
    ]);

    const page = await endpoint.listUsageSummaries(2, 10);

    const req = client.requests[0]!;
    expect(req.method).toBe('GET');
    expect(req.url).toBe(`${BASE_URL}/billing/usage-summaries?page=2&per_page=10`);
    expect((req.options?.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
    expect(page).toBeInstanceOf(UsageSummaryPage);
    expect(page.length).toBe(1);
    expect([page.currentPage, page.perPage, page.total, page.lastPage]).toEqual([2, 10, 11, 2]);

    const summary = page.rows[0]!;
    expect(summary).toBeInstanceOf(UsageSummary);
    expect(summary.feature).toBe('ereporting_transaction');
    expect(summary.billingPeriod).toBe('2026-09');
    expect(summary.eventCount).toBe(500);
    expect(summary.billableAmount).toBe('49.00');
    expect(summary.state).toBe('open');
    expect(summary.stripeSubscriptionItemId).toBe('si_123');
    expect(summary.events).toEqual([]);
  });

  it('retries a transient 503', async () => {
    const { endpoint, client } = makeEndpoint(
      [
        SequenceHttpClient.jsonResponse({ message: 'Service Unavailable' }, 503),
        SequenceHttpClient.jsonResponse({ success: true, data: { data: [], meta: {} } }),
      ],
      new RetryPolicy({ maxAttempts: 2, sleeper: () => undefined }),
    );

    const page = await endpoint.listUsageSummaries();

    expect(page.length).toBe(0);
    expect(client.requests).toHaveLength(2);
  });
});

describe('BillingEndpoint.getUsageSummaries', () => {
  it('GETs the period and returns summaries with their events', async () => {
    const { endpoint, client } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ success: true, data: [{ ...SUMMARY_PAYLOAD, events: [EVENT_PAYLOAD] }] }),
    ]);

    const summaries = await endpoint.getUsageSummaries('2026-09');

    expect(client.requests[0]!.url).toBe(`${BASE_URL}/billing/usage-summaries/2026-09`);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]!.events).toEqual([
      {
        id: 9,
        usageSummaryId: 123,
        feature: 'ereporting_transaction',
        country: 'FR',
        regime: 'dgfip_flux10',
        billingPeriod: '2026-09',
        resourceType: 'compliance_transaction',
        resourceId: 99,
        stripeUsageRecordId: null,
        stripeReportedAt: null,
        createdAt: '2026-09-02T10:00:00+00:00',
      },
    ]);
  });

  it('rejects an invalid period without a request', async () => {
    const { endpoint, client } = makeEndpoint([]);

    await expect(endpoint.getUsageSummaries('2026-13')).rejects.toThrow('Invalid billing period "2026-13"');
    await expect(endpoint.getUsageSummaries('2026-9')).rejects.toThrow('Expected YYYY-MM');
    expect(client.requests).toHaveLength(0);
  });

  it('throws HttpException 404 for a period without usage', async () => {
    const { endpoint } = makeEndpoint([
      SequenceHttpClient.jsonResponse({ success: false, error: 'No usage summaries found for this period' }, 404),
    ]);

    const error = await endpoint.getUsageSummaries('2020-01').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).statusCode).toBe(404);
  });
});
