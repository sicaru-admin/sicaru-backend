import { addShippingMethodToCartWorkflow, completeCartWorkflow } from "@medusajs/medusa/core-flows";
import { MedusaError } from "@medusajs/framework/utils";
import { getDhlCheckout, requireAvailableDhl, requireDhlPayment } from "../../lib/dhl-checkout";

// Workflow hooks also protect callers that do not use the current storefront.
addShippingMethodToCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  const { quote } = await getDhlCheckout(container, input.cart_id);
  const available = requireAvailableDhl(quote);
  const selected = input.options?.[0];
  if (input.options?.length !== 1 || selected?.id !== available.shipping_option_id ||
      selected.data?.sicaru_quote_id !== available.quote_id || selected.data?.sicaru_quote_fingerprint !== available.fingerprint) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Selecciona el servicio DHL verificado con la cotización vigente antes de continuar."
    );
  }
});

completeCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  // A previously saved $49 method, stale price or changed address cannot pass.
  await requireDhlPayment(container, input.id, true);
});
