import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { quoteDhl, assertSelectedDhl, cartSignature } from "../src/lib/dhl-policy.ts";
import { fixture } from "./dhl-fixtures.mjs";

for (const [grams, expected] of [[1000, 214], [1999, 214], [2000, 214], [2001, 270], [4999, 270], [5000, 270]]) {
  test(`confirmed billable weight ${grams} g costs ${expected} MXN`, () => {
    const { policy, cart, now } = fixture(grams);
    const quote = quoteDhl(policy, cart, now);
    assert.equal(quote.status, "available");
    assert.equal(quote.amount, expected);
    assert.equal(quote.actual_weight_g, grams);
  });
}
for (const [grams, reason] of [[999, "below_1kg"], [5001, "above_5kg"]]) {
  test(`${grams} g routes to WhatsApp without a shipping amount`, () => {
    const { policy, cart, now } = fixture(grams);
    const quote = quoteDhl(policy, cart, now);
    assert.equal(quote.reason, reason);
    assert.equal("amount" in quote, false);
  });
}
test("the checked-in policy is disabled and cannot quote a price", () => {
  const policy = JSON.parse(readFileSync(new URL("../config/dhl-provisional.json", import.meta.url)));
  assert.equal(policy.enabled, false);
  assert.equal(quoteDhl(policy, fixture().cart).reason, "tariff_unconfirmed");
});
test("unknown weight, ml content or a demo weight never supplies a measured weight", () => {
  const { policy, cart, now } = fixture();
  delete policy.variants.variant_test;
  Object.assign(cart.items[0], { weight: 400, title: "1000 ml" });
  assert.equal(quoteDhl(policy, cart, now).reason, "weight_unknown");
});
test("weight must include the primary container and have real evidence", () => {
  for (const edit of [{ includesPrimaryPackaging: false }, { unitWeightGrams: 0 }, { unitWeightGrams: -1 }, { source: "" }]) {
    const { policy, cart, now } = fixture();
    Object.assign(policy.variants.variant_test, edit);
    assert.equal(quoteDhl(policy, cart, now).reason, "weight_unknown");
  }
});
test("packaging tare is included and an unverified package blocks checkout", () => {
  const { policy, cart, now } = fixture(2000);
  policy.packages["variant_test:1"].tareGrams = 101;
  assert.equal(quoteDhl(policy, cart, now).amount, 270);
  delete policy.packages["variant_test:1"];
  assert.equal(quoteDhl(policy, cart, now).reason, "packaging_unknown");
});
test("quantities are multiplied and a changed basket needs checked packaging", () => {
  const { policy, cart, now } = fixture(1100);
  cart.items[0].quantity = 2;
  assert.equal(quoteDhl(policy, cart, now).reason, "packaging_unknown");
  policy.packages["variant_test:2"] = policy.packages["variant_test:1"];
  assert.equal(quoteDhl(policy, cart, now).amount, 270);
  assert.equal(quoteDhl(policy, cart, now).actual_weight_g, 2100);
});
test("packing signatures aggregate duplicate variants and ignore item order", () => {
  assert.equal(cartSignature([
    { variant_id: "b", quantity: 1 }, { variant_id: "a", quantity: 2 },
    { variant_id: "b", quantity: 2 },
  ]), "a:2|b:3");
  for (const items of [[], [{ quantity: 1 }], [{ variant_id: "a", quantity: 0 }], [{ variant_id: "a", quantity: 1.5 }]]) {
    assert.equal(cartSignature(items), null);
  }
});
test("volumetric applicability and divisor are never assumed", () => {
  const { policy, cart, now } = fixture();
  policy.terms.volumetricMode = null;
  assert.equal(quoteDhl(policy, cart, now).reason, "volumetric_unknown");
  policy.terms.volumetricMode = "max_actual_volumetric";
  policy.packages["variant_test:1"].externalDimensionsCm = [30, 30, 30];
  assert.equal(quoteDhl(policy, cart, now).reason, "volumetric_unknown");
  policy.terms.volumetricDivisor = 6000; // Test-only contract, not a DHL default.
  const quote = quoteDhl(policy, cart, now);
  assert.equal(quote.billable_weight_g, 4500);
  assert.equal(quote.amount, 270);
});
test("volumetric weight over 5kg requires a WhatsApp quote", () => {
  const { policy, cart, now } = fixture();
  policy.terms.volumetricMode = "max_actual_volumetric";
  policy.terms.volumetricDivisor = 6000;
  policy.packages["variant_test:1"].externalDimensionsCm = [40, 40, 40];
  assert.equal(quoteDhl(policy, cart, now).reason, "above_5kg");
});
test("only a confirmed rounding rule changes the billable weight", () => {
  const { policy, cart, now } = fixture(2001);
  policy.terms.roundingIncrementGrams = null;
  assert.equal(quoteDhl(policy, cart, now).reason, "tariff_unconfirmed");
  policy.terms.roundingIncrementGrams = 1000;
  assert.equal(quoteDhl(policy, cart, now).billable_weight_g, 3000);
});
test("a sub-1kg package is not rounded up into an unapproved minimum", () => {
  const { policy, cart, now } = fixture(999);
  policy.terms.roundingIncrementGrams = 1000;
  assert.equal(quoteDhl(policy, cart, now).reason, "below_1kg");
});
for (const [grams, expected] of [[1000, 332], [5000, 388]]) {
  test(`verified remote destination at ${grams} g adds exactly 118 MXN`, () => {
    const { policy, cart, now } = fixture(grams);
    policy.coverage["01000"].remoteArea = true;
    const quote = quoteDhl(policy, cart, now);
    assert.equal(quote.amount, expected);
    assert.equal(quote.remote_surcharge, 118);
  });
}
test("unknown remote status does not silently apply or omit a surcharge", () => {
  const { policy, cart, now } = fixture();
  policy.coverage["01000"].remoteArea = null;
  const quote = quoteDhl(policy, cart, now);
  assert.equal(quote.reason, "coverage_unknown");
  assert.equal("amount" in quote, false);
});
test("postal prefixes, expired lists and another service do not prove coverage", () => {
  for (const edit of [
    { source: "" }, { validUntil: "2020-01-01T00:00:00Z" },
    { serviceCode: "ANOTHER_SERVICE" }, { originPostalCode: "99999" },
  ]) {
    const { policy, cart, now } = fixture();
    Object.assign(policy.coverage["01000"], edit);
    assert.equal(quoteDhl(policy, cart, now).reason, "coverage_unknown");
  }
  const { policy, cart, now } = fixture();
  cart.shipping_address.postal_code = "01001";
  assert.equal(quoteDhl(policy, cart, now).reason, "coverage_unknown");
});
test("a verified unavailable destination and a foreign country are not payable", () => {
  const { policy, cart, now } = fixture();
  policy.coverage["01000"].available = false;
  assert.equal(quoteDhl(policy, cart, now).reason, "no_coverage");
  cart.shipping_address.country_code = "us";
  assert.equal(quoteDhl(policy, cart, now).reason, "coverage_unknown");
});
test("account, validity, taxes and surcharges must be confirmed before payment", () => {
  for (const edit of [
    { accountConfirmed: false }, { validUntil: "2020-01-01T00:00:00Z" },
    { taxInclusive: null }, { allSurchargesConfirmed: false },
  ]) {
    const { policy, cart, now } = fixture();
    Object.assign(policy.terms, edit);
    assert.equal(quoteDhl(policy, cart, now).reason, "tariff_unconfirmed");
  }
});
test("a missing or ambiguous Medusa option ID has no payable quote", () => {
  const { policy, cart, now } = fixture();
  policy.optionIds.standard_1_2 = null;
  assert.equal(quoteDhl(policy, cart, now).reason, "service_unconfigured");
  policy.optionIds.standard_1_2 = policy.optionIds.standard_2_5;
  assert.equal(quoteDhl(policy, cart, now).reason, "service_unconfigured");
});
test("an old local $49 option cannot be retained or mixed into checkout", () => {
  const { policy, cart, now } = fixture();
  const quote = quoteDhl(policy, cart, now);
  for (const methods of [
    [{ shipping_option_id: "local_old", amount: 49, is_tax_inclusive: true }],
    [{ shipping_option_id: "dhl_small_test", amount: 49, is_tax_inclusive: true }],
    [...cart.shipping_methods, { shipping_option_id: "local_old", amount: 49 }],
  ]) {
    assert.throws(() => assertSelectedDhl({ ...cart, shipping_methods: methods }, quote), /Actualiza/);
  }
});
test("the total includes DHL without altering product prices", () => {
  const { policy, cart, now } = fixture();
  const before = structuredClone(cart);
  const quote = quoteDhl(policy, cart, now);
  assert.doesNotThrow(() => assertSelectedDhl(cart, quote));
  assert.equal(cart.total, 300 + 214);
  assert.deepEqual(cart, before);
  for (const edit of [{ shipping_total: 0 }, { shipping_total: 248.24 }, { total: 200 }]) {
    assert.throws(() => assertSelectedDhl({ ...cart, ...edit }, quote), /Actualiza/);
  }
});
