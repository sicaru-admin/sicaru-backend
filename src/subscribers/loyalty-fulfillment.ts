import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { LOYALTY_MODULE } from "../modules/loyalty"

export default async function loyaltyFulfillment({
  event,
  container,
}: SubscriberArgs<{ id: string; order_id: string }>) {
  const orderId = event.data.order_id || event.data.id
  const logger = container.resolve("logger") as {
    info: (...args: any[]) => void
    error: (...args: any[]) => void
  }
  const loyalty = container.resolve(LOYALTY_MODULE) as any

  try {
    // Find pending earn transactions for this order
    const transactions = await loyalty.listLoyaltyTransactions({
      order_id: orderId,
      type: "earn",
      status: "pending",
    })

    for (const tx of transactions) {
      // Confirm the transaction
      await loyalty.updateLoyaltyTransactions({
        id: tx.id,
        status: "confirmed",
      })

      // Credit points to account
      const account = await loyalty.retrieveLoyaltyAccounts(tx.account_id)
      await loyalty.updateLoyaltyAccounts({
        id: account.id,
        points_balance: account.points_balance + tx.points,
        lifetime_points: account.lifetime_points + tx.points,
      })

      logger.info(
        `[Loyalty] Order ${orderId}: confirmed ${tx.points} points for account ${account.id}`
      )
    }
  } catch (error: any) {
    logger.error(
      `[Loyalty] Order ${orderId}: fulfillment confirmation failed: ${error.message || error}`
    )
  }
}

export const config: SubscriberConfig = {
  event: ["order.fulfillment_created"],
}
