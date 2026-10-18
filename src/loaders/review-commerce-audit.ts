import type { LoaderOptions } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { runReviewCommerceAudit } from "../lib/review-audit-runner";
import { collectReviewCommerceAudit } from "../scripts/audit-review-commerce";
export default async function reviewCommerceAuditLoader({ container }: LoaderOptions) {
  await runReviewCommerceAudit(process.env,
    async () => collectReviewCommerceAudit({ container } as Parameters<typeof collectReviewCommerceAudit>[0]),
    record => container.resolve(ContainerRegistrationKeys.LOGGER).info("SICARU_REVIEW_AUDIT " + JSON.stringify(record))
  );
}
