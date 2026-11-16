import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { invalidateStorefront } from "../lib/invalidate-storefront";

// Invalidate all catalogue paths: the old handle/category may no longer be on the product.
export default async function catalogCacheHandler(_: SubscriberArgs<{ id: string }>) {
  await invalidateStorefront();
}
export const config: SubscriberConfig = { event: ["product.created", "product.updated", "product.deleted"] };
