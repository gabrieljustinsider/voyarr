/**
 * Unified API Bridge — Client SDK (Issue #2, Phase 4)
 *
 * Shared utility for subordinate GameProductions apps to easily hit the
 * Foundation Fleet Proxy Hub. Callers supply their identity (projectId),
 * the provider + scope they are authorized for, and Foundation attaches the
 * correct stored OAuth token and forwards the request.
 *
 * Usage:
 *   const proxy = new FleetProxyClient({
 *     baseUrl: 'https://foundation.gpnet.dev/api/proxy/v1',
 *     serviceToken: env.SHARED_SERVICE_SECRET,
 *     projectId: 'globot',
 *   });
 *   await proxy.request('discord', 'webhook.send', '/users/@me');
 *   await proxy.post('discord', 'webhook.send', '/webhooks/{id}', { content: 'hi' });
 */

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

  /** GET through the proxy. */
  request(provider: string, scope: string, path: string): Promise<Response> {
    return this.send(provider, scope, path, 'GET');
  }

  /** POST through the proxy. */
  post(provider: string, scope: string, path: string, body?: unknown): Promise<Response> {
    return this.send(provider, scope, path, 'POST', body);
  }

  /** PATCH through the proxy. */
  patch(provider: string, scope: string, path: string, body?: unknown): Promise<Response> {
    return this.send(provider, scope, path, 'PATCH', body);
  }

  /** PUT through the proxy. */
  put(provider: string, scope: string, path: string, body?: unknown): Promise<Response> {
    return this.send(provider, scope, path, 'PUT', body);
  }

  /** DELETE through the proxy. */
  delete(provider: string, scope: string, path: string): Promise<Response> {
    return this.send(provider, scope, path, 'DELETE');
  }

  /** Convenience: parse a JSON response. */
  async json<T = any>(res: Response): Promise<T> {
    return res.json() as Promise<T>;
  }
}
