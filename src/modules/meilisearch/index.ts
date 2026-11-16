import registerSearchStartup from "./loaders/startup";
import MeiliSearchService from "./service";
import { Module } from "@medusajs/framework/utils";

export const MEILISEARCH_MODULE = "meilisearch";

export default Module(MEILISEARCH_MODULE, {
  service: MeiliSearchService,
  loaders: [registerSearchStartup],
});
