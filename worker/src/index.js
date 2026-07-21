const ASSET_MANIFEST = {
  "manifest.webmanifest": "manifest.webmanifest",
  "registerSW.js": "registerSW.js",
  "sw.js": "sw.js",
  "workbox-9c191d2f.js": "workbox-9c191d2f.js",
  "index.html": "index.html",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // API requests: proxy to backend
    if (path.startsWith("/api/") || path.startsWith("/auth/") || path.startsWith("/admin/") || path.startsWith("/.well-known/")) {
      const backendOrigin = env.BACKEND_ORIGIN;
      if (!backendOrigin) {
        return new Response("BACKEND_ORIGIN not configured", { status: 500 });
      }

      // Strip trailing slashes from backendOrigin
      const cleanOrigin = backendOrigin.replace(/\/+$/, '');
      const backendUrl = `${cleanOrigin}${path}${url.search}`;


      const headers = new Headers(request.headers);
      headers.set("Host", new URL(backendOrigin).host);
      headers.delete("CF-Connecting-IP");
      headers.delete("CF-Ray");
      headers.delete("CF-Worker");

      let body = null;
      if (request.method !== "GET" && request.method !== "HEAD") {
        body = request.body;
      }

      try {
        const response = await fetch(backendUrl, {
          method: request.method,
          headers,
          body,
        });

        // Log proxy event
        console.log(JSON.stringify({
          event: "proxy_success",
          method: request.method,
          path: path,
          status: response.status,
          cf_ray: request.headers.get("cf-ray")
        }));

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

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: proxyHeaders,
        });
      } catch (error) {
        console.error(JSON.stringify({
          event: "proxy_error",
          method: request.method,
          path: path,
          error: error.message || String(error),
          stack: error.stack,
          cf_ray: request.headers.get("cf-ray")
        }));
        return new Response("Failed to contact the backend server. Please try again.", {
          status: 502,
          headers: {
            "Content-Type": "text/plain",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    }

    // Static assets: serve from Workers Assets
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) {
      return asset;
    }

    // Do NOT return SPA index.html fallback for missing static files (js, css, images, map, etc)
    if (/\.(js|jsx|ts|tsx|css|json|webmanifest|ico|png|jpg|jpeg|gif|svg|woff2?|ttf|eot)$/i.test(path)) {
      return new Response("Asset Not Found", { status: 404 });
    }

    // SPA fallback: serve index.html for client-side navigation routes
    const index = await env.ASSETS.fetch(
      new Request(new URL("/index.html", request.url), request)
    );
    return new Response(index.body, {
      status: 200,
      headers: {
        "Content-Type": "text/html",
      },
    });
  },
};

