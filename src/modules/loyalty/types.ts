export type LoyaltyTier = "sicaru" | "plus" | "vip"

export type LoyaltyAccountData = {
  id: string
  customer_id: string
  points_balance: number
  tier: LoyaltyTier
  lifetime_points: number
  quarterly_spend: number
  tier_evaluated_at: string | null
  created_at: string
  updated_at: string
}

export type LoyaltyTransactionData = {
  id: string
  account_id: string
  type: "earn" | "redeem" | "expire" | "adjust"
  status: "pending" | "confirmed" | "cancelled"
  points: number
  order_id: string | null
  description: string
  created_at: string
}

export const TIER_LABELS: Record<LoyaltyTier, string> = {
  sicaru: "Sicaru",
  plus: "Sicaru Plus",
  vip: "Sicaru VIP",
}
