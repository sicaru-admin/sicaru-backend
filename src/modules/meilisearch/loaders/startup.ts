import type { LoaderOptions } from "@medusajs/framework/types";
import { container as applicationContainer } from "@medusajs/framework";
import { asValue } from "@medusajs/framework/awilix";
import reconcile from "../../../loaders/meilisearch-sync";

/** Register only. The module-local container does not contain the application query. */
export default async function registerSearchStartup({ container }: LoaderOptions) {
  container.register("meilisearchStartupReconcile", asValue(async () => {
    // Opt in only on the actual API/develop CLI entrypoint, never exec/db commands.
    const command = process.argv[2];
    if (process.env.DISABLE_MEILISEARCH_SYNC === "true" ||
        process.env.MEILISEARCH_RECONCILE_ON_START !== "true" ||
        !["start", "develop"].includes(command)) return;
    await reconcile(applicationContainer);
  }));
}
