import { defineMiddlewares } from "@medusajs/framework/http";
import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { requireDhlPayment } from "../lib/dhl-checkout";

export async function guardDhlPayment(
  req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction
) {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const { data } = await query.graph({
      entity: "cart_payment_collection", fields: ["cart_id"],
      filters: { payment_collection_id: req.params.id },
    });
    if (data.length !== 1 || !data[0].cart_id) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "No se pudo verificar el envío del carrito.");
    }
    await requireDhlPayment(req.scope, data[0].cart_id);
    next();
  } catch (error) {
    next(error);
  }
}

export default defineMiddlewares({
  routes: [{
    matcher: "/store/payment-collections/:id/payment-sessions",
    method: ["POST"],
    middlewares: [guardDhlPayment],
  }],
});
