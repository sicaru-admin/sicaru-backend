import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ABANDONED_CART_MODULE } from "../modules/abandoned-cart"

export default async function cartRecoveryOnOrder({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = event.data.id
  const logger = container.resolve("logger") as {
    info: (...args: any[]) => void
    error: (...args: any[]) => void
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const abandonedCart = container.resolve(ABANDONED_CART_MODULE) as any

  try {
    // Fetch order to get cart_id
    const { data: orders } = (await query.graph({
      entity: "order",
      fields: ["id", "cart_id"],
      filters: { id: orderId },
    })) as { data: any[] }

    const order = orders?.[0]
    if (!order?.cart_id) return

    // Look up abandoned cart by cart_id
    const existing = await abandonedCart.listAbandonedCarts(
      { cart_id: order.cart_id },
      { take: 1 }
    )

    if (existing.length > 0 && existing[0].recovery_status !== "recovered") {
      await abandonedCart.updateAbandonedCarts({
        id: existing[0].id,
        recovery_status: "recovered",
        recovered_at: new Date(),
      })

      logger.info(
        `[Cart Recovery] Order ${orderId}: marked abandoned cart ${existing[0].id} as recovered`
      )
    }
  } catch (error: any) {
    logger.error(
      `[Cart Recovery] Order ${orderId}: failed: ${error.message || error}`
    )
  }
}

export const config: SubscriberConfig = {
  event: ["order.placed"],
}
