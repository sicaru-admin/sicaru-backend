import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { FACTURAPI_MODULE } from "../../../../../modules/facturapi"

// GET /store/orders/:id/invoice — download invoice PDF
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const orderId = req.params.id
  const customerId = req.auth_context.actor_id
  if (!customerId) {
    res.status(401).json({ message: "No autenticado" })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Fetch order and verify it belongs to this customer
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "customer_id", "invoice_record.*"],
    filters: { id: orderId },
  })

  const order = orders?.[0]
  if (!order || order.customer_id !== customerId) {
    res.status(404).json({ message: "Pedido no encontrado" })
    return
  }

  const invoiceRecord = order.invoice_record
  if (!invoiceRecord?.facturapi_invoice_id) {
    res.status(404).json({ message: "No hay factura para este pedido" })
    return
  }

  const format = (req.query.format as string) || "pdf"
  const facturapi = req.scope.resolve(FACTURAPI_MODULE)

  if (format === "xml") {
    const xmlStream = await facturapi.downloadXml(
      invoiceRecord.facturapi_invoice_id
    )
    res.setHeader("Content-Type", "application/xml")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="factura-${orderId}.xml"`
    )
    xmlStream.pipe(res)
  } else {
    const pdfStream = await facturapi.downloadPdf(
      invoiceRecord.facturapi_invoice_id
    )
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="factura-${orderId}.pdf"`
    )
    pdfStream.pipe(res)
  }
}
