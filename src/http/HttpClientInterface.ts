export interface HttpClientInterface {
  request(method: string, url: string, options?: RequestInit): Promise<Response>;
}
