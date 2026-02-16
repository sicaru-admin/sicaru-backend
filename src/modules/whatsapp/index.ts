import WhatsAppService from "./service"
import { Module } from "@medusajs/framework/utils"

export const WHATSAPP_MODULE = "whatsapp"

export default Module(WHATSAPP_MODULE, {
  service: WhatsAppService,
})
