// Types inlined to avoid ESM import issues with meilisearch package
type MeiliSearchClient = {
  index<T extends Record<string, any> = Record<string, any>>(uid: string): MeiliIndex<T>;
  createIndex(uid: string, options?: { primaryKey?: string }): Promise<any>;
};

type MeiliIndex<T extends Record<string, any> = Record<string, any>> = {
  addDocuments(documents: T[], options?: { primaryKey?: string }): Promise<any>;
  deleteDocument(documentId: string | number): Promise<any>;
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

  async configureIndex(): Promise<void> {
    const client = await this.getClient();

    // Create or update index
    await client.createIndex(INDEX_NAME, { primaryKey: "id" });

    const index = await this.getIndex();

    // Searchable attributes — order determines relevance
    await index.updateSearchableAttributes([
      "title",
      "description",
      "collection_title",
      "categories",
      "handle",
    ]);

    // Filterable attributes
    await index.updateFilterableAttributes([
      "categories",
      "category_ids",
      "collection_title",
      "collection_id",
      "price",
      "currency_code",
    ]);

    // Sortable attributes
    await index.updateSortableAttributes(["price", "created_at", "title"]);

    // Ranking rules — default plus custom
    await index.updateRankingRules([
      "words",
      "typo",
      "proximity",
      "attribute",
      "sort",
      "exactness",
    ]);

    // Synonyms for common Spanish beauty terms
    await index.updateSynonyms({
      tinte: ["coloración", "color", "tintura"],
      shampoo: ["champú", "champu"],
      crema: ["cream"],
      cabello: ["pelo", "hair"],
      tratamiento: ["treatment"],
    });

    // Typo tolerance — helps with accent-less searches
    await index.updateTypoTolerance({
      enabled: true,
      minWordSizeForTypos: {
        oneTypo: 3,
        twoTypos: 6,
      },
    });

    // Pagination
    await index.updatePagination({ maxTotalHits: 1000 });
  }

  async addOrUpdateProducts(documents: ProductDocument[]): Promise<void> {
    if (documents.length === 0) return;
    const index = await this.getIndex();
    await index.addDocuments(documents, { primaryKey: "id" });
  }

  async deleteProduct(productId: string): Promise<void> {
    const index = await this.getIndex();
    await index.deleteDocument(productId);
  }

  async deleteAllProducts(): Promise<void> {
    const index = await this.getIndex();
    await index.deleteAllDocuments();
  }
}
