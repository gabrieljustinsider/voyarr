export interface FleetProxyClientOptions {
  baseUrl: string;
  serviceToken: string;
  projectId: string;
  fetchImpl?: typeof fetch;
}

export class FleetProxyClient {
  private baseUrl: string;
  private serviceToken: string;
  private projectId: string;
  private fetchImpl: typeof fetch;

  constructor(opts: FleetProxyClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.serviceToken = opts.serviceToken;
    this.projectId = opts.projectId;
    this.fetchImpl = opts.fetchImpl || fetch.bind(globalThis);
  }

  private async send(
    provider: string,
    scope: string,
    path: string,
    method: string,
    body?: unknown
  ): Promise<Response> {
    const url = `${this.baseUrl}/${provider}/${path.replace(/^\/+/, '')}`;
    const headers: Record<string, string> = {
      'X-Service-Token': this.serviceToken,
      'X-Project-ID': this.projectId,
      'X-Project-Scope': scope,
      'Content-Type': 'application/json',
    };

    return this.fetchImpl(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async get(provider: string, scope: string, path: string): Promise<Response> {
    return this.send(provider, scope, path, 'GET');
  }

  async post(provider: string, scope: string, path: string, body?: unknown): Promise<Response> {
    return this.send(provider, scope, path, 'POST', body);
  }

  async put(provider: string, scope: string, path: string, body?: unknown): Promise<Response> {
    return this.send(provider, scope, path, 'PUT', body);
  }

  async delete(provider: string, scope: string, path: string, body?: unknown): Promise<Response> {
    return this.send(provider, scope, path, 'DELETE', body);
  }

  async request(
    provider: string,
    scope: string,
    path: string,
    options: { method?: string; body?: unknown } = {}
  ): Promise<Response> {
    return this.send(provider, scope, path, options.method || 'GET', options.body);
  }
}
