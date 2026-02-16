import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { LOYALTY_MODULE } from "../modules/loyalty"

const TIER_RANK = { sicaru: 0, plus: 1, vip: 2 } as const

export default async function loyaltyOrderPlaced({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = event.data.id
  const logger = container.resolve("logger") as {
    info: (...args: any[]) => void
    error: (...args: any[]) => void
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const loyalty = container.resolve(LOYALTY_MODULE) as any
  const remoteLink = container.resolve(ContainerRegistrationKeys.REMOTE_LINK)

  try {
    // Fetch order with items
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "customer_id", "items.*"],
      filters: { id: orderId },
    })

    const order = orders?.[0]
    if (!order?.customer_id) return

    // Get or create loyalty account
    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["loyalty_account.*"],
      filters: { id: order.customer_id },
    }) as { data: any[] }

    let account = customers?.[0]?.loyalty_account

    if (!account) {
      account = await loyalty.createLoyaltyAccounts({
        customer_id: order.customer_id,
        points_balance: 0,
        tier: "sicaru",
        lifetime_points: 0,
        quarterly_spend: 0,
        tier_evaluated_at: null,
      })

      await remoteLink.create({
        [Modules.CUSTOMER]: { customer_id: order.customer_id },
        [LOYALTY_MODULE]: { loyalty_account_id: account.id },
      })
    }

    // Calculate order total in centavos
    const totalCentavos = (order.items || []).reduce(
      (sum: number, item: any) =>
        sum + Number(item.unit_price) * item.quantity,
      0
    )

    // Calculate points based on tier
    const points = loyalty.calculatePointsForOrder(totalCentavos, account.tier)
    if (points <= 0) return

    // Create pending transaction
    await loyalty.createLoyaltyTransactions({
      account_id: account.id,
      type: "earn",
      status: "pending",
      points,
      order_id: orderId,
      description: "Puntos por pedido (pendiente de envio)",
    })

    // Update quarterly spend
    const newQuarterlySpend = (account.quarterly_spend || 0) + totalCentavos
    await loyalty.updateLoyaltyAccounts({
      id: account.id,
      quarterly_spend: newQuarterlySpend,
    })

    // Check for immediate tier upgrade
    const newTier = loyalty.determineTier(newQuarterlySpend)
    if (
      newTier !== account.tier &&
      TIER_RANK[newTier as keyof typeof TIER_RANK] >
        TIER_RANK[account.tier as keyof typeof TIER_RANK]
    ) {
      await loyalty.updateLoyaltyAccounts({
        id: account.id,
        tier: newTier,
      })
      logger.info(
        `[Loyalty] Customer ${order.customer_id}: tier upgraded to ${newTier}`
      )
    }

    logger.info(
      `[Loyalty] Order ${orderId}: ${points} pending points for customer ${order.customer_id}`
    )
  } catch (error: any) {
    logger.error(
      `[Loyalty] Order ${orderId}: failed: ${error.message || error}`
    )
  }
}

export const config: SubscriberConfig = {
  event: ["order.placed"],
}
