import assert from "node:assert/strict";
import { test } from "node:test";
import { assertReviewPaymentSafety, REVIEW_ENVIRONMENT_ID } from "../src/lib/review-payment-safety.ts";
const safe = {RAILWAY_ENVIRONMENT_ID:REVIEW_ENVIRONMENT_ID,MERCADOPAGO_SANDBOX:"true",MERCADOPAGO_ACCESS_TOKEN:"TEST-fixture",MERCADOPAGO_PUBLIC_KEY:"TEST-fixture"};
test("isolated review rejects real credentials, missing test mode and unsafe retry identity before any payment call",()=>{
  assert.doesNotThrow(()=>assertReviewPaymentSafety(safe,"session-test"));
  for(const edit of [{MERCADOPAGO_SANDBOX:"false"},{MERCADOPAGO_ACCESS_TOKEN:"APP_USR-fixture"},{MERCADOPAGO_PUBLIC_KEY:"APP_USR-fixture"}])
    assert.throws(()=>assertReviewPaymentSafety({...safe,...edit},"session-test"),/prueba/);
  assert.throws(()=>assertReviewPaymentSafety(safe),/intento/);
});
test("guard does not alter production behavior",()=>assert.doesNotThrow(()=>assertReviewPaymentSafety({RAILWAY_ENVIRONMENT_ID:"production"})));
