import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { FACTURAPI_MODULE } from "../../../../../../modules/facturapi"

// POST /admin/orders/:id/invoice/cancel — cancel invoice with SAT
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const orderId = req.params.id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const facturapi = req.scope.resolve(FACTURAPI_MODULE)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["invoice_record.*"],
    filters: { id: orderId },
  })

  const invoiceRecord = orders?.[0]?.invoice_record
  if (!invoiceRecord) {
    res.status(404).json({ message: "No hay factura para este pedido" })
    return
  }

  if (invoiceRecord.status === "cancelled") {
    res.status(409).json({ message: "La factura ya fue cancelada" })
    return
  }

  // Cancel in FacturAPI (stamps cancellation with SAT)
  await facturapi.cancelCFDI(invoiceRecord.facturapi_invoice_id)

  // Update local record
  await facturapi.updateInvoiceRecords({
    id: invoiceRecord.id,
    status: "cancelled",
  })

  res.json({ invoice_record: { ...invoiceRecord, status: "cancelled" } })
}
