import { getReviewDataChecks } from "./review-isolation";
import { reviewPaymentReadiness } from "./review-payment-safety";
import { REVIEW_COMBO } from "./review-catalog-plan";

export const REVIEW_SHIPPING = {
  version: "review-shipping-214-v1",
  name: "Envío de prueba · Sin entrega real",
  amount: 214,
  code: "sicaru_review_no_delivery",
  fulfillmentSet: "SICARU PRUEBA · Sin entrega real · v1",
} as const;
export type ReviewEnvironment = Record<string, string | undefined>;
export function reviewShippingRequested(env: ReviewEnvironment) {
  return env.SICARU_REVIEW_SHIPPING === REVIEW_SHIPPING.version;
}
export function assertReviewShippingEnvironment(env: ReviewEnvironment) {
  if (!reviewShippingRequested(env) ||
      !Object.values(getReviewDataChecks(env)).every(Boolean) ||
      !Object.values(reviewPaymentReadiness(env)).every(Boolean)) {
    throw new Error("El envío de prueba no está habilitado en este entorno.");
  }
}
export type ReviewVariant = {
  id: string; sku?: string | null; manage_inventory?: boolean; allow_backorder?: boolean;
  metadata?: Record<string, unknown> | null;
  product?: { handle?: string | null; metadata?: Record<string, unknown> | null } | null;
  inventory_items?: { inventory_item_id: string; required_quantity?: number | null }[] | null;
};
export type ReviewInventory = { id: string; sku?: string | null; metadata?: Record<string, unknown> | null };
export type ReviewCart = {
  region_id?: string | null; sales_channel_id?: string | null; currency_code?: string | null;
  item_total?: number; discount_total?: number; total?: number; shipping_total?: number;
  items?: { variant_id?: string | null; quantity: number; unit_price?: number; is_tax_inclusive?: boolean }[] | null;
  shipping_address?: { country_code?: string | null; postal_code?: string | null } | null;
  payment_collection?: { amount?: number; currency_code?: string; payment_sessions?: {
    provider_id?: string; status?: string; amount?: number; currency_code?: string;
    data?: Record<string, unknown> | null;
  }[] | null } | null;
};
export function assertReviewCart(cart: ReviewCart, variants: ReviewVariant[], inventory: ReviewInventory[]) {
  if (cart.region_id !== REVIEW_COMBO.regionId || cart.sales_channel_id !== REVIEW_COMBO.channelId ||
      cart.currency_code !== "mxn" || !cart.items?.length || Number(cart.discount_total ?? 0) !== 0) {
    throw new Error("El envío de prueba solo admite el catálogo de revisión, sin descuentos.");
  }
  let subtotal = 0;
  for (const line of cart.items) {
    const variant = variants.find(v => v.id === line.variant_id);
    const tone = REVIEW_COMBO.tones.find(t => variant?.sku === "SICARU-TEST-COMBO-VOGLIA-" + t.code);
    if (!variant || !tone || variant.metadata?.sicaru_review_fixture !== REVIEW_COMBO.version ||
        variant.product?.handle !== REVIEW_COMBO.handle ||
        variant.product.metadata?.sicaru_review_fixture !== REVIEW_COMBO.version ||
        !variant.manage_inventory || variant.allow_backorder !== false ||
        !Number.isSafeInteger(line.quantity) || line.quantity < 1 ||
        Number(line.unit_price) !== REVIEW_COMBO.amount || line.is_tax_inclusive !== true) {
      throw new Error("Este artículo no pertenece al catálogo de prueba aprobado.");
    }
    const links = variant.inventory_items ?? [];
    const required = ["SICARU-TEST-VOGLIA-" + tone.code + "-90ML", "SICARU-TEST-PEROXIDO-20VOL-140ML"];
    if (links.length !== 2 || links.some(link => {
      const item = inventory.find(value => value.id === link.inventory_item_id);
      return link.required_quantity !== 1 || !item || !required.includes(item.sku ?? "") ||
        item.metadata?.sicaru_review_fixture !== REVIEW_COMBO.version ||
        item.metadata?.stock_kind !== "fictitious_test_only";
    }) || new Set(links.map(link => inventory.find(item => item.id === link.inventory_item_id)?.sku)).size !== 2) {
      throw new Error("No se pudieron verificar ambos componentes de inventario de prueba.");
    }
    subtotal += REVIEW_COMBO.amount * line.quantity;
  }
  if (!Number.isSafeInteger(subtotal) || Number(cart.item_total) !== subtotal) {
    throw new Error("El subtotal del catálogo de prueba cambió; revisa el carrito.");
  }
  return subtotal;
}
export function assertReviewAddress(cart: ReviewCart) {
  if (cart.shipping_address?.country_code !== "mx" || !/^\d{5}$/.test(cart.shipping_address.postal_code ?? "")) {
    throw new Error("Completa una dirección de prueba en México.");
  }
}
export function assertReviewTotal(cart: ReviewCart) {
  const expected = Number(cart.item_total) + REVIEW_SHIPPING.amount;
  if (Number(cart.shipping_total) !== REVIEW_SHIPPING.amount || Number(cart.total) !== expected ||
      Number(cart.payment_collection?.amount) !== expected || cart.payment_collection?.currency_code !== "mxn") {
    throw new Error("El importe de pago no coincide con productos y envío de prueba.");
  }
  return expected;
}
export function assertReviewPaymentSessions(cart: ReviewCart) {
  const amount = assertReviewTotal(cart);
  const sessions = (cart.payment_collection?.payment_sessions ?? []).filter(s => s.status !== "canceled" && s.status !== "error");
  if (sessions.length !== 1 || sessions[0].provider_id !== "pp_mercadopago_mercadopago" ||
      Number(sessions[0].amount) !== amount || sessions[0].currency_code !== "mxn" ||
      Number(sessions[0].data?.transaction_amount) !== amount ||
      !sessions[0].data?.id) {
    throw new Error("Actualiza el pago de prueba antes de confirmar el pedido.");
  }
  return sessions[0];
}
