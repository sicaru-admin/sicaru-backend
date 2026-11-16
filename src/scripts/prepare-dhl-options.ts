import type { ExecArgs } from "@medusajs/framework/types";

// Read-only, unpriced template. Provisional $214/$270/$118 references are not
// commercial approvals and must never become executable price proposals.
export default async function prepareDhlOptions(_args: ExecArgs) {
  console.log(JSON.stringify({
    apply: false,
    activation: "blocked_pending_commercial_approval",
    service_zone_id: null,
    shipping_profile_id: null,
    notes: [
      "Obtener tarifas comerciales aprobadas y vigentes, IVA y recargos confirmados.",
      "Validar pesos, empaque y cobertura exacta antes de configurar opciones.",
      "Retirar métodos y promociones locales con un cambio revisado; los controles del checkout ya los rechazan.",
      "No crear cobertura nacional genérica ni guías; no usar importes provisionales.",
    ],
    options: [
      ["standard_1_2", "DHL 1–2 kg"],
      ["standard_2_5", "DHL más de 2 hasta 5 kg"],
      ["remote_1_2", "DHL 1–2 kg, zona remota validada"],
      ["remote_2_5", "DHL más de 2 hasta 5 kg, zona remota validada"],
    ].map(([key, name]) => ({
      key, name, price_type: "flat", provider_id: "manual_manual",
      approval_status: "pending", service_zone_id: null, shipping_profile_id: null,
      prices: [],
      rules: [
        { attribute: "enabled_in_store", operator: "eq", value: "false" },
        { attribute: "is_return", operator: "eq", value: "false" },
      ],
    })),
  }, null, 2));
}
