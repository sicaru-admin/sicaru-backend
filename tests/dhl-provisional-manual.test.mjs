import assert from "node:assert/strict";
import {test} from "node:test";
import {quoteDhl} from "../src/lib/dhl-policy.ts";
import {fixture} from "./dhl-fixtures.mjs";
test("a provisional manual tariff does not require activating a carrier account, but still requires all physical and coverage evidence",()=>{
  const {policy,cart,now}=fixture(1000);policy.terms.accountConfirmed=false;
  assert.equal(quoteDhl(policy,cart,now).reason,"tariff_unconfirmed");
  policy.terms.pricingMode="provisional_manual";assert.equal(quoteDhl(policy,cart,now).amount,214);assert.equal(policy.terms.accountConfirmed,false);
  delete policy.variants.variant_test;assert.equal(quoteDhl(policy,cart,now).reason,"weight_unknown");
});
