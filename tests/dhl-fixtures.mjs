// Synthetic evidence for tests only. None of these entries is production data.
export function fixture(grossGrams = 1000) {
  const now = Date.now();
  const evidence = { source: "TEST ONLY: verified fixture", verifiedAt: new Date(now - 1000).toISOString() };
  const policy = {
    schemaVersion: 1, enabled: true, revision: "test",
    terms: {
      ...evidence, accountConfirmed: true, serviceCode: "TEST_DHL_SERVICE",
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
    optionIds: {
      standard_1_2: "dhl_small_test", standard_2_5: "dhl_large_test",
      remote_1_2: "dhl_remote_small_test", remote_2_5: "dhl_remote_large_test",
    },
  };
  const cart = {
    id: "cart_test", currency_code: "mxn",
    items: [{ variant_id: "variant_test", quantity: 1 }],
    shipping_address: { country_code: "mx", postal_code: "01000" },
    shipping_methods: [{ shipping_option_id: "dhl_small_test", amount: 214, is_tax_inclusive: true }],
    shipping_total: 214, total: 514,
  };
  return { policy, cart, now };
}
