import type { ExecArgs, LoaderOptions } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import reviewCommerceAuditLoader from "../loaders/review-commerce-audit";
import prepareReviewCatalog from "./prepare-review-catalog";
export default async function runReviewStartupAudit(args: ExecArgs) {
  try { await prepareReviewCatalog(args); }
  catch { args.container.resolve(ContainerRegistrationKeys.LOGGER).error("SICARU_REVIEW_CATALOG setup blocked; inspect read-only audit. No readiness claim."); }
  await reviewCommerceAuditLoader({container:args.container} as LoaderOptions);
}
