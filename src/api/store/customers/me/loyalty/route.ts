import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { LOYALTY_MODULE } from "../../../../../modules/loyalty"
import {
  TIER_CONFIG,
  POINTS_TO_MXN_RATE,
  REDEMPTION_VALUE_CENTAVOS,
} from "../../../../../modules/loyalty/service"

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context.actor_id
  if (!customerId) {
    res.status(401).json({ message: "No autenticado" })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const loyalty = req.scope.resolve(LOYALTY_MODULE) as any
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)

  // Get loyalty account via customer link
  const { data } = await query.graph({
    entity: "customer",
    fields: ["loyalty_account.*"],
    filters: { id: customerId },
  }) as { data: any[] }

  let account = data?.[0]?.loyalty_account

  // Auto-create account on first access
  if (!account) {
    account = await loyalty.createLoyaltyAccounts({
      customer_id: customerId,
      points_balance: 0,
      tier: "sicaru",
      lifetime_points: 0,
      quarterly_spend: 0,
      tier_evaluated_at: null,
    })

    await remoteLink.create({
      [Modules.CUSTOMER]: { customer_id: customerId },
      [LOYALTY_MODULE]: { loyalty_account_id: account.id },
    })
  }

  // Get recent transactions
  const transactions = await loyalty.listLoyaltyTransactions(
    { account_id: account.id },
    { order: { created_at: "DESC" }, take: 20 }
  )

  // Calculate tier progress
  const tiers = ["sicaru", "plus", "vip"] as const
  const currentTierIndex = tiers.indexOf(account.tier)
  const nextTier =
    currentTierIndex < tiers.length - 1
      ? tiers[currentTierIndex + 1]
      : null
  const nextTierSpend = nextTier
    ? TIER_CONFIG[nextTier].minQuarterlySpend
    : null

  res.json({
    loyalty_account: {
      ...account,
      points_value_mxn:
        Math.floor(account.points_balance / POINTS_TO_MXN_RATE) *
        (REDEMPTION_VALUE_CENTAVOS / 100),
      tier_multiplier: TIER_CONFIG[account.tier as keyof typeof TIER_CONFIG].pointsPerTenMXN,
      next_tier: nextTier,
      next_tier_spend_remaining: nextTierSpend
        ? Math.max(0, nextTierSpend - account.quarterly_spend)
        : null,
    },
    transactions,
  })
}
