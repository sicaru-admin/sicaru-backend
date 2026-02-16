import { model } from "@medusajs/framework/utils"

const InvoiceRecord = model.define("invoice_record", {
  id: model.id().primaryKey(),
  order_id: model.text(),
  facturapi_invoice_id: model.text(),
  facturapi_customer_id: model.text(),
  status: model.enum(["active", "cancelled"]),
  uuid: model.text().nullable(),
  series: model.text().nullable(),
  folio_number: model.number().nullable(),
  total: model.float(),
  payment_form: model.text(),
  pdf_url: model.text().nullable(),
  xml_url: model.text().nullable(),
})

export default InvoiceRecord
