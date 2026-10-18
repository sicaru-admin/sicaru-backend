import type { ExecArgs, LoaderOptions } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import reviewCommerceAuditLoader from "../loaders/review-commerce-audit";
import prepareReviewCatalog from "./prepare-review-catalog";
import prepareReviewShipping from "./prepare-review-shipping";
export default async function runReviewStartupAudit(args: ExecArgs) {
  try { await prepareReviewCatalog(args); }
  catch { args.container.resolve(ContainerRegistrationKeys.LOGGER).error("SICARU_REVIEW_CATALOG setup blocked; inspect read-only audit. No readiness claim."); }
  try { await prepareReviewShipping(args); }
  catch { args.container.resolve(ContainerRegistrationKeys.LOGGER).error("SICARU_REVIEW_SHIPPING setup blocked; shipping stays unavailable. No readiness claim."); }
  await reviewCommerceAuditLoader({container:args.container} as LoaderOptions);
}
