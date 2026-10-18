import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createProductsWorkflow } from "@medusajs/medusa/core-flows";
import { assertReviewDataBindings } from "../lib/review-isolation";
import { REVIEW_COMBO, assertReviewCataloguePreflight } from "../lib/review-catalog-plan";

export default async function prepareReviewCatalog({container}:ExecArgs) {
  if (process.env.SICARU_REVIEW_CATALOG_SETUP !== REVIEW_COMBO.version) return;
  assertReviewDataBindings(process.env);
  const query=container.resolve(ContainerRegistrationKeys.QUERY);
  const inventory=container.resolve(Modules.INVENTORY);
  const pricing=container.resolve(Modules.PRICING);
  const tax=container.resolve(Modules.TAX);
  const logger=container.resolve(ContainerRegistrationKeys.LOGGER);
  const source=(await query.graph({entity:"product",fields:["id","title","collection_id","shipping_profile.id","categories.id","variants.id","variants.sku","variants.manage_inventory","variants.allow_backorder"],filters:{id:REVIEW_COMBO.sourceProductId}})).data[0];
  const regions=(await query.graph({entity:"region",fields:["id"],filters:{id:REVIEW_COMBO.regionId}})).data;
  const locations=(await query.graph({entity:"stock_location",fields:["id","sales_channels.id"],filters:{id:REVIEW_COMBO.locationId}})).data;
  const taxRates=await tax.listTaxRates({code:"iva-mx"});
  assertReviewCataloguePreflight({regionIds:regions.map(r=>r.id),locationIds:locations.map(l=>l.id),channelIds:locations.flatMap(l=>(l.sales_channels??[]).flatMap(c=>c?[c.id]:[])),sourceVariants:(source?.variants??[]).flatMap(v=>v?[{id:v.id,sku:v.sku,manage_inventory:v.manage_inventory===true,allow_backorder:v.allow_backorder===true}]:[]),vatRates:taxRates.flatMap(r=>typeof r.rate==="number"?[r.rate]:[])});
  const existing=(await query.graph({entity:"product",fields:["id","metadata"],filters:{handle:REVIEW_COMBO.handle}})).data;
  if (existing.some(p=>p.metadata?.sicaru_review_fixture!==REVIEW_COMBO.version)) throw new Error("A different product uses the review combo handle.");
  if (!existing.length) {
    async function component(sku:string,title:string,quantity:number) {
      const found=await inventory.listInventoryItems({sku});
      if (found.some(item=>item.metadata?.sicaru_review_fixture!==REVIEW_COMBO.version)) throw new Error("Review component SKU conflict.");
      const item=found[0]??await inventory.createInventoryItems({sku,title,requires_shipping:true,metadata:{sicaru_review_fixture:REVIEW_COMBO.version,stock_kind:"fictitious_test_only",source:REVIEW_COMBO.source}});
      const levels=await inventory.listInventoryLevels({inventory_item_id:item.id,location_id:REVIEW_COMBO.locationId});
      // Never refill an existing level on restart or copy historical quantities.
      if (!levels.length) await inventory.createInventoryLevels({inventory_item_id:item.id,location_id:REVIEW_COMBO.locationId,stocked_quantity:quantity});
      return item.id;
    }
    const peroxide=await component("SICARU-TEST-PEROXIDO-20VOL-140ML","PRUEBA · Peróxido 20 vol 140 ml",REVIEW_COMBO.testPeroxideQuantity);
    const tones: {title:string;sku:string;manage_inventory:boolean;allow_backorder:boolean;options:Record<string,string>;prices:{currency_code:string;amount:number}[];inventory_items:{inventory_item_id:string;required_quantity:number}[];metadata:Record<string,string>}[]=[];
    for(const tone of REVIEW_COMBO.tones) {
      const title=tone.code+" "+tone.name;
      const tube=await component("SICARU-TEST-VOGLIA-"+tone.code+"-90ML","PRUEBA · Voglia tinte 90 ml · "+title,REVIEW_COMBO.testTubeQuantity);
      tones.push({title,sku:"SICARU-TEST-COMBO-VOGLIA-"+tone.code,manage_inventory:true,allow_backorder:false,
        options:{Tono:title},prices:[{currency_code:"mxn",amount:REVIEW_COMBO.amount}],
        inventory_items:[{inventory_item_id:tube,required_quantity:1},{inventory_item_id:peroxide,required_quantity:1}],
        metadata:{sicaru_review_fixture:REVIEW_COMBO.version,tone_code:tone.code,tone_name:tone.name,components:"1 tinte 90 ml + 1 peróxido 20 vol 140 ml"}});
    }
    await createProductsWorkflow(container).run({input:{products:[{
      title:REVIEW_COMBO.title,handle:REVIEW_COMBO.handle,status:"published",description:"Incluye un tinte Voglia de 90 ml en el tono elegido y un peróxido de 20 vol de 140 ml. Precio final del combo: $97 MXN, IVA incluido.",
      collection_id:source.collection_id??undefined,shipping_profile_id:source.shipping_profile?.id,
      category_ids:(source.categories??[]).flatMap(c=>c?[c.id]:[]),sales_channels:[{id:REVIEW_COMBO.channelId}],
      options:[{title:"Tono",values:REVIEW_COMBO.tones.map(t=>t.code+" "+t.name)}],variants:tones,
      metadata:{sicaru_review_fixture:REVIEW_COMBO.version,stock_kind:"fictitious_test_only",source:REVIEW_COMBO.source,components:"1 tinte 90 ml + 1 peróxido 20 vol 140 ml"}
    }]}});
  }
  // Store monetary amounts remain unchanged. Region-specific preference corrects
  // the erroneous extra 16% and does not touch other regions or tax rates.
  const preferences=await pricing.listPricePreferences({attribute:"region_id",value:REVIEW_COMBO.regionId});
  if(preferences.length!==1) throw new Error("Review region price preference is ambiguous.");
  if(!preferences[0].is_tax_inclusive) await pricing.updatePricePreferences(preferences[0].id,{is_tax_inclusive:true});
  logger.info("SICARU_REVIEW_CATALOG "+JSON.stringify({version:REVIEW_COMBO.version,combo:REVIEW_COMBO.handle,amount:97,tax_inclusive:true,existing_price_amounts_changed:false,existing_inventory_changed:false,test_component_quantities:[3,3,6],restock_on_restart:false}));
}
