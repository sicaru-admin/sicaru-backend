import { model } from "@medusajs/framework/utils"

const LoyaltyAccount = model.define("loyalty_account", {
  id: model.id().primaryKey(),
  customer_id: model.text(),
  points_balance: model.number().default(0),
  tier: model.enum(["sicaru", "plus", "vip"]).default("sicaru"),
  lifetime_points: model.number().default(0),
  quarterly_spend: model.number().default(0),
  tier_evaluated_at: model.dateTime().nullable(),
})

export default LoyaltyAccount
