// Types inlined to avoid ESM import issues with meilisearch package
type MeiliSearchClient = {
  index<T extends Record<string, any> = Record<string, any>>(uid: string): MeiliIndex<T>;
  tasks: { waitForTask(task: number, options?: { timeout: number; interval: number }): Promise<{ status: string; error?: { code?: string } | null }> };
  createIndex(uid: string, options?: { primaryKey?: string }): Promise<any>;
};

type MeiliIndex<T extends Record<string, any> = Record<string, any>> = {
  addDocuments(documents: T[], options?: { primaryKey?: string }): Promise<any>;
  deleteDocument(documentId: string | number): Promise<any>;
  search(q: string, options: Record<string, unknown>): Promise<{ hits: { id: string }[] }>;
  deleteAllDocuments(): Promise<any>;
  updateSearchableAttributes(attributes: string[]): Promise<any>;
  updateFilterableAttributes(attributes: string[]): Promise<any>;
  updateSortableAttributes(attributes: string[]): Promise<any>;
  updateRankingRules(rules: string[]): Promise<any>;
  updateSynonyms(synonyms: Record<string, string[]>): Promise<any>;
  updateTypoTolerance(config: Record<string, any>): Promise<any>;
  updatePagination(config: Record<string, any>): Promise<any>;
};

type MeiliSearchModuleOptions = {
  host: string;
  apiKey: string;
};

export type ProductDocument = {
  id: string;
  status: "published";
  title: string;
  description: string | null;
  handle: string;
  thumbnail: string | null;
  collection_title: string | null;
  collection_id: string | null;
  categories: string[];
  category_ids: string[];
  price: number | null;
  currency_code: string | null;
  created_at: string;
  updated_at: string;
};

const INDEX_NAME = "products";

export default class MeiliSearchService {
  private clientPromise: Promise<MeiliSearchClient>;

  constructor(_: Record<string, unknown>, options: MeiliSearchModuleOptions) {
    this.clientPromise = import("meilisearch").then(
      ({ MeiliSearch }) =>
        new MeiliSearch({
          host: options.host,
          apiKey: options.apiKey,
        })
    );
  }

  private async getClient(): Promise<MeiliSearchClient> {
    return this.clientPromise;
  }

  private async getIndex(): Promise<MeiliIndex<ProductDocument>> {
    const client = await this.getClient();
    return client.index(INDEX_NAME);
  }

  private async complete(task: Promise<any>, ignoreCodes: string[] = []): Promise<void> {
    const queued = await task;
    const client = await this.getClient();
    const completed = await client.tasks.waitForTask(queued.taskUid, { timeout: 60000, interval: 25 });
    if (completed.status !== "succeeded" && !ignoreCodes.includes(completed.error?.code || "")) {
      throw new Error(`Search task failed: ${completed.error?.code || completed.status}`);
    }
  }

  async searchProductIds(q: string): Promise<string[]> {
    const index = await this.getIndex();
    const result = await index.search(q, { filter: 'status = "published"', limit: 100, attributesToRetrieve: ["id"] });
    return result.hits.map(hit => hit.id);
  }

  async configureIndex(): Promise<void> {
    const client = await this.getClient();

    // Create or update index
    await this.complete(client.createIndex(INDEX_NAME, { primaryKey: "id" }), ["index_already_exists"]);

    const index = await this.getIndex();

    // Searchable attributes — order determines relevance
    await this.complete(index.updateSearchableAttributes([
      "title",
      "description",
      "collection_title",
      "categories",
      "handle",
    ]));

    // Filterable attributes
    await this.complete(index.updateFilterableAttributes([
      "status",
      "categories",
      "category_ids",
      "collection_title",
      "collection_id",
      "price",
      "currency_code",
    ]));

    // Sortable attributes
    await this.complete(index.updateSortableAttributes(["price", "created_at", "title"]));

    // Ranking rules — default plus custom
    await this.complete(index.updateRankingRules([
      "words",
      "typo",
      "proximity",
      "attribute",
      "sort",
      "exactness",
    ]));

    // Synonyms for common Spanish beauty terms
    await this.complete(index.updateSynonyms({
      tinte: ["coloración", "color", "tintura"],
      shampoo: ["champú", "champu"],
      crema: ["cream"],
      cabello: ["pelo", "hair"],
      tratamiento: ["treatment"],
    }));

    // Typo tolerance — helps with accent-less searches
    await this.complete(index.updateTypoTolerance({
      enabled: true,
      minWordSizeForTypos: {
        oneTypo: 3,
        twoTypos: 6,
      },
    }));

    // Pagination
    await this.complete(index.updatePagination({ maxTotalHits: 1000 }));
  }

  async addOrUpdateProducts(documents: ProductDocument[]): Promise<void> {
    if (documents.length === 0) return;
    for (const document of documents) {
      if (document.status !== "published") await this.deleteProduct(document.id);
    }
    const published = documents.filter(document => document.status === "published");
    if (!published.length) return;
    const index = await this.getIndex();
    await this.complete(index.addDocuments(published, { primaryKey: "id" }));
  }

  async deleteProduct(productId: string): Promise<void> {
    const index = await this.getIndex();
    await this.complete(index.deleteDocument(productId), ["index_not_found"]);
  }

  async deleteAllProducts(): Promise<void> {
    const index = await this.getIndex();
    await this.complete(index.deleteAllDocuments(), ["index_not_found"]);
  }
}
