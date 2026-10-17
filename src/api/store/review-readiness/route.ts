import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { reviewPaymentReadiness, REVIEW_ENVIRONMENT_ID } from "../../../lib/review-payment-safety";
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  if (process.env.RAILWAY_ENVIRONMENT_ID !== REVIEW_ENVIRONMENT_ID) {
    res.status(404).json({ message: "Not found" }); return;
  }
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ environment: "preview-payments", payments: reviewPaymentReadiness(process.env), publicKey: process.env.MERCADOPAGO_PUBLIC_KEY?.startsWith("TEST-") ? process.env.MERCADOPAGO_PUBLIC_KEY : undefined });
}
