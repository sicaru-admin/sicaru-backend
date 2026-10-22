import assert from "node:assert/strict";
import { test } from "node:test";
import { assertReviewDataBindings } from "../src/lib/review-isolation.ts";
const review = {
  RAILWAY_PROJECT_ID:"7b251006-cebd-48b3-a7a5-97b6c65d6baf",
  RAILWAY_ENVIRONMENT_ID:"a04c43a9-03ec-44ff-8486-f64524c1cc8f",
  RAILWAY_SERVICE_ID:"50beb418-f34d-467d-b1f2-111c725c807d",
  DATABASE_URL:"postgresql://test:test@postgres.railway.internal:5432/test",
  REDIS_URL:"redis://test:test@redis.railway.internal:6379"
};
test("review audit requires explicit Railway context and private data bindings",()=>{
  assert(Object.values(assertReviewDataBindings(review)).every(Boolean));
  for(const field of Object.keys(review)) assert.throws(()=>assertReviewDataBindings({...review,[field]:undefined}));
});
test("a review name cannot authorize public or production data endpoints",()=>{
  for(const patch of [
    {RAILWAY_ENVIRONMENT_ID:"production",RAILWAY_ENVIRONMENT_NAME:"preview-payments"},
    {DATABASE_URL:"postgresql://test@production.example/test"},
    {DATABASE_URL:"not a URL"},
    {REDIS_URL:"redis://production.example:6379"}
  ]) assert.throws(()=>assertReviewDataBindings({...review,...patch}));
});
