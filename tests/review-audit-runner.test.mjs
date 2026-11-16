import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const dir = await fs.mkdtemp(path.join(os.tmpdir(),"sicaru-review-audit-"));
for (const name of ["review-isolation","approved-voglia-offer","review-audit-runner"]) {
  let source=await fs.readFile(new URL("../src/lib/"+name+".ts",import.meta.url),"utf8");
  source=source.replaceAll('"./review-isolation"','"./review-isolation.ts"').replaceAll('"./approved-voglia-offer"','"./approved-voglia-offer.ts"');
  await fs.writeFile(path.join(dir,name+".ts"),source);
}
const {runReviewCommerceAudit,formatReviewCommerceRecords}=await import("file://"+path.join(dir,"review-audit-runner.ts"));
const review={RAILWAY_PROJECT_ID:"7b251006-cebd-48b3-a7a5-97b6c65d6baf",RAILWAY_ENVIRONMENT_ID:"a04c43a9-03ec-44ff-8486-f64524c1cc8f",RAILWAY_SERVICE_ID:"50beb418-f34d-467d-b1f2-111c725c807d",DATABASE_URL:"postgresql://test@postgres.railway.internal/test",REDIS_URL:"redis://redis.railway.internal",SICARU_REVIEW_AUDIT_ON_START:"true"};
test("startup audit never reads data when disabled or outside the exact review environment",async()=>{
  for(const env of [{...review,SICARU_REVIEW_AUDIT_ON_START:"false"},{...review,RAILWAY_ENVIRONMENT_ID:"production"},{}]){
    assert.equal(await runReviewCommerceAudit(env,async()=>assert.fail("must not read"),()=>assert.fail("must not log")),"skipped");
  }
});
test("unverified data bindings block reads even with the review switch enabled",async()=>{
  const records=[];
  assert.equal(await runReviewCommerceAudit({...review,DATABASE_URL:"postgresql://production.example/test"},async()=>assert.fail("must not read"),r=>records.push(r)),"blocked");
  assert.equal(records[0].reason,"review_data_bindings_not_verified");
});
test("audit failure cannot expose credentials or interrupt startup",async()=>{
  const records=[];
  assert.equal(await runReviewCommerceAudit(review,async()=>{throw new Error("secret-password");},r=>records.push(r)),"blocked");
  assert(!JSON.stringify(records).includes("secret-password"));
});
test("partial reports remain incomplete and output excludes credentials and customer fields",()=>{
  const records=formatReviewCommerceRecords({audited_at:"test",payments:{sandbox:true,testAccessToken:true,testPublicKey:true,accessToken:"must-not-log"},variants:[{id:"prod",title:"Voglia",customer_email:"must-not-log",variants:[{id:"variant",sku:"combo",title:"Combo",password:"must-not-log",inventory_items:[{inventory_item_id:"inv",required_quantity:1,secret:"must-not-log"}],price_set:{prices:[{id:"price",amount:97,currency_code:"mxn",secret:"must-not-log"}]}}]}],unavailable:["reservations"]});
  assert(!JSON.stringify(records).includes("must-not-log"));
  const end=records.at(-1);assert.equal(end.complete,false);assert.deepEqual(end.unavailable,["reservations"]);
  assert.equal(end.data_changes,false);
});
