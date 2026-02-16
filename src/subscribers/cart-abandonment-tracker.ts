import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ABANDONED_CART_MODULE } from "../modules/abandoned-cart"

export default async function cartAbandonmentTracker({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const cartId = event.data.id
  const logger = container.resolve("logger") as {
    info: (...args: any[]) => void
    error: (...args: any[]) => void
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const abandonedCart = container.resolve(ABANDONED_CART_MODULE) as any

  try {
    // Fetch cart with items and shipping address
    const { data: carts } = (await query.graph({
      entity: "cart",
      fields: [
        "id",
        "customer_id",
        "email",
        "items.*",
        "shipping_address.*",
      ],
      filters: { id: cartId },
    })) as { data: any[] }

    const cart = carts?.[0]
    if (!cart) return

    // Skip carts with no items
    const items = cart.items || []
    if (items.length === 0) return

    // Extract phone from shipping address
    const phone = (cart.shipping_address as any)?.phone as string | null
    if (!phone) return

    // Calculate cart total in centavos
    const cartTotal = items.reduce(
      (sum: number, item: any) =>
        sum + Number(item.unit_price) * item.quantity,
      0
    )

    // Check if record already exists for this cart
    const existing = await abandonedCart.listAbandonedCarts(
      { cart_id: cartId },
      { take: 1 }
    )

    if (existing.length > 0) {
      const record = existing[0]
      // Don't update carts that are already recovered or opted out
      if (
        record.recovery_status === "recovered" ||
        record.recovery_status === "opted_out"
      ) {
        return
      }

      await abandonedCart.updateAbandonedCarts({
        id: record.id,
        last_cart_activity: new Date(),
        items_snapshot: abandonedCart.serializeItems(items),
        cart_total: cartTotal,
        email: cart.email || record.email,
        phone,
        customer_id: cart.customer_id || record.customer_id,
      })
    } else {
      await abandonedCart.createAbandonedCarts({
        cart_id: cartId,
        customer_id: cart.customer_id || null,
        email: cart.email || null,
        phone,
        cart_total: cartTotal,
        items_snapshot: abandonedCart.serializeItems(items),
        recovery_status: "active",
        recovery_token: abandonedCart.generateRecoveryToken(),
        last_cart_activity: new Date(),
      })
    }
  } catch (error: any) {
    logger.error(
      `[Cart Abandonment] Failed to track cart ${cartId}: ${error.message || error}`
    )
  }
}

export const config: SubscriberConfig = {
  event: ["cart.updated"],
}
