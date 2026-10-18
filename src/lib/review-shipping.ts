import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { listShippingOptionsForCartWorkflow } from "@medusajs/medusa/core-flows";
import { REVIEW_SHIPPING, assertReviewShippingEnvironment, assertReviewCart, assertReviewAddress, assertReviewTotal, assertReviewPaymentSessions, reviewShippingRequested } from "./review-shipping-policy";
import type { ReviewCart, ReviewVariant, ReviewInventory, ReviewEnvironment } from "./review-shipping-policy";

export type ReviewShippingQuote = {
  status: "available"; mode: "review"; shipping_option_id: string;
  amount: 214; currency_code: "mxn"; policy_revision: string;
};
let verified: { token: string; expires: number } | undefined;
export async function verifyReviewPaymentAccess(env: ReviewEnvironment) {
  assertReviewShippingEnvironment(env);
  const token = env.MERCADOPAGO_ACCESS_TOKEN!;
  if (verified?.token === token && verified.expires > Date.now()) return;
  const response = await fetch("https://api.mercadopago.com/v1/payment_methods", {
    headers: { Authorization: "Bearer " + token }, signal: AbortSignal.timeout(8000),
  });
  const result: unknown = await response.json();
  if (!response.ok || !Array.isArray(result) || !result.some(method => method?.status === "active" && ["credit_card","debit_card"].includes(method.payment_type_id))) {
    throw new Error("No se pudo verificar el acceso de prueba a Mercado Pago.");
  }
  verified = { token, expires: Date.now() + 30000 };
}
export async function getReviewShippingCheckout(container: MedusaContainer, cart: ReviewCart & {id:string}) {
  if (!reviewShippingRequested(process.env)) return null;
  try {
    await verifyReviewPaymentAccess(process.env);
    assertReviewAddress(cart);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const ids = (cart.items ?? []).flatMap(item => item.variant_id ? [item.variant_id] : []);
    const {data} = await query.graph({
      entity:"product_variant", filters:{id:ids},
      fields:["id","sku","metadata","manage_inventory","allow_backorder","product.handle","product.metadata","inventory_items.inventory_item_id","inventory_items.required_quantity"],
    });
    const variants = data as unknown as ReviewVariant[];
    const inventoryIds = [...new Set(variants.flatMap(v => (v.inventory_items ?? []).map(item => item.inventory_item_id)))];
    const inventory = await container.resolve(Modules.INVENTORY).listInventoryItems({id:inventoryIds});
    assertReviewCart(cart, variants, inventory as ReviewInventory[]);
    const {data:marked} = await query.graph({
      entity:"shipping_option", filters:{name:REVIEW_SHIPPING.name},
      fields:["id","name","provider_id","price_type","data","type.code"],
    });
    const candidates = marked.filter(option => option.data?.sicaru_review_shipping === REVIEW_SHIPPING.version &&
      option.data?.no_real_delivery === true && option.type?.code === REVIEW_SHIPPING.code);
    if (candidates.length !== 1) throw new Error("Test option missing or ambiguous.");
    const {result} = await listShippingOptionsForCartWorkflow(container).run({input:{cart_id:cart.id,is_return:false}});
    const option = result.find(value => value.id === candidates[0].id);
    const amount = option?.calculated_price?.calculated_amount ?? option?.amount;
    const inclusive = option?.calculated_price?.is_calculated_price_tax_inclusive ?? option?.is_tax_inclusive;
    if (!option || option.provider_id !== "manual_manual" || option.price_type !== "flat" ||
        option.name !== REVIEW_SHIPPING.name || option.insufficient_inventory === true ||
        amount !== REVIEW_SHIPPING.amount || inclusive !== true) throw new Error("Test option unavailable or amount changed.");
    return {
      quote:{status:"available",mode:"review",shipping_option_id:option.id,amount:REVIEW_SHIPPING.amount,
        currency_code:"mxn",policy_revision:REVIEW_SHIPPING.version} as ReviewShippingQuote,
      shippingOption:{id:option.id,name:REVIEW_SHIPPING.name,provider_id:"manual_manual",price_type:"flat",
        amount:REVIEW_SHIPPING.amount,is_tax_inclusive:true,metadata:{review_only:true,no_real_delivery:true}},
    };
  } catch {
    // No fallback to a real option when the explicit review mode is unsafe.
    return {quote:{status:"quote_required" as const,reason:"review_shipping_unavailable",
      message:"El envío de prueba no está disponible para este carrito."},shippingOption:null};
  }
}

export async function verifyReviewShippingPayment(cart: ReviewCart) {
  await verifyReviewPaymentAccess(process.env);
  const amount = assertReviewTotal(cart);
  const session = assertReviewPaymentSessions(cart);
  const id = String(session.data?.id ?? "");
  if (!/^\d+$/.test(id)) throw new Error("No se pudo verificar el identificador del pago de prueba.");
  const response = await fetch("https://api.mercadopago.com/v1/payments/" + id, {
    headers:{Authorization:"Bearer " + process.env.MERCADOPAGO_ACCESS_TOKEN},
    signal:AbortSignal.timeout(8000),
  });
  const payment = await response.json();
  if (!response.ok || payment.live_mode !== false ||
      Number(payment.transaction_amount) !== amount || payment.currency_id !== "MXN") {
    throw new Error("El pago de prueba no coincide con el importe del carrito.");
  }
  if (!["approved","authorized"].includes(payment.status)) {
    throw new Error(["pending","in_process","in_mediation"].includes(payment.status)
      ? "El pago de prueba sigue pendiente; no se confirmó el pedido."
      : "El pago de prueba no fue aprobado; no se confirmó el pedido.");
  }
}
