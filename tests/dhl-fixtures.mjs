import { quoteDhl } from "../src/lib/dhl-policy.ts";
// Synthetic evidence for tests only. None of these entries is production data.
export function fixture(grossGrams = 1000) {
  const now = Date.now();
  const evidence = { source: "TEST ONLY: verified fixture", verifiedAt: new Date(now - 1000).toISOString() };
  const policy = {
    schemaVersion: 1, enabled: true, revision: "test",
    terms: {
      ...evidence, accountConfirmed: true, pricingMode: "negotiated_account", serviceCode: "TEST_DHL_SERVICE",
      originPostalCode: "67480", validUntil: new Date(now + 86400000).toISOString(),
      taxInclusive: true, allSurchargesConfirmed: true,
      volumetricMode: "actual_only", volumetricDivisor: null, roundingIncrementGrams: 1,
    },
    variants: { variant_test: { ...evidence, unitWeightGrams: grossGrams - 100, includesPrimaryPackaging: true } },
    packages: { "variant_test:1": { ...evidence, tareGrams: 100, externalDimensionsCm: null } },
    coverage: {
      "01000": { ...evidence, available: true, remoteArea: false,
        validUntil: new Date(now + 86400000).toISOString(),
        serviceCode: "TEST_DHL_SERVICE", originPostalCode: "67480" },
    },
    commercialApproval: { ...evidence, status: "approved", provisional: false, carrierContractActivated: true,
      validUntil: new Date(now + 86400000).toISOString(),
      ratesMxn: { oneToTwoKg: 187.65, overTwoToFiveKg: 249.9, validatedExtendedAreaSurcharge: 63.4 } },
    optionIds: {
      standard_1_2: "dhl_small_test", standard_2_5: "dhl_large_test",
      remote_1_2: "dhl_remote_small_test", remote_2_5: "dhl_remote_large_test",
    },
  };
  const cart = {
    id: "cart_test", email: "review@example.invalid", currency_code: "mxn",
    items: [{ variant_id: "variant_test", quantity: 1 }],
    shipping_address: { country_code: "mx", postal_code: "01000", first_name: "Prueba", last_name: "Sicaru", address_1: "Domicilio de prueba", city: "Ciudad de prueba", province: "NL", phone: "0000000000" },
    shipping_methods: [{ shipping_option_id: "dhl_small_test", amount: 187.65, is_tax_inclusive: true }],
    shipping_total: 187.65, shipping_discount_total: 0, item_total: 300, total: 487.65,
  };
  const quote = quoteDhl(policy, cart, now);
  cart.shipping_methods[0].data = { sicaru_quote_id: quote.quote_id, sicaru_quote_fingerprint: quote.fingerprint };
  return { policy, cart, now };
}
