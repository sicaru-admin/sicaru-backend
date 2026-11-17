import { createHmac } from "node:crypto";

/** Optional defense in depth. Fresh Store API rendering must not depend on delivery. */
export async function invalidateStorefront() {
  const secret = process.env.CATALOG_REVALIDATION_SECRET;
  if (!secret) return; // Integration is not configured until separately authorized.
  if (secret.length < 32) throw new Error("Catalog invalidation is not configured safely");
  const target = new URL(process.env.CATALOG_REVALIDATION_URL || "https://www.sicarubeauty.com/api/revalidate");
  const localTest = process.env.NODE_ENV === "test" && target.hostname === "127.0.0.1";
  if ((!localTest && target.origin !== "https://www.sicarubeauty.com") ||
      target.pathname !== "/api/revalidate" || target.search || target.hash || target.username || target.password) {
    throw new Error("Catalog invalidation target is not permitted");
  }
  const body = JSON.stringify({ scope: "catalog" });
  const timestamp = String(Date.now());
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  // Never follow redirects carrying authentication. Do not log URLs, bodies or secrets.
  const response = await fetch(target, { method: "POST", redirect: "error", cache: "no-store",
    signal: AbortSignal.timeout(5000), headers: { "content-type": "application/json",
      "x-sicaru-timestamp": timestamp, "x-sicaru-signature": signature }, body });
  if (!response.ok) throw new Error("Catalog invalidation failed; retry is safe");
}
