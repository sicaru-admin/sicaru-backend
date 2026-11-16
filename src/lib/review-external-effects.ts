// Review orders must never send real customer messages or issue invoices.
// Keep this block after test shipping is disabled: scheduled jobs may see old test orders.
export function blockReviewExternalEffects(env: Record<string,string|undefined>) {
  return env.RAILWAY_ENVIRONMENT_ID === "a04c43a9-03ec-44ff-8486-f64524c1cc8f";
}
