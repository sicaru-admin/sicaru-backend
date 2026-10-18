import assert from "node:assert/strict";
import {test,beforeEach,after} from "node:test";
import {registerHooks} from "node:module";
const envKeys=["RAILWAY_PROJECT_ID","RAILWAY_ENVIRONMENT_ID","RAILWAY_SERVICE_ID","DATABASE_URL","REDIS_URL","MERCADOPAGO_SANDBOX","MERCADOPAGO_ACCESS_TOKEN","MERCADOPAGO_PUBLIC_KEY","SICARU_REVIEW_SHIPPING"];
const prior=Object.fromEntries(envKeys.map(k=>[k,process.env[k]])),priorFetch=globalThis.fetch;
let cart,variants,inventory,options,payment,requests;
const key=Symbol.for("sicaru.review.shipping.server");
class TestMedusaError extends Error {static Types={INVALID_DATA:"invalid_data",NOT_FOUND:"not_found"};constructor(type,message){super(message);this.type=type;}}
globalThis[key]={MedusaError:TestMedusaError,listing:()=>({run:async()=>({result:options})})};
const g="globalThis[Symbol.for('sicaru.review.shipping.server')]";
const hook=registerHooks({resolve(specifier,context,next){
 if(specifier==="@medusajs/framework/utils")return{shortCircuit:true,url:"data:text/javascript,export const ContainerRegistrationKeys={QUERY:'query'};export const Modules={INVENTORY:'inventory'};export const MedusaError="+g+".MedusaError;"};
 if(specifier==="@medusajs/medusa/core-flows")return{shortCircuit:true,url:"data:text/javascript,export const listShippingOptionsForCartWorkflow="+g+".listing;"};
 if(specifier.startsWith(".")&&!/\.[a-z]+$/i.test(specifier))return next(new URL(specifier+".ts",context.parentURL).href,context);
 return next(specifier,context);
}});
const {getDhlCheckout,requireSelectedDhl,requireDhlPayment}=await import("../src/lib/dhl-checkout.ts");
hook.deregister();
const name="Envío de prueba · Sin entrega real";
const container={resolve:name=>name==="inventory"?{listInventoryItems:async()=>inventory}:{graph:async({entity})=>({data:entity==="cart"?[cart]:entity==="product_variant"?variants:entity==="shipping_option"?options:[]})}};
beforeEach(()=>{
 Object.assign(process.env,{RAILWAY_PROJECT_ID:"7b251006-cebd-48b3-a7a5-97b6c65d6baf",RAILWAY_ENVIRONMENT_ID:"a04c43a9-03ec-44ff-8486-f64524c1cc8f",RAILWAY_SERVICE_ID:"50beb418-f34d-467d-b1f2-111c725c807d",DATABASE_URL:"postgres://postgres.railway.internal/review",REDIS_URL:"redis://redis.railway.internal",MERCADOPAGO_SANDBOX:"true",MERCADOPAGO_ACCESS_TOKEN:"TEST-synthetic",MERCADOPAGO_PUBLIC_KEY:"TEST-synthetic",SICARU_REVIEW_SHIPPING:"review-shipping-214-v1"});
 const metadata={sicaru_review_fixture:"voglia-combo-97-v1",stock_kind:"fictitious_test_only"};
 inventory=[{id:"tube",sku:"SICARU-TEST-VOGLIA-1-90ML",metadata},{id:"peroxide",sku:"SICARU-TEST-PEROXIDO-20VOL-140ML",metadata}];
 variants=[{id:"variant_review",sku:"SICARU-TEST-COMBO-VOGLIA-1",metadata,manage_inventory:true,allow_backorder:false,product:{handle:"voglia-combo-tinte-90ml-peroxido-20vol-140ml",metadata},inventory_items:[{inventory_item_id:"tube",required_quantity:1},{inventory_item_id:"peroxide",required_quantity:1}]}];
 options=[{id:"ship_test",name,provider_id:"manual_manual",price_type:"flat",amount:214,is_tax_inclusive:true,type:{code:"sicaru_review_no_delivery"},data:{sicaru_review_shipping:"review-shipping-214-v1",no_real_delivery:true}}];
 cart={id:"cart_review",email:"test@example.invalid",region_id:"reg_01KZD6DTGVRN9TRSFJAB8XK1A1",sales_channel_id:"sc_01KZD6DTFPXNTG52EGDHYY00BJ",currency_code:"mxn",item_total:97,discount_total:0,total:311,shipping_total:214,items:[{variant_id:"variant_review",quantity:1,unit_price:97,is_tax_inclusive:true}],shipping_address:{country_code:"mx",postal_code:"67480",first_name:"Prueba",last_name:"Sicaru",address_1:"Solo prueba 1",city:"Cadereyta",province:"mx-nle",phone:"0000000000"},shipping_methods:[{shipping_option_id:"ship_test",amount:214,is_tax_inclusive:true}],payment_collection:{amount:311,currency_code:"mxn",payment_sessions:[{provider_id:"pp_mercadopago_mercadopago",amount:311,currency_code:"mxn",status:"pending",data:{id:"123",transaction_amount:311}}]}};
 payment={id:123,live_mode:false,currency_id:"MXN",transaction_amount:311,status:"approved"};
 requests=[];
 globalThis.fetch=async url=>{requests.push(url);return{ok:true,json:async()=>String(url).endsWith("/payment_methods")?[{status:"active",payment_type_id:"credit_card"}]:payment};};
});
after(()=>{for(const [k,v]of Object.entries(prior)){if(v===undefined)delete process.env[k];else process.env[k]=v;}globalThis.fetch=priorFetch;delete globalThis[key];});
test("explicit review quote uses real guard path without DHL weights and enforces selected option",async()=>{
 const state=await getDhlCheckout(container,cart.id);assert.equal(state.quote.mode,"review");assert.equal(state.quote.amount,214);assert.equal("actual_weight_g"in state.quote,false);assert.equal(state.shippingOption.name,name);
 await requireDhlPayment(container,cart.id,true);
 cart.shipping_methods[0].shipping_option_id="old_local_49";await assert.rejects(requireSelectedDhl(container,cart.id),/Actualiza/);
});
test("test option cannot be used outside exact environment or after explicit opt-in is removed",async()=>{
 for(const patch of [{RAILWAY_ENVIRONMENT_ID:"production"},{SICARU_REVIEW_SHIPPING:"false"},{MERCADOPAGO_SANDBOX:"false"}]){
  const before=Object.fromEntries(Object.keys(patch).map(k=>[k,process.env[k]]));Object.assign(process.env,patch);
  assert.equal((await getDhlCheckout(container,cart.id)).quote.status,"quote_required");await assert.rejects(requireSelectedDhl(container,cart.id));Object.assign(process.env,before);
 }
 assert.equal(requests.length,0);
});
test("mixed catalogue, stock failure, absent price and provider mismatch close the exception",async()=>{
 for(const mutate of [()=>cart.items.push({...cart.items[0],variant_id:"legacy"}),()=>options[0].insufficient_inventory=true,()=>delete options[0].amount,()=>options[0].provider_id="dhl_live"]){
  const original={cart:structuredClone(cart),options:structuredClone(options)};mutate();assert.equal((await getDhlCheckout(container,cart.id)).quote.status,"quote_required");cart=original.cart;options=original.options;
 }
});
test("server reads provider state: pending/rejected/live-mode or mismatched amount cannot create an order",async()=>{
 for(const patch of [{status:"pending"},{status:"rejected"},{live_mode:true},{transaction_amount:310},{currency_id:"USD"}]){
  const original={...payment};Object.assign(payment,patch);await assert.rejects(requireDhlPayment(container,cart.id,true));payment=original;
 }
 assert(requests.some(url=>String(url).endsWith("/v1/payments/123")));
 // These are GET-only contract tests with synthetic replies, not real payments.
});
test("changed quantity or payment collection is rejected before provider authorization",async()=>{
 cart.items[0].quantity=3;cart.item_total=291;cart.total=505;await assert.rejects(requireDhlPayment(container,cart.id,true),/importe/);
 cart.payment_collection.amount=505;await assert.rejects(requireDhlPayment(container,cart.id,true),/Actualiza/);
});
