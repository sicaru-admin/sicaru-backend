import assert from "node:assert/strict";
import {test} from "node:test";
import {quoteDhl} from "../src/lib/dhl-policy.ts";
import {fixture} from "./dhl-fixtures.mjs";
test("provisional manual rates stay unpayable even with physical and coverage evidence", () => {
  for (const accountConfirmed of [false, true]) {
    const { policy, cart, now } = fixture(1000);
    policy.terms.accountConfirmed = accountConfirmed;
    policy.terms.pricingMode = "provisional_manual";
    policy.commercialApproval.ratesMxn = {
      oneToTwoKg: 214, overTwoToFiveKg: 270, validatedExtendedAreaSurcharge: 118,
    };
    assert.deepEqual(quoteDhl(policy, cart, now), {
      status: "quote_required", reason: "tariff_unconfirmed", message: "Envío por cotizar",
    });
  }
});
