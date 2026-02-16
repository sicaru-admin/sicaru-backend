import FacturapiService from "./service"
import { Module } from "@medusajs/framework/utils"

export const FACTURAPI_MODULE = "facturapi"

export default Module(FACTURAPI_MODULE, {
  service: FacturapiService,
})
