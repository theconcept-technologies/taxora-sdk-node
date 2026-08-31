import { describe, it, expect } from 'vitest';
import { RetryPolicy } from '../../src/http/RetryPolicy.js';
import { withRetries, withResponseRetries } from '../../src/http/withRetries.js';
import { HttpException } from '../../src/exceptions/HttpException.js';

describe('RetryPolicy', () => {
  it('retries gateway errors only', () => {
    const policy = new RetryPolicy();

    expect(policy.isRetryable(502)).toBe(true);
    expect(policy.isRetryable(503)).toBe(true);
    expect(policy.isRetryable(504)).toBe(true);

    // Answers the API produced itself are never retried.
    expect(policy.isRetryable(500)).toBe(false);
    expect(policy.isRetryable(429)).toBe(false);
    expect(policy.isRetryable(422)).toBe(false);
  });

  it('stops at maxAttempts', () => {
    const policy = new RetryPolicy({ maxAttempts: 3 });

    expect(policy.shouldRetry(504, 1)).toBe(true);
    expect(policy.shouldRetry(504, 2)).toBe(true);
    expect(policy.shouldRetry(504, 3)).toBe(false);
    expect(policy.shouldRetry(400, 1)).toBe(false);
  });

  it('grows the backoff and caps it', () => {
    const policy = new RetryPolicy({ initialDelayMs: 500, backoffMultiplier: 2, maxDelayMs: 5000 });

    expect([1, 2, 3, 4, 5, 50].map((a) => policy.delayMsForAttempt(a))).toEqual([500, 1000, 2000, 4000, 5000, 5000]);
  });

  it('disabled() never retries and withoutDelay() does not sleep', () => {
    expect(RetryPolicy.disabled().shouldRetry(504, 1)).toBe(false);
    expect(RetryPolicy.withoutDelay().delayMsForAttempt(1)).toBe(0);
  });

  it('retries a 429 only when it says how long to wait', () => {
    const policy = new RetryPolicy();

    // Without a Retry-After we would only hammer a rate limit that is already tripped.
    expect(policy.isRetryable(429)).toBe(false);
    expect(policy.isRetryable(429, '2')).toBe(true);
  });

  it('gives up when Retry-After exceeds the cap', () => {
    const policy = new RetryPolicy({ maxRetryAfterMs: 10_000 });

    expect(policy.isRetryable(429, '60')).toBe(false);
    expect(policy.isRetryable(503, '60')).toBe(false);
    expect(policy.isRetryable(503, '5')).toBe(true);
  });

  it('lets Retry-After override the backoff', () => {
    const policy = new RetryPolicy();

    expect(policy.delayMsForAttempt(1, '2')).toBe(2000);
    expect(policy.delayMsForAttempt(1, null)).toBe(500);
    expect(policy.delayMsForAttempt(1, 'not-a-date')).toBe(500);
  });

  it('parses Retry-After in seconds and as an HTTP date', () => {
    const policy = new RetryPolicy();
    const now = new Date('2026-08-31T12:00:00Z');

    expect(policy.retryAfterMs('3', now)).toBe(3000);
    expect(policy.retryAfterMs('Mon, 31 Aug 2026 12:00:05 GMT', now)).toBe(5000);
    // A date in the past means "go ahead now".
    expect(policy.retryAfterMs('Mon, 31 Aug 2026 11:59:00 GMT', now)).toBe(0);
    expect(policy.retryAfterMs('   ', now)).toBeNull();
    expect(policy.retryAfterMs('soon', now)).toBeNull();
    expect(policy.retryAfterMs(null, now)).toBeNull();
  });

  it('can ignore Retry-After entirely', () => {
    const policy = new RetryPolicy({ respectRetryAfter: false });

    expect(policy.retryAfterMs('2')).toBeNull();
    expect(policy.isRetryable(429, '2')).toBe(false);
    expect(policy.isRetryable(503, '60')).toBe(true);
  });

  it('recognises transport failures but not ordinary bugs', () => {
    const policy = new RetryPolicy();

    expect(policy.isRetryableError(Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }))).toBe(true);
    expect(policy.isRetryableError(new TypeError('fetch failed'))).toBe(true);
    expect(policy.isRetryableError(Object.assign(new Error('timeout'), { name: 'AbortError' }))).toBe(true);
    expect(
      policy.isRetryableError(new TypeError('Cannot read properties of undefined (reading "vat_uid")')),
    ).toBe(false);
    expect(policy.isRetryableError(new Error('boom'))).toBe(false);

    const off = new RetryPolicy({ retryOnNetworkErrors: false });
    expect(off.isRetryableError(new TypeError('fetch failed'))).toBe(false);
  });

  it('rejects invalid configuration', () => {
    expect(() => new RetryPolicy({ maxAttempts: 0 })).toThrow();
  });
});

