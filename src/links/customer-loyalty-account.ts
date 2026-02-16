import LoyaltyModule from "../modules/loyalty"
import CustomerModule from "@medusajs/medusa/customer"
import { defineLink } from "@medusajs/framework/utils"

export default defineLink(
  CustomerModule.linkable.customer,
  LoyaltyModule.linkable.loyaltyAccount
)
