import FacturapiModule from "../modules/facturapi"
import CustomerModule from "@medusajs/medusa/customer"
import { defineLink } from "@medusajs/framework/utils"

export default defineLink(
  CustomerModule.linkable.customer,
  FacturapiModule.linkable.fiscalData
)
