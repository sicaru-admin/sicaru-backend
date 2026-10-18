import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createShippingOptionsWorkflow } from "@medusajs/medusa/core-flows";
import { REVIEW_COMBO } from "../lib/review-catalog-plan";
import { REVIEW_SHIPPING, assertReviewShippingEnvironment, reviewShippingRequested } from "../lib/review-shipping-policy";
import { verifyReviewPaymentAccess } from "../lib/review-shipping";

export default async function prepareReviewShipping({container}:ExecArgs) {
  if (!reviewShippingRequested(process.env)) return;
  assertReviewShippingEnvironment(process.env);
  await verifyReviewPaymentAccess(process.env);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillment = container.resolve(Modules.FULFILLMENT);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const {data:products} = await query.graph({entity:"product",filters:{handle:REVIEW_COMBO.handle},
    fields:["id","metadata","shipping_profile.id"]});
  const product = products[0];
  if (products.length !== 1 || product.metadata?.sicaru_review_fixture !== REVIEW_COMBO.version || !product.shipping_profile?.id) {
    throw new Error("Review combo and shipping profile not verified.");
  }
  const {data:locations} = await query.graph({entity:"stock_location",filters:{id:REVIEW_COMBO.locationId},
    fields:["id","sales_channels.id","fulfillment_sets.id","fulfillment_providers.id"]});
  const location = locations[0];
  if (!location?.sales_channels?.some(channel => channel?.id === REVIEW_COMBO.channelId) ||
      !location.fulfillment_providers?.some(provider => provider?.id === "manual_manual")) {
    throw new Error("Review stock location, channel or manual provider missing.");
  }
  const preferences = await container.resolve(Modules.PRICING).listPricePreferences({attribute:"currency_code",value:"mxn"});
  if (preferences.length !== 1 || !preferences[0].is_tax_inclusive) throw new Error("Inclusive MXN preference not verified; no prices changed.");
  const existing = await fulfillment.listFulfillmentSets({name:REVIEW_SHIPPING.fulfillmentSet},{relations:["service_zones"]});
  if (existing.length > 1) throw new Error("Review fulfillment set is ambiguous.");
  const set = existing[0] ?? await fulfillment.createFulfillmentSets({
    name:REVIEW_SHIPPING.fulfillmentSet,type:"shipping",
    // Synthetic routing solely for this test option. This is not DHL coverage.
    service_zones:[{name:"PRUEBA México · Sin entrega real",geo_zones:[{country_code:"mx",type:"country"}]}],
  });
  if (set.type !== "shipping" || set.service_zones.length !== 1) throw new Error("Unexpected review fulfillment set.");
  if (!location.fulfillment_sets?.some(value => value?.id === set.id)) {
    await link.create({[Modules.STOCK_LOCATION]:{stock_location_id:REVIEW_COMBO.locationId},
      [Modules.FULFILLMENT]:{fulfillment_set_id:set.id}});
  }
  const {data:options} = await query.graph({entity:"shipping_option",filters:{name:REVIEW_SHIPPING.name},
    fields:["id","name","provider_id","data","type.code"]});
  if (options.some(option => option.data?.sicaru_review_shipping !== REVIEW_SHIPPING.version ||
      option.data?.no_real_delivery !== true || option.type?.code !== REVIEW_SHIPPING.code) || options.length > 1) {
    throw new Error("Review option conflicts; nothing overwritten.");
  }
  if (!options.length) {
    await createShippingOptionsWorkflow(container).run({input:[{
      name:REVIEW_SHIPPING.name,price_type:"flat",provider_id:"manual_manual",
      shipping_profile_id:product.shipping_profile.id,service_zone_id:set.service_zones[0].id,
      type:{code:REVIEW_SHIPPING.code,label:REVIEW_SHIPPING.name,description:"Solo pruebas de checkout; no genera entrega ni guía."},
      data:{sicaru_review_shipping:REVIEW_SHIPPING.version,no_real_delivery:true},
      prices:[{currency_code:"mxn",amount:REVIEW_SHIPPING.amount}],
      rules:[{attribute:"enabled_in_store",operator:"eq",value:"true"},{attribute:"is_return",operator:"eq",value:"false"}],
    }]});
  }
  container.resolve(ContainerRegistrationKeys.LOGGER).info("SICARU_REVIEW_SHIPPING "+JSON.stringify({
    version:REVIEW_SHIPPING.version,name:REVIEW_SHIPPING.name,amount:REVIEW_SHIPPING.amount,
    tax_inclusive:true,no_real_delivery:true,product_prices_changed:false,inventory_changed:false,
  }));
}
