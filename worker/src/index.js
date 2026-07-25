const ASSET_MANIFEST = {
  "manifest.webmanifest": "manifest.webmanifest",
  "registerSW.js": "registerSW.js",
  "sw.js": "sw.js",
  "workbox-9c191d2f.js": "workbox-9c191d2f.js",
  "index.html": "index.html",
};

const PAIR_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Voyarr — Pair Device</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0f19; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
.container { text-align: center; max-width: 420px; padding: 2rem; }
h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; color: #a78bfa; }
p { color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem; line-height: 1.5; }
.code { font-size: 3.5rem; font-weight: 800; letter-spacing: 0.5rem; font-family: monospace; color: #fff; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 1.5rem; margin-bottom: 1rem; }
.status { font-size: 0.85rem; color: #64748b; margin-bottom: 0.5rem; }
.approved { color: #22c55e; font-weight: 700; font-size: 1.1rem; }
.spinner { display: inline-block; width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.1); border-top: 2px solid #a78bfa; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 8px; vertical-align: middle; }
@keyframes spin { to { transform: rotate(360deg); } }
.info { margin-top: 2rem; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 12px; font-size: 0.8rem; color: #64748b; line-height: 1.5; }
.hidden { display: none; }
</style>
</head>
<body>
<div class="container">
  <h1>Voyarr</h1>
  <p>Pair your VR headset or smart device<br>Enter this code on your desktop browser</p>
  <div id="codeDisplay" class="code"><span class="spinner"></span> Loading...</div>
  <div id="statusMessage" class="status"></div>
  <div class="info">This code expires in 5 minutes. <br>Open <strong>Account Security</strong> in Voyarr on your computer and enter the code above.</div>
</div>
<script>
(async function() {
  const codeEl = document.getElementById('codeDisplay');
  const statusEl = document.getElementById('statusMessage');

  try {
    const res = await fetch('/api/auth/pair/device/request', { method: 'POST' });
    const data = await res.json();
    codeEl.textContent = data.user_code;
    statusEl.textContent = 'Waiting for approval...';

    const poll = async () => {
      try {
        const p = await fetch('/api/auth/pair/device/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_code: data.device_code })
        });
        const pdata = await p.json();
        if (pdata.status === 'success') {
          codeEl.className = 'code approved';
          codeEl.textContent = 'PAIRED!';
          statusEl.innerHTML = '<span class="approved">Redirecting to Voyarr...</span>';
          localStorage.setItem('voyarr_api_key', pdata.api_key || pdata.token || '');
          setTimeout(function() { window.location.href = '/'; }, 1500);
          return;
        }
      } catch(e) {}
      setTimeout(poll, 3000);
    };
    poll();
  } catch(e) {
    codeEl.textContent = 'Error';
    statusEl.textContent = 'Failed to connect to server.';
  }
})();
</script>
</body>
</html>`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Pairing page for VR headsets: serve standalone HTML (before DeoVR detection)
    if (path === "/pair") {
      return new Response(PAIR_PAGE_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // DeoVR detection: proxy to backend if DeoVR user-agent or deovr=1 query param
    const userAgent = request.headers.get("user-agent") || "";
    const uaLower = userAgent.toLowerCase();
    const isDeovr = uaLower.includes("deovr") || uaLower.includes("deo/") || /\[deo[\d.]+\]/i.test(userAgent) || uaLower.includes("hmd/") || uaLower.includes("meta-store");
    const hasDeovrParam = url.searchParams.get("deovr") === "1" || url.searchParams.get("deovr") === "true";
    if (isDeovr || hasDeovrParam) {
      const backendOrigin = env.BACKEND_ORIGIN;
      if (backendOrigin) {
        let cleanOrigin = backendOrigin;
        while (cleanOrigin.endsWith('/')) cleanOrigin = cleanOrigin.slice(0, -1);
        const backendUrl = `${cleanOrigin}${path}${url.search}`;
        const headers = new Headers(request.headers);
        headers.set("Host", new URL(backendOrigin).host);
        const response = await fetch(backendUrl, { method: request.method, headers, body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null });
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers });
      }
    }

    const isApiRoute = 
      path.startsWith("/api") || 
      path.startsWith("/auth") || 
      path.startsWith("/admin") || 
      path.startsWith("/.well-known") ||
      path.startsWith("/providers") ||
      path.startsWith("/billers") ||
      path.startsWith("/studios") ||
      path.startsWith("/subscriptions") ||
      path.startsWith("/favorites") ||
      path.startsWith("/download") ||
      path.startsWith("/notifications") ||
      path.startsWith("/library") ||
      path.startsWith("/settings") ||
      path.startsWith("/analytics") ||
      path.startsWith("/schedules") ||
      path.startsWith("/transcode") ||
      path.startsWith("/rules") ||
      path.startsWith("/cookies") ||
      path.startsWith("/apikeys") ||
      path.startsWith("/deovr");

    // API requests: proxy to backend
    if (isApiRoute) {
      const backendOrigin = env.BACKEND_ORIGIN;
      if (!backendOrigin) {
        return new Response("BACKEND_ORIGIN not configured", { status: 500 });
      }

      // Strip trailing slashes from backendOrigin
      let cleanOrigin = backendOrigin;
      while (cleanOrigin.endsWith('/')) cleanOrigin = cleanOrigin.slice(0, -1);
      
      // If incoming path starts with /api/, strip the /api prefix before forwarding to backend FastAPI origin
      let targetPath = path;
      if (targetPath.startsWith('/api/')) {
        targetPath = targetPath.substring(4);
      } else if (targetPath === '/api') {
        targetPath = '/';
      }

      const backendUrl = `${cleanOrigin}${targetPath}${url.search}`;



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

        // For SSE/streaming responses, use the raw response body to keep the connection open
        if (response.headers.get("content-type")?.includes("text/event-stream")) {
          const { readable, writable } = new TransformStream();
          response.body.pipeTo(writable).catch(() => {});
          return new Response(readable, {
            status: response.status,
            statusText: response.statusText,
            headers: proxyHeaders,
          });
        }

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

