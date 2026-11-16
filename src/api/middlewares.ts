import { defineMiddlewares } from "@medusajs/framework/http";
import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { requireDhlCheckoutDetails, requireDhlPayment } from "../lib/dhl-checkout";

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
    if ((req.body as Record<string, unknown>)?.provider_id !== "pp_mercadopago_mercadopago") {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Selecciona un método de Mercado Pago disponible antes de continuar.");
    }
    next();
  } catch (error) {
    next(error);
  }
}

export async function guardDhlCollection(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  try {
    const cartId = (req.body as Record<string, unknown>)?.cart_id;
    if (typeof cartId !== "string" || !cartId.trim()) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "No se pudo verificar el envío del carrito.");
    }
    // This runs before a collection exists, so it validates shipping and totals without requiring one.
    await requireDhlCheckoutDetails(req.scope, cartId);
    next();
  } catch (error) { next(error); }
}

export default defineMiddlewares({
  routes: [{
    matcher: "/store/payment-collections",
    method: ["POST"],
    middlewares: [guardDhlCollection],
  }, {
    matcher: "/store/payment-collections/:id/payment-sessions",
    method: ["POST"],
    middlewares: [guardDhlPayment],
  }],
});
