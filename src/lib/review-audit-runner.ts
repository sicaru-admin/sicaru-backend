import { assertReviewDataBindings } from "./review-isolation";
import { APPROVED_VOGLIA_OFFER } from "./approved-voglia-offer";
type Env = Record<string, string | undefined>;
type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const rows = (value: unknown) => Array.isArray(value) ? value.map(row) : [];
const pick = (value: unknown, keys: string[]) => Object.fromEntries(keys.filter(key => key in row(value)).map(key => [key, row(value)[key]]));
export function formatReviewCommerceRecords(report: Row): Row[] {
  const output: Row[] = [{section:"start", audited_at:report.audited_at, approved_offer:APPROVED_VOGLIA_OFFER,
    isolation:pick(report.isolation,["project","environment","service","databaseBinding","redisBinding"]),
    payments:pick(report.payments,["sandbox","testAccessToken","testPublicKey"])}];
  for (const product of rows(report.variants)) for (const variant of rows(product.variants)) {
    output.push({section:"variant", product_id:product.id, product_title:product.title,
      ...pick(variant,["id","sku","title","manage_inventory","allow_backorder"]),
      inventory_items:rows(variant.inventory_items).map(item=>pick(item,["inventory_item_id","required_quantity"])),
      prices:rows(row(variant.price_set).prices).map(price=>pick(price,["id","currency_code","amount"])),
    });
  }
  for (const [section, keys] of Object.entries({
    locations:["id","name"], inventory_items:["id","sku","title"], regions:["id","name","currency_code"], tax_regions:["id","country_code","province_code"], levels:["inventory_item_id","location_id","stocked_quantity","reserved_quantity","available_quantity"],
    reservations:["id","inventory_item_id","location_id","quantity","line_item_id"],
    price_preferences:["id","attribute","value","is_tax_inclusive"], tax_rates:["id","tax_region_id","name","code","rate"],
  })) for (const item of rows(report[section])) {
    output.push({section,...pick(item,keys),...(section==="locations" ? {sales_channels:rows(item.sales_channels).map(channel=>pick(channel,["id","name"]))} : {})});
  }
  const unavailable = Array.isArray(report.unavailable) ? report.unavailable.filter(value=>typeof value==="string") : ["invalid-report"];
  output.push({section:"finished", complete:unavailable.length===0, unavailable, data_changes:false, payment_requests:false});
  return output;
}
export async function runReviewCommerceAudit(
  env: Env,
  read: () => Promise<Row>,
  emit: (record: Row) => void
) {
  if (env.RAILWAY_ENVIRONMENT_ID !== "a04c43a9-03ec-44ff-8486-f64524c1cc8f" || env.SICARU_REVIEW_AUDIT_ON_START !== "true") return "skipped";
  try {
    assertReviewDataBindings(env);
  } catch {
    emit({section:"blocked", reason:"review_data_bindings_not_verified", data_changes:false}); return "blocked";
  }
  try {
    const report = await read();
    for (const record of formatReviewCommerceRecords(report)) emit(record);
    return "finished";
  } catch {
    emit({section:"blocked", reason:"review_audit_unavailable", data_changes:false}); return "blocked";
  }
}
