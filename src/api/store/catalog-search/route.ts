import type { MedusaStoreRequest, MedusaResponse } from "@medusajs/framework/http";
import { searchPublicProducts } from "../../../lib/public-search";

export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  res.setHeader("Cache-Control", "no-store");
  const channels = req.publishable_key_context?.sales_channel_ids || [];
  if (!channels.length) return res.status(401).json({ message: "A valid storefront key is required" });
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120) : "";
  try {
    const products = await searchPublicProducts(req.scope, q, channels);
    return res.json({ products, count: products.length });
  } catch {
    return res.status(503).json({ message: "Search is temporarily unavailable" });
  }
}
