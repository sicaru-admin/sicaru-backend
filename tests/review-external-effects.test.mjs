import assert from "node:assert/strict";
import {test,after} from "node:test";
import {registerHooks} from "node:module";
const prior=process.env.RAILWAY_ENVIRONMENT_ID;
const hook=registerHooks({resolve(specifier,context,next){
 const data=source=>({shortCircuit:true,url:"data:text/javascript,"+encodeURIComponent(source)});
 if(specifier==="@medusajs/framework/utils")return data("export const ContainerRegistrationKeys={QUERY:'query'};export const Modules={};");
 if(specifier.endsWith("/modules/whatsapp"))return data("export const WHATSAPP_MODULE='whatsapp';");
 if(specifier.endsWith("/modules/facturapi"))return data("export const FACTURAPI_MODULE='facturapi';");
 if(specifier.endsWith("/modules/abandoned-cart"))return data("export const ABANDONED_CART_MODULE='abandoned';");
 if(specifier.endsWith("/modules/whatsapp/types"))return data("export const TEMPLATE_ORDER_CONFIRMATION='',TEMPLATE_OXXO_VOUCHER='',TEMPLATE_ORDER_SHIPPED='',TEMPLATE_OXXO_REMINDER='',TEMPLATE_CART_REMINDER_1='',TEMPLATE_CART_REMINDER_2='',TEMPLATE_CART_REMINDER_3='';");
 if(specifier.endsWith("/modules/facturapi/types"))return data("export const SAT_PRODUCT_KEY='',SAT_UNIT_KEY='',SAT_UNIT_NAME='',SAT_PAYMENT_METHOD='',SAT_IVA_RATE=0,SAT_CURRENCY='';export const mapPaymentToSATForm=()=>'';");
 if(specifier.startsWith(".")&&!/\.[a-z]+$/i.test(specifier))return next(new URL(specifier+".ts",context.parentURL).href,context);
 return next(specifier,context);
}});
const {blockReviewExternalEffects}=await import("../src/lib/review-external-effects.ts");
const subscribers=await Promise.all(["whatsapp-order-placed","whatsapp-fulfillment","invoice-on-order-placed"].map(name=>import("../src/subscribers/"+name+".ts")));
const jobs=await Promise.all(["cart-abandonment-recovery","oxxo-payment-reminder"].map(name=>import("../src/jobs/"+name+".ts")));
hook.deregister();
after(()=>{if(prior===undefined)delete process.env.RAILWAY_ENVIRONMENT_ID;else process.env.RAILWAY_ENVIRONMENT_ID=prior;});
const noServices={resolve(){throw new Error("An external service must not be resolved in review.");}};
test("production and other environments retain external-effects behavior",()=>{
 assert.equal(blockReviewExternalEffects({RAILWAY_ENVIRONMENT_ID:"production"}),false);
 assert.equal(blockReviewExternalEffects({}),false);
 assert.equal(blockReviewExternalEffects({RAILWAY_ENVIRONMENT_ID:"a04c43a9-03ec-44ff-8486-f64524c1cc8f"}),true);
});
test("review order and fulfillment subscribers stop before resolving WhatsApp or invoicing",async()=>{
 process.env.RAILWAY_ENVIRONMENT_ID="a04c43a9-03ec-44ff-8486-f64524c1cc8f";
 for(const subscriber of subscribers)await subscriber.default({event:{data:{id:"synthetic",order_id:"synthetic"}},container:noServices});
});
test("review scheduled reminders stop even after test shipping opt-in is removed",async()=>{
 process.env.RAILWAY_ENVIRONMENT_ID="a04c43a9-03ec-44ff-8486-f64524c1cc8f";
 for(const job of jobs)await job.default(noServices);
});
