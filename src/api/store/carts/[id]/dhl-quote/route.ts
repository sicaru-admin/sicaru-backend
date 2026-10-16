import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getDhlCheckout } from "../../../../../lib/dhl-checkout";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { quote, shippingOption } = await getDhlCheckout(req.scope, req.params.id);
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ quote, shipping_options: shippingOption ? [shippingOption] : [] });
}
