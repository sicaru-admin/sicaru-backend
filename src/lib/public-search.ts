import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type MeiliSearchService from "../modules/meilisearch/service";
import type { ProductDocument } from "../modules/meilisearch/service";

export const SEARCH_FIELDS = ["id", "status", "title", "description", "handle", "thumbnail", "collection.*", "categories.*", "variants.*", "variants.prices.*", "created_at", "updated_at"];
const LOCK = "sicaru-public-search-index";

export function buildPublicDocument(product: Record<string, any>): ProductDocument | null {
  if (product.status !== "published") return null;
  const categories = (product.categories || []).filter((c: Record<string, any>) => c.is_active === true && c.is_internal === false);
  let lowestPrice: number | null = null;
  let currencyCode: string | null = null;
  for (const variant of product.variants || []) {
    for (const price of variant.prices || variant.price_set?.prices || []) {
      if (lowestPrice === null || price.amount < lowestPrice) {
        lowestPrice = price.amount;
        currencyCode = price.currency_code || "mxn";
      }
    }
  }
  return { id: product.id, status: "published", title: product.title || "", description: product.description || null,
    handle: product.handle || "", thumbnail: product.thumbnail || null,
    collection_title: product.collection?.title || null, collection_id: product.collection_id || null,
    categories: categories.map((c: Record<string, any>) => c.name), category_ids: categories.map((c: Record<string, any>) => c.id),
    price: lowestPrice, currency_code: currencyCode,
    created_at: product.created_at ? new Date(product.created_at).toISOString() : new Date().toISOString(),
    updated_at: product.updated_at ? new Date(product.updated_at).toISOString() : new Date().toISOString() };
}

export async function withSearchLock<T>(container: MedusaContainer, job: () => Promise<T>): Promise<T> {
  // PostgreSQL transaction locks coordinate rebuilds/events across all Medusa workers.
  // A process-local queue would allow an old rebuild to overwrite a newer deletion.
  const connection = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  return connection.transaction(async transaction => {
    await transaction.raw("SET LOCAL lock_timeout = '60s'");
    await transaction.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [LOCK]);
    return job();
  });
}

export async function syncPublicProduct(container: MedusaContainer, id: string, deleted = false): Promise<void> {
  await withSearchLock(container, async () => {
    const service: MeiliSearchService = container.resolve("meilisearch");
    if (deleted) return service.deleteProduct(id);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    // Read after acquiring the lock: a delayed 'created' event must see current status.
    const { data } = await query.graph({ entity: "product", fields: SEARCH_FIELDS, filters: { id } }, { cache: { enable: false } });
    const document = data?.[0] ? buildPublicDocument(data[0]) : null;
    if (!document) return service.deleteProduct(id);
    await service.addOrUpdateProducts([document]);
  });
}

export async function rebuildPublicSearch(container: MedusaContainer): Promise<number> {
  return withSearchLock(container, async () => {
    const service: MeiliSearchService = container.resolve("meilisearch");
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    await service.configureIndex();
    // Remove legacy draft/deleted documents too, not only records present in today's database.
    await service.deleteAllProducts();
    let offset = 0, total = 0;
    while (true) {
      const { data = [] } = await query.graph({ entity: "product", fields: SEARCH_FIELDS,
        filters: { status: "published" }, pagination: { take: 100, skip: offset, order: { id: "ASC" } } });
      const documents = data.map(buildPublicDocument).filter((x: ProductDocument | null): x is ProductDocument => x !== null);
      await service.addOrUpdateProducts(documents);
      total += documents.length;
      if (data.length < 100) break;
      offset += data.length;
    }
    return total;
  });
}

/** Public responses must revalidate against Medusa; asynchronous search events are not an access boundary. */
export async function searchPublicProducts(container: MedusaContainer, q: string, salesChannelIds: string[]) {
  if (!salesChannelIds.length) return [];
  const service: MeiliSearchService = container.resolve("meilisearch");
  const ids = await service.searchProductIds(q);
  if (!ids.length) return [];
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data = [] } = await query.graph({ entity: "product", fields: [...SEARCH_FIELDS, "sales_channels.id"],
    filters: { id: ids, status: "published" } }, { cache: { enable: false } });
  const byId = new Map(data.filter((p: Record<string, any>) => p.status === "published" &&
    (p.sales_channels || []).some((c: { id: string }) => salesChannelIds.includes(c.id)))
    .map((p: Record<string, any>) => [p.id, p]));
  return ids.flatMap(id => {
    const product = byId.get(id) as Record<string, any> | undefined;
    const doc = product ? buildPublicDocument(product) : null;
    return doc ? [{ id: doc.id, title: doc.title, handle: doc.handle, thumbnail: doc.thumbnail, categories: doc.categories, category_ids: doc.category_ids }] : [];
  });
}
