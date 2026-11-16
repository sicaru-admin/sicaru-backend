import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { assertReviewDataBindings } from "../lib/review-isolation";

// Read-only, explicitly executed inside preview-payments. Never seed or adjust stock here.
export async function collectReviewCommerceAudit({ container }: ExecArgs) {
  const isolation = assertReviewDataBindings(process.env);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const inventory = container.resolve(Modules.INVENTORY);
  const pricing = container.resolve(Modules.PRICING);
  const tax = container.resolve(Modules.TAX);
  async function pages<T>(read: (skip: number) => Promise<T[]>) {
    const rows: T[] = [];
    for (let skip = 0; skip < 5000; skip += 100) {
      const batch = await read(skip); rows.push(...batch);
      if (batch.length < 100) return rows;
    }
    throw new Error("Audit page limit reached");
  }
  const unavailable: string[] = [];
  async function section<T>(name: string, read: () => Promise<T>) {
    try { return await read(); } catch { unavailable.push(name); return null; }
  }
  const variants = await section("variants-and-inventory-links", async () => (await query.graph({
    entity: "product",
    fields: ["id", "title", "variants.id", "variants.sku", "variants.title",
      "variants.manage_inventory", "variants.allow_backorder",
      "variants.inventory_items.inventory_item_id", "variants.inventory_items.required_quantity",
      "variants.price_set.prices.id", "variants.price_set.prices.amount", "variants.price_set.prices.currency_code"],
  })).data);
  const locations = await section("stock-location-sales-channels", async () => (await query.graph({
    entity: "stock_location", fields: ["id", "name", "sales_channels.id", "sales_channels.name"],
  })).data);
  const inventoryItems = await section("inventory-items", async () => (await pages(skip => inventory.listInventoryItems({}, {skip, take: 100}))).map(item => ({
    id: item.id, sku: item.sku, title: item.title,
  })));
  const regions = await section("regions", async () => (await query.graph({
    entity: "region", fields: ["id", "name", "currency_code"],
  })).data);
  const taxRegions = await section("tax-regions", async () => (await pages(skip => tax.listTaxRegions({}, {skip, take: 100}))).map(region => ({
    id: region.id, country_code: region.country_code, province_code: region.province_code,
  })));
  const levels = await section("inventory-levels", async () => (await pages(skip => inventory.listInventoryLevels({}, {skip, take: 100}))).map(level => ({
    inventory_item_id: level.inventory_item_id, location_id: level.location_id,
    stocked_quantity: level.stocked_quantity, reserved_quantity: level.reserved_quantity,
    available_quantity: level.available_quantity,
  })));
  const reservations = await section("reservations", async () => (await pages(skip => inventory.listReservationItems({}, {skip, take: 100}))).map(item => ({
    id: item.id, inventory_item_id: item.inventory_item_id, location_id: item.location_id,
    quantity: item.quantity, line_item_id: item.line_item_id,
  })));
  const preferences = await section("price-preferences", async () => (await pages(skip => pricing.listPricePreferences({}, {skip, take: 100}))).map(preference => ({
    id: preference.id, attribute: preference.attribute, value: preference.value, is_tax_inclusive: preference.is_tax_inclusive,
  })));
  const taxRates = await section("tax-rates", async () => (await pages(skip => tax.listTaxRates({}, {skip, take: 100}))).map(rate => ({
    id: rate.id, tax_region_id: rate.tax_region_id, name: rate.name, code: rate.code, rate: rate.rate,
  })));
  return {
    audited_at: new Date().toISOString(), mode: "read-only", isolation,
    payments: {
      sandbox: process.env.MERCADOPAGO_SANDBOX === "true",
      testAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN?.startsWith("TEST-") === true,
      testPublicKey: process.env.MERCADOPAGO_PUBLIC_KEY?.startsWith("TEST-") === true,
    },
    variants, locations, inventory_items: inventoryItems, regions, tax_regions: taxRegions, levels, reservations, price_preferences: preferences, tax_rates: taxRates, unavailable,
    commercial_price_changes: false, inventory_changes: false, payment_requests: false,
  };
}

export default async function auditReviewCommerce(args: ExecArgs) {
  console.log(JSON.stringify(await collectReviewCommerceAudit(args), null, 2));
}

