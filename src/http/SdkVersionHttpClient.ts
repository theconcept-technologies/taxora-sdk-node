import { type HttpClientInterface } from './HttpClientInterface.js';
import { SDK_VERSION } from '../version.js';

const SDK_VERSION_HEADER = 'X-Taxora-SDK-Version';
const SDK_VERSION_VALUE = `taxora-node/${SDK_VERSION}`;

/**
 * HTTP client wrapper that stamps every outgoing request with the SDK version
 * header so the backend can record which SDK version made the call.
 *
 * Purely additive: it only merges in one header (without overwriting existing
 * ones) and delegates to the inner client.
 */
export class SdkVersionHttpClient implements HttpClientInterface {
  constructor(private readonly inner: HttpClientInterface) {}

  async request(method: string, url: string, options?: RequestInit): Promise<Response> {
    const existing = options?.headers ?? {};
    const headers = {
      ...(existing as Record<string, string>),
      [SDK_VERSION_HEADER]: SDK_VERSION_VALUE,
    };
    return this.inner.request(method, url, { ...(options ?? {}), headers });
  }
}
