import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type MeiliSearchService from "../modules/meilisearch/service";
import type { ProductDocument } from "../modules/meilisearch/service";
import { MEILISEARCH_MODULE } from "../modules/meilisearch";

const BATCH_SIZE = 100;

function buildDocument(product: Record<string, any>): ProductDocument {
  let lowestPrice: number | null = null;
  let currencyCode: string | null = null;

  if (product.variants) {
    for (const variant of product.variants) {
      const prices = variant.prices || variant.price_set?.prices || [];
      for (const price of prices) {
        if (lowestPrice === null || price.amount < lowestPrice) {
          lowestPrice = price.amount;
          currencyCode = price.currency_code || "mxn";
        }
      }
    }
  }

  return {
    id: product.id,
    title: product.title || "",
    description: product.description || null,
    handle: product.handle || "",
    thumbnail: product.thumbnail || null,
    collection_title: product.collection?.title || null,
    collection_id: product.collection_id || null,
    categories: (product.categories || []).map(
      (c: Record<string, any>) => c.name
    ),
    category_ids: (product.categories || []).map(
      (c: Record<string, any>) => c.id
    ),
    price: lowestPrice,
    currency_code: currencyCode,
    created_at: product.created_at
      ? new Date(product.created_at).toISOString()
      : new Date().toISOString(),
    updated_at: product.updated_at
      ? new Date(product.updated_at).toISOString()
      : new Date().toISOString(),
  };
}

export default async function meiliSearchLoader(container: MedusaContainer) {
  const meiliSearch: MeiliSearchService = container.resolve(MEILISEARCH_MODULE);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  try {
    console.log("[MeiliSearch] Configuring index settings...");
    await meiliSearch.configureIndex();

    console.log("[MeiliSearch] Starting full product sync on startup...");

    let offset = 0;
    let totalSynced = 0;

    while (true) {
      const { data: products } = await query.graph({
        entity: "product",
        fields: [
          "id",
          "title",
          "description",
          "handle",
          "thumbnail",
          "collection.*",
          "categories.*",
          "variants.*",
          "variants.prices.*",
          "created_at",
          "updated_at",
        ],
        pagination: {
          take: BATCH_SIZE,
          skip: offset,
        },
      });

      if (!products || products.length === 0) break;

      const documents: ProductDocument[] = products.map(buildDocument);
      await meiliSearch.addOrUpdateProducts(documents);
      totalSynced += documents.length;
      offset += BATCH_SIZE;

      if (products.length < BATCH_SIZE) break;
    }

    console.log(
      `[MeiliSearch] Startup sync complete. ${totalSynced} products indexed.`
    );
  } catch (error) {
    console.error(
      "[MeiliSearch] Failed to sync on startup. Is MeiliSearch running?",
      error
    );
  }
}
