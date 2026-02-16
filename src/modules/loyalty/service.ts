import { MedusaService } from "@medusajs/framework/utils"
import LoyaltyAccount from "./models/loyalty-account"
import LoyaltyTransaction from "./models/loyalty-transaction"
import type { LoyaltyTier } from "./types"

type InjectedDependencies = {
  logger: { info: (...args: any[]) => void; error: (...args: any[]) => void }
}

export const TIER_CONFIG = {
  sicaru: { minQuarterlySpend: 0, pointsPerTenMXN: 1 },
  plus: { minQuarterlySpend: 300000, pointsPerTenMXN: 1.5 }, // $3,000 MXN in centavos
  vip: { minQuarterlySpend: 800000, pointsPerTenMXN: 2 }, // $8,000 MXN in centavos
} as const

export const POINTS_TO_MXN_RATE = 100 // 100 points = $10 MXN
export const REDEMPTION_VALUE_CENTAVOS = 1000 // $10 MXN in centavos

class LoyaltyService extends MedusaService({
  LoyaltyAccount,
  LoyaltyTransaction,
}) {
  protected logger_: InjectedDependencies["logger"]

  constructor(
    container: InjectedDependencies,
    options: Record<string, unknown>
  ) {
    super(...arguments)
    this.logger_ = container.logger
  }

  calculatePointsForOrder(totalCentavos: number, tier: LoyaltyTier): number {
    const config = TIER_CONFIG[tier]
    const tenMXNunits = Math.floor(totalCentavos / 1000)
    return Math.floor(tenMXNunits * config.pointsPerTenMXN)
  }

  determineTier(quarterlySpendCentavos: number): LoyaltyTier {
    if (quarterlySpendCentavos >= TIER_CONFIG.vip.minQuarterlySpend) return "vip"
    if (quarterlySpendCentavos >= TIER_CONFIG.plus.minQuarterlySpend) return "plus"
    return "sicaru"
  }

  pointsToDiscountCentavos(points: number): number {
    return Math.floor(points / POINTS_TO_MXN_RATE) * REDEMPTION_VALUE_CENTAVOS
  }

  maxRedeemablePoints(availablePoints: number, cartTotalCentavos: number): number {
    const maxByBalance = Math.floor(availablePoints / POINTS_TO_MXN_RATE) * POINTS_TO_MXN_RATE
    const maxByCart = Math.floor(cartTotalCentavos / REDEMPTION_VALUE_CENTAVOS) * POINTS_TO_MXN_RATE
    return Math.min(maxByBalance, maxByCart)
  }
}

export default LoyaltyService
