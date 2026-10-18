/** Owner-approved web offer, 2026-10-18. This does not mutate the catalogue. */
export const APPROVED_VOGLIA_OFFER = {
  kind: "combo",
  brand: "Voglia",
  amount: 97,
  currency_code: "mxn",
  tax_inclusive: true,
  components: [
    { kind: "tinte", quantity: 1, declared_content: 90, unit: "ml" },
    { kind: "peroxido", quantity: 1, declared_content: 140, unit: "ml" },
  ],
  shipping_weight: null,
  mapping_status: "requires_inventory_and_tax_audit",
  production_changes_authorized: false,
} as const;
