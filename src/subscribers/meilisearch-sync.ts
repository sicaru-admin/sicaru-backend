import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type MeiliSearchService from "../modules/meilisearch/service";
import type { ProductDocument } from "../modules/meilisearch/service";
import { MEILISEARCH_MODULE } from "../modules/meilisearch";

function buildProductDocument(product: Record<string, any>): ProductDocument {
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

export default async function meiliSearchSyncHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const meiliSearch: MeiliSearchService = container.resolve(MEILISEARCH_MODULE);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const productId = event.data.id;

  if (event.name.includes("deleted")) {
    await meiliSearch.deleteProduct(productId);
    return;
  }

  // created or updated — fetch full product via query graph
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
    filters: { id: productId },
  });

  const product = products?.[0];
  if (!product) return;

  const document = buildProductDocument(product);
  await meiliSearch.addOrUpdateProducts([document]);
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated", "product.deleted"],
};
