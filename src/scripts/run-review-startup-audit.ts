import type { ExecArgs, LoaderOptions } from "@medusajs/framework/types";
import reviewCommerceAuditLoader from "../loaders/review-commerce-audit";

// Medusa 2 does not load application src/loaders automatically. Run the existing
// read-only collector through the supported exec container, only when opted in.
export default async function runReviewStartupAudit({ container }: ExecArgs) {
  await reviewCommerceAuditLoader({ container } as LoaderOptions);
}