describe('withRetries', () => {
  it('returns the first success without waiting', async () => {
    const policy = RetryPolicy.withoutDelay();
    let calls = 0;

    const result = await withRetries(policy, 'VAT validation', async () => {
      calls++;
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(calls).toBe(1);
  });

  it('reports the exhausted attempts in the message', async () => {
    const policy = RetryPolicy.withoutDelay();
    let calls = 0;

    const error = await withRetries(policy, 'VAT validation', async () => {
      calls++;
      throw new HttpException('Taxora API request failed (HTTP 504 Gateway Timeout).', 504, '<html></html>');
    }).catch((e: unknown) => e);

    expect(calls).toBe(3);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).message).toBe(
      'Taxora VAT validation failed after 3 attempts (HTTP 504 Gateway Timeout).',
    );
    expect((error as HttpException).getStatusCode()).toBe(504);
  });

  it('surfaces non-transient errors immediately', async () => {
    const policy = RetryPolicy.withoutDelay();
    let calls = 0;

    const error = await withRetries(policy, 'VAT validation', async () => {
      calls++;
      throw new HttpException('nope', 400, '{"message":"nope"}');
    }).catch((e: unknown) => e);

    expect(calls).toBe(1);
    expect((error as HttpException).message).toBe('nope');
  });

  it('does not swallow ordinary bugs', async () => {
    let calls = 0;

    await expect(
      withRetries(RetryPolicy.withoutDelay(), 'VAT validation', () => {
        calls++;
        return Promise.reject(new TypeError('x is not a function'));
      }),
    ).rejects.toThrow(TypeError);
    expect(calls).toBe(1);
  });

  it('retries a transport failure and rethrows it unchanged when the attempts run out', async () => {
    const policy = RetryPolicy.withoutDelay();
    let calls = 0;

    // Recovers on the second attempt.
    const recovered = await withRetries(policy, 'VAT validation', () => {
      calls++;
      return calls === 1 ? Promise.reject(new TypeError('fetch failed')) : Promise.resolve('ok');
    });
    expect(recovered).toBe('ok');
    expect(calls).toBe(2);

    calls = 0;
    const error = await withRetries(policy, 'VAT validation', () => {
      calls++;
      return Promise.reject(Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }));
    }).catch((e: unknown) => e);

    expect(calls).toBe(3);
    // Callers keep seeing their own HTTP client's error.
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('read ECONNRESET');
  });

  it('waits exactly as long as a 429 asks', async () => {
    const slept: number[] = [];
    const policy = new RetryPolicy({ sleeper: (ms) => void slept.push(ms) });
    let calls = 0;

    const result = await withRetries(policy, 'VAT validation', () => {
      calls++;
      if (calls === 1) {
        throw new HttpException('Too Many Requests', 429, '{"message":"Too Many Requests"}', {}, '2');
      }
      return Promise.resolve('ok');
    });

    expect(result).toBe('ok');
    expect(slept).toEqual([2000]);
  });

  it('surfaces a 429 without Retry-After immediately', async () => {
    let calls = 0;

    const error = await withRetries(RetryPolicy.withoutDelay(), 'VAT validation', () => {
      calls++;
      throw new HttpException('Too Many Requests', 429, '{"message":"Too Many Requests"}');
    }).catch((e: unknown) => e);

    expect(calls).toBe(1);
    expect((error as HttpException).message).toBe('Too Many Requests');
  });
});

describe('withResponseRetries', () => {
  it('retries a transient status and returns the eventual response', async () => {
    const statuses = [503, 200];
    let calls = 0;

    const response = await withResponseRetries(RetryPolicy.withoutDelay(), 'e-reporting request', () => {
      const status = statuses[calls++] ?? 200;
      return Promise.resolve(new Response('{}', { status }));
    });

    expect(calls).toBe(2);
    expect(response.status).toBe(200);
  });

  it('honours Retry-After on a retried GET', async () => {
    const slept: number[] = [];
    const policy = new RetryPolicy({ sleeper: (ms) => void slept.push(ms) });
    let calls = 0;

    const response = await withResponseRetries(policy, 'e-reporting request', () => {
      calls++;
      return Promise.resolve(
        calls === 1 ? new Response('{}', { status: 503, headers: { 'Retry-After': '3' } }) : new Response('{}'),
      );
    });

    expect(response.status).toBe(200);
    expect(slept).toEqual([3000]);
  });

  it('retries a transport failure', async () => {
    let calls = 0;

    const response = await withResponseRetries(RetryPolicy.withoutDelay(), 'e-reporting request', () => {
      calls++;
      return calls === 1 ? Promise.reject(new TypeError('fetch failed')) : Promise.resolve(new Response('{}'));
    });

    expect(calls).toBe(2);
    expect(response.status).toBe(200);
  });

  it('throws the attempts message once they are used up', async () => {
    const error = await withResponseRetries(RetryPolicy.withoutDelay(), 'e-reporting request', () =>
      Promise.resolve(new Response('<html><body>504</body></html>', { status: 504 })),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).message).toBe(
      'Taxora e-reporting request failed after 3 attempts (HTTP 504 Gateway Timeout).',
    );
    expect((error as HttpException).message).not.toContain('<');
  });
});
