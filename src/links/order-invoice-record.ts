import FacturapiModule from "../modules/facturapi"
import OrderModule from "@medusajs/medusa/order"
import { defineLink } from "@medusajs/framework/utils"

export default defineLink(
  OrderModule.linkable.order,
  FacturapiModule.linkable.invoiceRecord
)
