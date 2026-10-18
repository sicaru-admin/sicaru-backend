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
    const state = await requireDhlPayment(req.scope, data[0].cart_id);
    if ("mode" in state.quote && state.quote.mode === "review" &&
        (req.body as Record<string,unknown>)?.provider_id !== "pp_mercadopago_mercadopago") {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "El envío de prueba requiere Mercado Pago en modo de prueba.");
    }
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
