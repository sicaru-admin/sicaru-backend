import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { listShippingOptionsForCartWorkflow } from "@medusajs/medusa/core-flows";
import { quoteDhl, assertSelectedDhl, quoteRequired } from "./dhl-policy";
import type { DhlCart, DhlPolicy, DhlQuote } from "./dhl-policy";

export function readDhlPolicy(): DhlPolicy | null {
  try {
    return JSON.parse(readFileSync(
      process.env.DHL_POLICY_FILE || join(process.cwd(), "config/dhl-provisional.json"),
      "utf8"
    )) as DhlPolicy;
  } catch {
    return null;
  }
}

const CART_FIELDS = [
  "id", "email", "currency_code", "total", "shipping_total",
  "items.variant_id", "items.quantity", "shipping_address.*",
  "shipping_methods.shipping_option_id", "shipping_methods.amount",
  "shipping_methods.is_tax_inclusive",
  "payment_collection.amount", "payment_collection.currency_code",
];

export async function getDhlCheckout(container: MedusaContainer, cartId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "cart", fields: CART_FIELDS, filters: { id: cartId },
  });
  const cart = data[0] as DhlCart | undefined;
  if (!cart) throw new MedusaError(MedusaError.Types.NOT_FOUND, "No se encontró el carrito.");
  let quote = quoteDhl(readDhlPolicy(), cart);
  let shippingOption: Record<string, unknown> | null = null;
  if (quote.status === "available") {
    const expected = quote;
    const { result } = await listShippingOptionsForCartWorkflow(container).run({
      input: { cart_id: cartId, is_return: false },
    });
    const option = result.find((candidate) => candidate.id === expected.shipping_option_id);
    const amount = option?.calculated_price?.calculated_amount ?? option?.amount;
    const inclusive = option?.calculated_price?.is_calculated_price_tax_inclusive ?? option?.is_tax_inclusive;
    if (!option || option.insufficient_inventory === true ||
        option.provider_id !== "manual_manual" || option.price_type !== "flat" ||
        !/\bdhl\b/i.test(option.name) || amount !== expected.amount || inclusive !== true) {
      quote = quoteRequired("service_unconfigured");
    } else {
      // Expose one server-validated option, never the old local/manual fallback.
      shippingOption = {
        id: option.id, name: option.name, amount: expected.amount,
        provider_id: option.provider_id, price_type: "flat", is_tax_inclusive: true,
      };
    }
  }
  return { cart, quote, shippingOption };
}

export function requireAvailableDhl(quote: DhlQuote) {
  if (quote.status !== "available") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, quote.message);
  }
  return quote;
}

export async function requireSelectedDhl(container: MedusaContainer, cartId: string) {
  const state = await getDhlCheckout(container, cartId);
  requireAvailableDhl(state.quote);
  try {
    assertSelectedDhl(state.cart, state.quote);
  } catch (error) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, (error as Error).message);
  }
  return state;
}

export async function requireDhlPayment(container: MedusaContainer, cartId: string) {
  const state = await requireSelectedDhl(container, cartId);
  const address = state.cart.shipping_address as Record<string, unknown> | null | undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.cart.email ?? "") ||
      !address || ["first_name", "last_name", "address_1", "city", "province", "phone"].some(key => typeof address[key] !== "string" || !(address[key] as string).trim())) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Completa tu correo, teléfono y dirección de entrega antes de pagar.");
  }
  const collection = state.cart.payment_collection;
  if (!collection || Number(collection.amount) !== Number(state.cart.total) ||
      collection.currency_code?.toLowerCase() !== "mxn") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "El importe de pago debe actualizarse al total del pedido con DHL antes de continuar."
    );
  }
  return state;
}
