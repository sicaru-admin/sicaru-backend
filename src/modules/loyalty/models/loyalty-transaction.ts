import { model } from "@medusajs/framework/utils"

const LoyaltyTransaction = model.define("loyalty_transaction", {
  id: model.id().primaryKey(),
  account_id: model.text(),
  type: model.enum(["earn", "redeem", "expire", "adjust"]),
  status: model.enum(["pending", "confirmed", "cancelled"]).default("confirmed"),
  points: model.number(),
  order_id: model.text().nullable(),
  description: model.text(),
})

export default LoyaltyTransaction
