type Environment = Record<string, string | undefined>;
export const REVIEW_ENVIRONMENT_ID = "a04c43a9-03ec-44ff-8486-f64524c1cc8f";
export function reviewPaymentReadiness(env: Environment) {
  return {
    isolated: env.RAILWAY_ENVIRONMENT_ID === REVIEW_ENVIRONMENT_ID,
    sandbox: env.MERCADOPAGO_SANDBOX === "true",
    testAccessToken: env.MERCADOPAGO_ACCESS_TOKEN?.startsWith("TEST-") === true,
    testPublicKey: env.MERCADOPAGO_PUBLIC_KEY?.startsWith("TEST-") === true,
  };
}
export function assertReviewPaymentSafety(env: Environment, idempotencyKey?: unknown) {
  const state = reviewPaymentReadiness(env);
  if (!state.isolated) return;
  if (!state.sandbox || !state.testAccessToken || !state.testPublicKey)
    throw new Error("Los pagos de prueba no están configurados. No se realizó ningún cobro.");
  if (typeof idempotencyKey !== "string" || !idempotencyKey.trim())
    throw new Error("No se pudo preparar un pago seguro para este intento. No se realizó ningún cobro.");
}
