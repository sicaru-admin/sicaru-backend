import { model } from "@medusajs/framework/utils"

const FiscalData = model.define("fiscal_data", {
  id: model.id().primaryKey(),
  customer_id: model.text(),
  rfc: model.text(),
  razon_social: model.text(),
  regimen_fiscal: model.text(),
  codigo_postal_fiscal: model.text(),
  uso_cfdi: model.text(),
  email: model.text().nullable(),
  facturapi_customer_id: model.text().nullable(),
})

export default FiscalData
