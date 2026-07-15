export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const backendOrigin = env.BACKEND_ORIGIN;

    if (!backendOrigin) {
      return new Response("BACKEND_ORIGIN not configured", { status: 500 });
    }

    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }

    const backendUrl = `${backendOrigin}${url.pathname}${url.search}`;

    const headers = new Headers(request.headers);
    headers.set("Host", new URL(backendOrigin).host);
    headers.delete("CF-Connecting-IP");
    headers.delete("CF-Ray");
    headers.delete("CF-Worker");

    let body = null;
    if (request.method !== "GET" && request.method !== "HEAD") {
      body = request.body;
    }

    const response = await fetch(backendUrl, {
      method: request.method,
      headers,
      body,
    });

    const proxyHeaders = new Headers(response.headers);
    proxyHeaders.set("Access-Control-Allow-Origin", "*");
    proxyHeaders.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS"
    );
    proxyHeaders.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Voyarr-Api-Key, X-Api-Key"
    );
    proxyHeaders.set("Access-Control-Allow-Credentials", "true");

    const proxyResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: proxyHeaders,
    });

    return proxyResponse;
  },
};

function handleOptions(request) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Voyarr-Api-Key, X-Api-Key",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
  return new Response(null, { status: 204, headers });
}
