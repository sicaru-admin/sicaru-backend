import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { syncPublicProduct } from "../lib/public-search";

export default async function meiliSearchSyncHandler({ event, container }: SubscriberArgs<{ id: string }>) {
  if (process.env.DISABLE_MEILISEARCH_SYNC === "true") return;
  await syncPublicProduct(container, event.data.id, event.name.includes("deleted"));
}
export const config: SubscriberConfig = { event: ["product.created", "product.updated", "product.deleted"] };
