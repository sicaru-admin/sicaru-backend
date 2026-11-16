const REVIEW = {
  project: "7b251006-cebd-48b3-a7a5-97b6c65d6baf",
  environment: "a04c43a9-03ec-44ff-8486-f64524c1cc8f",
  service: "50beb418-f34d-467d-b1f2-111c725c807d",
};
export function getReviewDataChecks(env: Record<string, string | undefined>) {
  const host = (value?: string) => { try { return value ? new URL(value).hostname.toLowerCase() : ""; } catch { return ""; } };
  return {
    project: env.RAILWAY_PROJECT_ID === REVIEW.project,
    environment: env.RAILWAY_ENVIRONMENT_ID === REVIEW.environment,
    service: env.RAILWAY_SERVICE_ID === REVIEW.service,
    databaseBinding: host(env.DATABASE_URL) === "postgres.railway.internal",
    redisBinding: host(env.REDIS_URL) === "redis.railway.internal",
  };
}
export function assertReviewDataBindings(env: Record<string, string | undefined>) {
  const checks = getReviewDataChecks(env);
  if (!Object.values(checks).every(Boolean)) throw new Error("Review data bindings could not be verified. No audit was run.");
  return checks;
}
