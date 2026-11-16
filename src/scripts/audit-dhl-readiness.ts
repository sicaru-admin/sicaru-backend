import { writeFileSync } from "node:fs";
import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export default async function auditDhl({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const warnings: string[] = [];
  async function all(entity: string, fields: string[]) {
    const result: Record<string, unknown>[] = [];
    for (let skip = 0; ; skip += 100) {
      const { data } = await query.graph({
        entity, fields, pagination: { skip, take: 100 },
      });
      result.push(...data);
      if (data.length < 100) return result;
    }
  }
  const products = await all("product", [
    "id", "title", "weight", "length", "width", "height", "metadata",
    "variants.id", "variants.sku", "variants.title", "variants.weight",
    "variants.length", "variants.width", "variants.height", "variants.metadata",
  ]);
  const options = await all("shipping_option", [
    "*", "rules.*", "prices.*", "prices.price_rules.*", "service_zone.*", "service_zone.geo_zones.*",
  ]);
  const profiles = await all("shipping_profile", ["*"]);
  const locations = await all("stock_location", ["id", "name", "address.*"]);
  let priceRules: Record<string, unknown>[] = [];
  try {
    priceRules = await all("price_rule", ["*"]);
  } catch {
    warnings.push("No se pudieron consultar reglas de precio; revisarlas en Medusa antes de aplicar tarifas.");
  }
  const report = {
    inspected_at: new Date().toISOString(),
    unit_status: "Las unidades y la procedencia de los pesos deben verificarse; no se infieren desde ml.",
    products, shipping_options: options, shipping_profiles: profiles,
    stock_locations: locations, price_rules: priceRules, warnings,
    weight_audit: products.flatMap((product) => {
      const variants = (product.variants ?? []) as Record<string, unknown>[];
      return variants.map((variant) => ({
        product_id: product.id, product_title: product.title,
        variant_id: variant.id, sku: variant.sku,
        product_weight_raw: product.weight, variant_weight_raw: variant.weight,
        unit: "not_confirmed",
        status: Number(variant.weight) > 0 || Number(product.weight) > 0
          ? "requires_measurement_and_unit_verification" : "missing_or_nonpositive",
        primary_packaging_included: "not_confirmed",
        transport_packaging: "not_confirmed",
        matches_demo_400_value: product.weight === 400 || variant.weight === 400,
      }));
    }),
  };
  if (process.env.DHL_AUDIT_OUTPUT) {
    writeFileSync(process.env.DHL_AUDIT_OUTPUT, JSON.stringify(report, null, 2), { mode: 0o600 });
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
}
