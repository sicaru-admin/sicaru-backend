import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/** A publishable key is public, but its channel scope must still be enforced. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader("Cache-Control", "no-store");
  const token = req.get("x-publishable-api-key");
  if (!token) return res.status(401).json({ message: "A valid storefront key is required" });
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const fresh = { cache: { enable: false } };
  const { data: keys } = await query.graph({ entity: "api_key",
    fields: ["token", "revoked_at", "sales_channels_link.sales_channel_id"],
    filters: { token, type: "publishable" } }, fresh);
  const key = keys?.[0];
  if (!key || (key.revoked_at && new Date(key.revoked_at) <= new Date())) {
    return res.status(401).json({ message: "A valid storefront key is required" });
  }
  const permitted = [...new Set<string>((key.sales_channels_link || []).flatMap(link => typeof link?.sales_channel_id === "string" ? [link.sales_channel_id] : []))];
  const requested = req.query.sales_channel_id;
  if (requested !== undefined && (typeof requested !== "string" || !permitted.includes(requested))) {
    return res.status(403).json({ message: "Channel is not permitted" });
  }
  const channels = typeof requested === "string" ? [requested] : permitted;
  if (!channels.length) return res.status(403).json({ message: "Storefront key has no channel" });
  const ids = new Set<string>();
  for (let skip = 0; ; skip += 200) {
    const { data = [] } = await query.graph({ entity: "product_sales_channel", fields: ["product_id"],
      filters: { sales_channel_id: channels }, pagination: { take: 200, skip, order: { product_id: "ASC" } } }, fresh);
    for (const row of data) ids.add(row.product_id);
    if (data.length < 200) break;
  }
  const visible = new Set<string>();
  const linked = [...ids];
  for (let offset = 0; offset < linked.length; offset += 200) {
    const { data = [] } = await query.graph({ entity: "product", fields: ["id", "status"],
      filters: { id: linked.slice(offset, offset + 200), status: "published" }, pagination: { take: 200, skip: 0 } }, fresh);
    for (const product of data) if (product.status === "published") visible.add(product.id);
  }
  return res.json({ publishable_key: token, product_count: visible.size });
}
