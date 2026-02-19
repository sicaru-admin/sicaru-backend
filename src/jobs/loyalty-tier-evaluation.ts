import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { LOYALTY_MODULE } from "../modules/loyalty"

export default async function loyaltyTierEvaluation(
  container: MedusaContainer
) {
  const logger = container.resolve("logger") as {
    info: (...args: any[]) => void
    error: (...args: any[]) => void
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const loyalty = container.resolve(LOYALTY_MODULE) as any

  try {
    const accounts = await loyalty.listLoyaltyAccounts({})
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    let evaluated = 0

    for (const account of accounts) {
      // Sum order totals from last 90 days for this customer
      const { data: orders } = await query.graph({
        entity: "order",
        fields: ["id", "items.*", "created_at"],
        filters: {
          customer_id: account.customer_id,
          created_at: { $gte: ninetyDaysAgo.toISOString() },
        },
      })

      const quarterlySpend = (orders || []).reduce(
        (sum: number, order: any) => {
          const orderTotal = (order.items || []).reduce(
            (s: number, item: any) =>
              s + Number(item.unit_price) * item.quantity,
            0
          )
          return sum + orderTotal
        },
        0
      )

      const newTier = loyalty.determineTier(quarterlySpend)

      await loyalty.updateLoyaltyAccounts({
        id: account.id,
        quarterly_spend: quarterlySpend,
        tier: newTier,
        tier_evaluated_at: new Date().toISOString(),
      })

      // Check for inactivity-based point expiration
      if (account.points_balance > 0) {
        const earnTxs = await loyalty.listLoyaltyTransactions({
          account_id: account.id,
          type: "earn",
          status: "confirmed",
        })

        const lastEarn = earnTxs.sort(
          (a: any, b: any) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        )[0]

        if (
          !lastEarn ||
          new Date(lastEarn.created_at) < twelveMonthsAgo
        ) {
          await loyalty.createLoyaltyTransactions({
            account_id: account.id,
            type: "expire",
            status: "confirmed",
            points: -account.points_balance,
            order_id: null,
            description:
              "Puntos expirados por inactividad (12 meses)",
          })

          await loyalty.updateLoyaltyAccounts({
            id: account.id,
            points_balance: 0,
          })

          logger.info(
            `[Loyalty] Expired ${account.points_balance} points for customer ${account.customer_id}`
          )
        }
      }

      evaluated++
    }

    logger.info(
      `[Loyalty Tier Evaluation] Evaluated ${evaluated} accounts`
    )
  } catch (error: any) {
    logger.error(
      `[Loyalty Tier Evaluation] Failed: ${error.message || error}`
    )
  }
}

export const config = {
  name: "loyalty-tier-evaluation",
  schedule: "0 3 * * *", // Daily at 3 AM (quarterly schedule overflows setTimeout)
}
