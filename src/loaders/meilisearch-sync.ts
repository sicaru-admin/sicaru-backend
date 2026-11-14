import type { MedusaContainer } from "@medusajs/framework/types";
import { rebuildPublicSearch } from "../lib/public-search";

export default async function meiliSearchLoader(container: MedusaContainer) {
  if (process.env.DISABLE_MEILISEARCH_SYNC === "true") return;
  try {
    const count = await rebuildPublicSearch(container);
    console.log(`[MeiliSearch] Reconciled ${count} published products.`);
  } catch {
    // Keep Medusa's catalogue available when the optional search service is offline.
    // The public search endpoint fails closed and does not return unverified index hits.
    console.error("[MeiliSearch] Reconciliation failed; retry after restoring the search service.");
  }
}
