import { Module } from "@medusajs/framework/utils"
import SalonProService from "./service"

export const SALON_PRO_MODULE = "salonPro"

export default Module(SALON_PRO_MODULE, {
  service: SalonProService,
})
