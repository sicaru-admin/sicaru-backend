import LoyaltyService from "./service"
import { Module } from "@medusajs/framework/utils"

export const LOYALTY_MODULE = "loyalty"

export default Module(LOYALTY_MODULE, {
  service: LoyaltyService,
})
