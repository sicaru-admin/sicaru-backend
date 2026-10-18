import assert from "node:assert/strict";
import {test} from "node:test";
import {registerHooks} from "node:module";
const hook=registerHooks({resolve(specifier,context,next){if(specifier.startsWith(".")&&!/\.[a-z]+$/i.test(specifier))return next(new URL(specifier+".ts",context.parentURL).href,context);return next(specifier,context);}});
const {REVIEW_SHIPPING,assertReviewShippingEnvironment,reviewShippingRequested,assertReviewCart,assertReviewAddress,assertReviewTotal,assertReviewPaymentSessions}=await import("../src/lib/review-shipping-policy.ts");
hook.deregister();
const env={RAILWAY_PROJECT_ID:"7b251006-cebd-48b3-a7a5-97b6c65d6baf",RAILWAY_ENVIRONMENT_ID:"a04c43a9-03ec-44ff-8486-f64524c1cc8f",RAILWAY_SERVICE_ID:"50beb418-f34d-467d-b1f2-111c725c807d",DATABASE_URL:"postgres://postgres.railway.internal/review",REDIS_URL:"redis://redis.railway.internal",MERCADOPAGO_SANDBOX:"true",MERCADOPAGO_ACCESS_TOKEN:"TEST-fixture-only",MERCADOPAGO_PUBLIC_KEY:"TEST-fixture-only",SICARU_REVIEW_SHIPPING:REVIEW_SHIPPING.version};
const marker={sicaru_review_fixture:"voglia-combo-97-v1",stock_kind:"fictitious_test_only"};
function fixture(quantity=1){
 const inventory=[{id:"tube",sku:"SICARU-TEST-VOGLIA-1-90ML",metadata:marker},{id:"peroxide",sku:"SICARU-TEST-PEROXIDO-20VOL-140ML",metadata:marker}];
 const variants=[{id:"review-1",sku:"SICARU-TEST-COMBO-VOGLIA-1",metadata:marker,product:{handle:"voglia-combo-tinte-90ml-peroxido-20vol-140ml",metadata:marker},manage_inventory:true,allow_backorder:false,inventory_items:[{inventory_item_id:"tube",required_quantity:1},{inventory_item_id:"peroxide",required_quantity:1}]}];
 const total=97*quantity+214;
 const cart={region_id:"reg_01KZD6DTGVRN9TRSFJAB8XK1A1",sales_channel_id:"sc_01KZD6DTFPXNTG52EGDHYY00BJ",currency_code:"mxn",item_total:97*quantity,discount_total:0,total,shipping_total:214,items:[{variant_id:"review-1",quantity,unit_price:97,is_tax_inclusive:true}],shipping_address:{country_code:"mx",postal_code:"67480"},payment_collection:{amount:total,currency_code:"mxn",payment_sessions:[{amount:total,currency_code:"mxn",provider_id:"pp_mercadopago_mercadopago",status:"authorized",data:{id:"123",transaction_amount:total,mp_status:"authorized"}}]}};
 return {cart,variants,inventory};
}
test("test shipping requires explicit activation, exact isolated bindings and test credentials",()=>{
 assert.doesNotThrow(()=>assertReviewShippingEnvironment(env));
 for(const key of Object.keys(env))assert.throws(()=>assertReviewShippingEnvironment({...env,[key]:undefined}),key);
 for(const patch of [{RAILWAY_ENVIRONMENT_ID:"production"},{MERCADOPAGO_ACCESS_TOKEN:"APP_USR-real"},{MERCADOPAGO_PUBLIC_KEY:"APP_USR-real"},{MERCADOPAGO_SANDBOX:"false"},{DATABASE_URL:"postgres://production.example/db"},{REDIS_URL:"redis://production.example"}])assert.throws(()=>assertReviewShippingEnvironment({...env,...patch}));
 assert.equal(reviewShippingRequested({}),false);
});
test("one combo is 311 and three are 505 with inclusive manual test shipping",()=>{
 for(const [qty,total] of [[1,311],[3,505]]){
  const {cart,variants,inventory}=fixture(qty);
  assert.equal(assertReviewCart(cart,variants,inventory),97*qty);
  assert.doesNotThrow(()=>assertReviewAddress(cart));assert.equal(assertReviewTotal(cart),total);
  assert.equal(assertReviewPaymentSessions(cart).amount,total);
 }
 assert.equal(REVIEW_SHIPPING.name,"Envío de prueba · Sin entrega real");
});
test("mixed catalogue, legacy tube, missing evidence and disabled stock controls are rejected",()=>{
 for(const mutate of [
  f=>f.cart.items.push({...f.cart.items[0],variant_id:"real-product"}),
  f=>f.variants[0].sku="VOGLIA-TINTE-90ML",
  f=>f.variants[0].metadata={},
  f=>f.variants[0].product.metadata={},
  f=>f.variants[0].manage_inventory=false,
  f=>f.variants[0].allow_backorder=true,
  f=>f.variants[0].inventory_items.pop(),
  f=>f.variants[0].inventory_items[1].inventory_item_id="tube",
  f=>f.inventory[0].metadata={},
  f=>f.cart.items[0].is_tax_inclusive=false,
  f=>f.cart.items[0].unit_price=85,
  f=>f.cart.items[0].quantity=0,
  f=>f.cart.item_total=112.52,
  f=>f.cart.discount_total=1,
  f=>f.cart.sales_channel_id="other",
 ]){const f=fixture();mutate(f);assert.throws(()=>assertReviewCart(f.cart,f.variants,f.inventory));}
});
test("missing address and stale or absent shipping/payment amounts cannot complete",()=>{
 for(const address of [null,{country_code:"mx",postal_code:""},{country_code:"us",postal_code:"67480"}])assert.throws(()=>assertReviewAddress({...fixture().cart,shipping_address:address}));
 for(const patch of [{total:97},{shipping_total:0},{shipping_total:49},{total:undefined},{payment_collection:{amount:310,currency_code:"mxn"}}])assert.throws(()=>assertReviewTotal({...fixture().cart,...patch}));
 for(const mutate of [c=>c.payment_collection.payment_sessions=[],c=>c.payment_collection.payment_sessions[0].amount=97,c=>c.payment_collection.payment_sessions[0].data.transaction_amount=97,c=>c.payment_collection.payment_sessions[0].provider_id="pp_system_default",c=>c.payment_collection.payment_sessions.push(c.payment_collection.payment_sessions[0])]){
  const {cart}=fixture();mutate(cart);assert.throws(()=>assertReviewPaymentSessions(cart));
 }
});
