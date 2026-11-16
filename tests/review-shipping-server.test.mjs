import assert from "node:assert/strict";
import { test, after } from "node:test";
import { registerHooks } from "node:module";
const hook = registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return next(new URL(specifier + ".ts", context.parentURL).href, context);
  return next(specifier, context);
} });
const { getReviewShippingCheckout, verifyReviewShippingPayment, verifyReviewPaymentAccess } = await import("../src/lib/review-shipping.ts");
const { default: prepareReviewShipping } = await import("../src/scripts/prepare-review-shipping.ts");
hook.deregister();
const prior = process.env.SICARU_REVIEW_SHIPPING;
const oldFetch = globalThis.fetch;
after(() => { if (prior === undefined) delete process.env.SICARU_REVIEW_SHIPPING; else process.env.SICARU_REVIEW_SHIPPING = prior; globalThis.fetch = oldFetch; });
const noServices = { resolve() { throw new Error("Suspended shipping must not resolve services or write data"); } };
const cart = { id: "cart_review", items: [{ variant_id: "SICARU-TEST-COMBO-VOGLIA-1", quantity: 1 }] };
test("the old preview opt-in never exposes a $214 shipping quote", async () => {
  globalThis.fetch = () => { throw new Error("No payment or carrier requests allowed"); };
  for (const activation of [undefined, "review-shipping-214-v1"]) {
    if (activation) process.env.SICARU_REVIEW_SHIPPING = activation; else delete process.env.SICARU_REVIEW_SHIPPING;
    const state = await getReviewShippingCheckout(noServices, cart);
    assert.equal(state.quote.status, "quote_required");
    assert.equal(state.quote.message, "Envío por cotizar");
    assert.equal(state.shippingOption, null);
    assert.equal("amount" in state.quote, false);
  }
});
test("review startup cannot recreate or enable a provisional option", async () => {
  process.env.SICARU_REVIEW_SHIPPING = "review-shipping-214-v1";
  await prepareReviewShipping({ container: noServices });
});
test("historical review payment entry points stay closed without external calls", async () => {
  await assert.rejects(verifyReviewPaymentAccess(process.env), /Envío por cotizar/);
  await assert.rejects(verifyReviewShippingPayment(cart), /Envío por cotizar/);
});
