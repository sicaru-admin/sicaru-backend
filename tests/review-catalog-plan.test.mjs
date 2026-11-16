import assert from "node:assert/strict";
import { test } from "node:test";
import { REVIEW_COMBO, assertReviewCataloguePreflight } from "../src/lib/review-catalog-plan.ts";
const context={regionIds:[REVIEW_COMBO.regionId],channelIds:[REVIEW_COMBO.channelId],locationIds:[REVIEW_COMBO.locationId],sourceVariants:[{id:REVIEW_COMBO.sourceVariantId,sku:"VOGLIA-TINTE-90ML",manage_inventory:true,allow_backorder:false}],vatRates:[16]};
test("combo preparation fails closed when inventory control, region, location or channel differs",()=>{
  assert.doesNotThrow(()=>assertReviewCataloguePreflight(context));
  for(const key of ["regionIds","channelIds","locationIds","sourceVariants","vatRates"])assert.throws(()=>assertReviewCataloguePreflight({...context,[key]:[]}));
  assert.throws(()=>assertReviewCataloguePreflight({...context,sourceVariants:[{...context.sourceVariants[0],allow_backorder:true}]}));
});
test("approved combo is separate from the existing tube and test stock is explicit",()=>{
  assert.equal(REVIEW_COMBO.amount,97);assert.notEqual(REVIEW_COMBO.handle,"voglia-tinte-permanente-90ml");
  assert.deepEqual(REVIEW_COMBO.tones.map(t=>t.code),["1","3"]);
  assert.equal(REVIEW_COMBO.testTubeQuantity,3);assert.equal(REVIEW_COMBO.testPeroxideQuantity,6);
});
