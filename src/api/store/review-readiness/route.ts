import { readDhlPolicy } from "../../../lib/dhl-checkout";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { reviewPaymentReadiness, REVIEW_ENVIRONMENT_ID } from "../../../lib/review-payment-safety";
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  if (process.env.RAILWAY_ENVIRONMENT_ID !== REVIEW_ENVIRONMENT_ID) {
    res.status(404).json({ message: "Not found" }); return;
  }
  res.setHeader("Cache-Control", "private, no-store");
  const policy = readDhlPolicy();
  const readiness=reviewPaymentReadiness(process.env);
  let methods: string[]=[];
  let methodsVerified=false;
  if(readiness.isolated && readiness.sandbox && readiness.testAccessToken && readiness.testPublicKey) {
    try {
      const response=await fetch("https://api.mercadopago.com/v1/payment_methods",{
        headers:{Authorization:"Bearer "+process.env.MERCADOPAGO_ACCESS_TOKEN},signal:AbortSignal.timeout(8000)
      });
      const data:unknown=await response.json();
      if(response.ok && Array.isArray(data)) {
        const active=data.filter((value:unknown):value is Record<string,unknown>=>!!value&&typeof value==="object").filter(value=>value.status==="active");
        if(active.some(value=>["credit_card","debit_card"].includes(String(value.payment_type_id))))methods.push("card");
        if(active.some(value=>value.id==="oxxo"))methods.push("oxxo");
        methodsVerified=true;
      }
    } catch { /* No configured methods are advertised when provider access fails. */ }
  }
  res.json({ methods, methodsVerified, dhl: { policyPresent: policy !== null, enabled: policy?.enabled === true }, environment: "preview-payments", payments: reviewPaymentReadiness(process.env), publicKey: process.env.MERCADOPAGO_PUBLIC_KEY?.startsWith("TEST-") ? process.env.MERCADOPAGO_PUBLIC_KEY : undefined });
}
