import type { MedusaContainer } from "@medusajs/framework/types";
import type { ReviewCart, ReviewEnvironment } from "./review-shipping-policy";

// Historical $214 test shipping is suspended alongside all unapproved rates.
// Keep these entry points closed even when an old preview opt-in remains set.
export async function getReviewShippingCheckout(_container: MedusaContainer, _cart: ReviewCart & { id: string }) {
  return {
    quote: { status: "quote_required" as const, reason: "review_shipping_suspended", message: "Envío por cotizar" },
    shippingOption: null,
  };
}
export async function verifyReviewPaymentAccess(_env: ReviewEnvironment): Promise<never> {
  throw new Error("Envío por cotizar");
}
export async function verifyReviewShippingPayment(_cart: ReviewCart): Promise<never> {
  throw new Error("Envío por cotizar");
}
