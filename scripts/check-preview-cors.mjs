// Read-only check of the deployed review backend; no API keys, carts or payments.
const backend = "https://sicaru-backend-preview-payments.up.railway.app";
const origins = [
  "https://sicaru-6sdncskmy-sicaru-admins-projects.vercel.app",
  "https://sicaru-git-codex-dhl-provisional-sicaru-admins-projects.vercel.app",
];
const checks = [
  { path: "/store/regions", method: "GET" },
  { path: "/store/carts", method: "POST" },
  { path: "/store/carts/cors-probe-only/line-items", method: "POST" },
];
for (const origin of origins) {
  for (const { path, method } of checks) {
    const response = await fetch(backend + path, {
      method: "OPTIONS",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": method,
        "Access-Control-Request-Headers": "content-type,x-publishable-api-key",
      },
    });
    const allowOrigin = response.headers.get("access-control-allow-origin");
    const allowCredentials = response.headers.get("access-control-allow-credentials");
    const allowMethods = (response.headers.get("access-control-allow-methods") || "").split(",").map((v) => v.trim().toUpperCase());
    const allowHeaders = (response.headers.get("access-control-allow-headers") || "").split(",").map((v) => v.trim().toLowerCase());
    const passed = response.ok && allowOrigin === origin &&
      allowCredentials === "true" && allowMethods.includes(method) &&
      allowHeaders.includes("content-type") && allowHeaders.includes("x-publishable-api-key");
    console.log(JSON.stringify({ origin, path, requestedMethod: method,
      status: response.status, allowOrigin, allowCredentials, allowMethods,
      allowHeaders, passed }));
    if (!passed) {
      console.error("Review backend CORS preflight failed. No cart request was sent.");
      process.exit(1);
    }
  }
}
console.log("Six live CORS preflights passed. Cart creation and sales-channel acceptance are separate checks.");
