import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { LOYALTY_MODULE } from "../../../../../../modules/loyalty"
import {
  POINTS_TO_MXN_RATE,
  REDEMPTION_VALUE_CENTAVOS,
} from "../../../../../../modules/loyalty/service"

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context.actor_id
  if (!customerId) {
    res.status(401).json({ message: "No autenticado" })
    return
  }

  const body = req.body as { points: number }
  const pointsToRedeem = body.points

  if (!pointsToRedeem || pointsToRedeem < POINTS_TO_MXN_RATE) {
    res
      .status(400)
      .json({ message: `Minimo ${POINTS_TO_MXN_RATE} puntos para canjear` })
    return
  }

  if (pointsToRedeem % POINTS_TO_MXN_RATE !== 0) {
    res.status(400).json({
      message: `Los puntos deben ser multiplo de ${POINTS_TO_MXN_RATE}`,
    })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const loyalty = req.scope.resolve(LOYALTY_MODULE) as any
  const promotionModule = req.scope.resolve(Modules.PROMOTION) as any

  // Get loyalty account
  const { data } = await query.graph({
    entity: "customer",
    fields: ["loyalty_account.*"],
    filters: { id: customerId },
  }) as { data: any[] }

  const account = data?.[0]?.loyalty_account
  if (!account) {
    res.status(404).json({ message: "Cuenta de recompensas no encontrada" })
    return
  }

  if (account.points_balance < pointsToRedeem) {
    res.status(400).json({ message: "Puntos insuficientes" })
    return
  }

  // Calculate discount
  const discountMXN =
    Math.floor(pointsToRedeem / POINTS_TO_MXN_RATE) *
    (REDEMPTION_VALUE_CENTAVOS / 100)

  // Generate unique promo code
  const code = `LOYALTY-${account.id.slice(-6).toUpperCase()}-${Date.now()}`

  try {
    // Create one-time-use promotion
    await promotionModule.createPromotions([
      {
        code,
        type: "standard",
        is_automatic: false,
        status: "active",
        application_method: {
          type: "fixed",
          value: discountMXN,
          target_type: "order",
          allocation: "total",
          currency_code: "mxn",
          max_quantity: 1,
        },
        rules: [],
      },
    ])
  } catch (error: any) {
    res.status(500).json({ message: "Error al crear descuento" })
    return
  }

  // Deduct points
  await loyalty.updateLoyaltyAccounts({
    id: account.id,
    points_balance: account.points_balance - pointsToRedeem,
  })

  // Record transaction
  await loyalty.createLoyaltyTransactions({
    account_id: account.id,
    type: "redeem",
    status: "confirmed",
    points: -pointsToRedeem,
    order_id: null,
    description: `Canje de ${pointsToRedeem} puntos por $${discountMXN} MXN de descuento`,
  })

  res.json({
    promo_code: code,
    discount_mxn: discountMXN,
    points_redeemed: pointsToRedeem,
    remaining_balance: account.points_balance - pointsToRedeem,
  })
}
