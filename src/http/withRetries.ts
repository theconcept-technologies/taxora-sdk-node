import { HttpException } from '../exceptions/HttpException.js';
import { describeApiError } from '../exceptions/apiErrorMessage.js';
import { type RetryPolicy } from './RetryPolicy.js';

/**
 * Runs `request` and retries it while the gateway in front of the API keeps
 * failing. Wrap only read-only operations in this: a 502/503/504 does not tell
 * us whether the API already processed the request, so anything that changes
 * state or costs quota must fail fast instead.
 *
 * @param operation Short label used in the final error message, e.g. "VAT validation".
 */
export async function withRetries<T>(policy: RetryPolicy, operation: string, request: () => Promise<T>): Promise<T> {
  let attempt = 1;

  for (;;) {
    try {
      return await request();
    } catch (error) {
      if (!(error instanceof HttpException)) {
        // Connection reset, client-side timeout, DNS hiccup: no answer ever
        // arrived, so this is as safe to repeat as a gateway timeout. The
        // transport error is rethrown unchanged once we give up, so callers keep
        // seeing their HTTP client's own error.
        if (!policy.shouldRetryError(error, attempt)) throw error;

        await policy.sleepBeforeRetry(attempt);
        attempt++;
        continue;
      }

      const retryAfter = error.getRetryAfter();

      if (!policy.shouldRetry(error.getStatusCode(), attempt, retryAfter)) {
        throw attempt > 1 && policy.isRetryable(error.getStatusCode(), retryAfter)
          ? HttpException.afterAttempts(operation, attempt, error)
          : error;
      }

      await policy.sleepBeforeRetry(attempt, retryAfter);
      attempt++;
    }
  }
}

/**
 * Same idea one level lower: retries a request that answers with a transient
 * gateway status instead of throwing. Used for plain GETs, which are safe to
 * repeat by definition. When the attempts are used up, the gateway status is
 * turned into the same "failed after N attempts" error as withRetries().
 */
export async function withResponseRetries(
  policy: RetryPolicy,
  operation: string,
  send: () => Promise<Response>,
): Promise<Response> {
  let attempt = 1;

  for (;;) {
    let response: Response;
    try {
      response = await send();
    } catch (error) {
      // Same reasoning as in withRetries(): a transport failure never reached an
      // answer, and is rethrown unchanged once the attempts are used up.
      if (!policy.shouldRetryError(error, attempt)) throw error;

      await policy.sleepBeforeRetry(attempt);
      attempt++;
      continue;
    }

    const retryAfter = response.headers.get('retry-after');

    if (!policy.shouldRetry(response.status, attempt, retryAfter)) {
      if (attempt > 1 && policy.isRetryable(response.status, retryAfter)) {
        const body = await response.text();
        const last = new HttpException(describeApiError(body, response.status), response.status, body, {}, retryAfter);

        throw HttpException.afterAttempts(operation, attempt, last);
      }

      return response;
    }

    await policy.sleepBeforeRetry(attempt, retryAfter);
    attempt++;
  }
}
