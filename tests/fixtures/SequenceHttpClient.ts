import { type HttpClientInterface } from '../../src/http/HttpClientInterface.js';

interface RecordedRequest {
  method: string;
  url: string;
  options?: RequestInit;
}

/**
 * An entry may also be an Error, which is thrown instead of returned — that is
 * how a transport failure (connection reset, client timeout) is simulated.
 */
export class SequenceHttpClient implements HttpClientInterface {
  public requests: RecordedRequest[] = [];
  private responses: (Response | Error)[];

  constructor(responses: (Response | Error)[]) {
    this.responses = [...responses];
  }

  async request(method: string, url: string, options?: RequestInit): Promise<Response> {
    this.requests.push({ method, url, options });

    const response = this.responses.shift();
    if (!response) {
      throw new Error('SequenceHttpClient: no more responses available');
    }
    if (response instanceof Error) {
      throw response;
    }
    return response;
  }

  /** Stands in for what fetch throws on a reset connection or client-side timeout. */
  static networkError(message = 'fetch failed'): Error {
    return new TypeError(message);
  }

  static jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  static textResponse(body: string, status = 200, contentType = 'text/plain'): Response {
    return new Response(body, {
      status,
      headers: { 'Content-Type': contentType },
    });
  }

  static binaryResponse(data: Uint8Array, status = 200): Response {
    return new Response(data, {
      status,
      headers: { 'Content-Type': 'application/octet-stream' },
    });
  }
}
