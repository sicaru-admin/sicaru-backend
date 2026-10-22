import type { ExecArgs } from "@medusajs/framework/types";

// Retained for the existing startup entry point. The former test opt-in no
// longer creates or enables a $214 option, fulfillment set or service zone.
export default async function prepareReviewShipping(_args: ExecArgs) {
  return;
}
