import { HttpClientInterface } from '../../src/http/HttpClientInterface.js';

interface RecordedRequest {
  method: string;
  url: string;
  options?: RequestInit;
}

export class SequenceHttpClient implements HttpClientInterface {
  public requests: RecordedRequest[] = [];
  private responses: Response[];

  constructor(responses: Response[]) {
    this.responses = [...responses];
  }

  async request(method: string, url: string, options?: RequestInit): Promise<Response> {
    this.requests.push({ method, url, options });

    const response = this.responses.shift();
    if (!response) {
      throw new Error('SequenceHttpClient: no more responses available');
    }
    return response;
  }

  static jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  static binaryResponse(data: Uint8Array, status = 200): Response {
    return new Response(data, {
      status,
      headers: { 'Content-Type': 'application/octet-stream' },
    });
  }
}
