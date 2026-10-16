import type { ExecArgs } from "@medusajs/framework/types";
import { readDhlPolicy } from "../lib/dhl-checkout";

// Read-only proposal. No options, prices, rules, products or labels are changed.
export default async function prepareDhlOptions(_args: ExecArgs) {
  console.log(JSON.stringify({
    apply: false,
    activation: readDhlPolicy()?.enabled === true ? "requires_verified_audit" : "blocked_pending_evidence",
    service_zone_id: null,
    shipping_profile_id: null,
    notes: [
      "Obtener IDs reales de la auditoría; no crear cobertura nacional genérica.",
      "Confirmar IVA y recargos antes de activar; is_tax_inclusive solo se aprueba tras confirmación.",
      "Deshabilitar enabled_in_store del envío local anterior y revisar promociones de envío.",
      "Registrar los cuatro IDs de opciones creadas en el archivo de política verificado.",
      "Las cuatro opciones usan cumplimiento manual; no hay conexión automática a DHL ni creación de guías.",
    ],
    options: [
      ["standard_1_2", "DHL 1–2 kg", 214],
      ["standard_2_5", "DHL más de 2 hasta 5 kg", 270],
      ["remote_1_2", "DHL 1–2 kg, zona remota validada", 332],
      ["remote_2_5", "DHL más de 2 hasta 5 kg, zona remota validada", 388],
    ].map(([key, name, amount]) => ({
      key, name, price_type: "flat", provider_id: "manual_manual",
      service_zone_id: null, shipping_profile_id: null,
      type: { code: key, label: name, description: "DHL, tarifa manual provisional" },
      prices: [{ currency_code: "mxn", amount }],
      rules: [
        { attribute: "enabled_in_store", operator: "eq", value: "false" },
        { attribute: "is_return", operator: "eq", value: "false" },
      ],
    })),
  }, null, 2));
}
