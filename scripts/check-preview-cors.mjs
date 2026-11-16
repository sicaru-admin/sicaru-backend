// Review-only checks: default OPTIONS reads; --cart performs anonymous cart CRUD and cleanup. No payments, orders or labels.
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

if (process.argv.includes("--cart")) {
  const { createHash } = await import("node:crypto");
  const expectedKeyFingerprint = "92aaccb2b97cd7f65e471d33585df871d56f7d1a8dda5e9f7a29c3a578c40873";
  const channelId = "sc_01KZD6DTFPXNTG52EGDHYY00BJ"; // Public Preview channel, not a secret.
  const origin = origins[1];
  // Diagnose only the public configuration returned by this isolated backend.
  const bootstrapResponse = await fetch(backend + "/storefront-config", { signal: AbortSignal.timeout(15000), redirect: "error" });
  if (!bootstrapResponse.ok) throw new Error("Review public config unavailable");
  const bootstrap = await bootstrapResponse.json();
  const key = bootstrap.publishable_key;
  if (typeof key !== "string" || !/^pk_[a-zA-Z0-9]+$/.test(key)) throw new Error("Expected a publishable browser key");
  if (createHash("sha256").update(key).digest("hex") !== expectedKeyFingerprint)
    throw new Error("Public review config no longer matches the verified branch-specific Preview key");
  console.log(JSON.stringify({ check: "isolated-public-config-key",
    fingerprint: createHash("sha256").update(key).digest("hex"),
    sameAsCurrentPreview: createHash("sha256").update(key).digest("hex") === expectedKeyFingerprint }));


  async function request(path, method = "GET", body) {
    const res = await fetch(backend + path, {
      method, signal: AbortSignal.timeout(20000), redirect: "error",
      headers: { Origin: origin, "x-publishable-api-key": key, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await res.json();
    const cors = res.headers.get("access-control-allow-origin") === origin &&
      res.headers.get("access-control-allow-credentials") === "true";
    console.log(JSON.stringify({ check: "store-api", path: path.replace(/cart_[^/]+/g, ":cart").replace(/cali_[^/]+/g, ":line"), method, status: res.status, cors }));
    if (!res.ok) throw new Error("Review API failed: " + method + " " + path.split("?")[0] + " (" + res.status + "), detail=" + JSON.stringify({ type: data.type, message: data.message, errors: data.errors }).replace(/pk_[a-zA-Z0-9]+/g, "[public-key-redacted]"));
    if (!cors) throw new Error("Actual review API response is missing credentialed CORS");
    return data;
  }
  const regionData = await request("/store/regions");
  const region = regionData.regions?.find(r => r.currency_code === "mxn" && r.countries?.some(c => c.iso_2 === "mx"));
  if (!region?.id) throw new Error("Review Mexico/MXN region missing");
  let result;
  try {
    result = await request("/store/carts", "POST", { region_id: region.id, sales_channel_id: channelId });
  } catch (error) {
    // A diagnostic cart without an explicit channel lets Medusa reveal the
    // channel associated with this exact public key. Keep the original failure.
    const diagnostic = await request("/store/carts", "POST", { region_id: region.id });
    console.log(JSON.stringify({ check: "backend-assigned-channel-diagnostic",
      sales_channel_id: diagnostic.cart?.sales_channel_id,
      cartEmpty: diagnostic.cart?.items?.length === 0 }));
    throw error;
  }
  const cart = result.cart;
  if (!cart?.id || cart.sales_channel_id !== channelId || cart.region_id !== region.id)
    throw new Error("Created review cart does not match the configured channel and region");
  console.log(JSON.stringify({ check: "cart-created-with-preview-channel", passed: true }));
  const products = await request("/store/products?handle=voglia-tinte-permanente-90ml&limit=1&region_id=" + encodeURIComponent(region.id));
  const variant = products.products?.[0]?.variants?.[0];
  if (!variant?.id) throw new Error("Review Voglia variant missing");
  let lineId;
  try {
    const added = await request("/store/carts/" + cart.id + "/line-items", "POST", { variant_id: variant.id, quantity: 1 });
    const line = added.cart?.items?.find(i => i.variant_id === variant.id);
    if (!line?.id || line.quantity !== 1) throw new Error("Review line item was not added");
    lineId = line.id;
    const updated = await request("/store/carts/" + cart.id + "/line-items/" + lineId, "POST", { quantity: 2 });
    if (updated.cart?.items?.find(i => i.id === lineId)?.quantity !== 2)
      throw new Error("Review quantity was not updated");
    console.log(JSON.stringify({ check: "voglia-added-and-quantity-updated", passed: true }));
    const quoteResponse = await request("/store/carts/" + cart.id + "/dhl-quote");
    const quote = quoteResponse.quote;
    if (quote.status !== "quote_required" || quote.reason !== "tariff_unconfirmed" || quoteResponse.shipping_options?.length !== 0)
      throw new Error("Expected disabled DHL, received " + quote.status + "/" + quote.reason);
    console.log(JSON.stringify({ check: "dhl-disabled-on-real-cart", passed: true }));
  } finally {
    if (lineId) await request("/store/carts/" + cart.id + "/line-items/" + lineId, "DELETE");
    const empty = await request("/store/carts/" + cart.id);
    if (empty.cart?.items?.length !== 0) throw new Error("Review cart cleanup did not leave it empty");
    console.log(JSON.stringify({ check: "test-product-removed-cart-empty", passed: true }));
  }
  console.log(JSON.stringify({ check: "verified-isolated-public-config", fingerprint: expectedKeyFingerprint, sales_channel_id: channelId }));
  console.log("Real review cart/channel/API checks passed. No email, address, payment session, order or label created. Browser UI is a separate check.");
}
