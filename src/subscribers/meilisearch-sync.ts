import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";

// Deliberately unconditional: environment variables cannot reactivate legacy indexing.
export default async function meiliSearchSyncHandler(_: SubscriberArgs<{ id: string }>) {}
export const config: SubscriberConfig = { event: ["product.created", "product.updated", "product.deleted"] };
