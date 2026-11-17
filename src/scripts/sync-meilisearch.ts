// Fail before resolving services, configuring, creating or deleting an index.
export default async function syncMeiliSearch() {
  throw new Error("Meilisearch is disabled in Store API-only mode; reactivation requires a reviewed code change.");
}
