import type { ExecArgs } from "@medusajs/framework/types";
import { rebuildPublicSearch } from "../lib/public-search";

export default async function syncMeiliSearch({ container }: ExecArgs) {
  if (process.env.DISABLE_MEILISEARCH_SYNC === "true") throw new Error("Search synchronization is disabled");
  const count = await rebuildPublicSearch(container);
  console.log(`[MeiliSearch] Reconciled ${count} published products.`);
}
