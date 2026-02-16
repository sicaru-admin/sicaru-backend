import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { FACTURAPI_MODULE } from "../../../../../modules/facturapi"
import {
  SAT_PRODUCT_KEY,
  SAT_UNIT_KEY,
  SAT_UNIT_NAME,
  SAT_PAYMENT_METHOD,
  SAT_IVA_RATE,
  SAT_CURRENCY,
  mapPaymentToSATForm,
} from "../../../../../modules/facturapi/types"

// GET /admin/orders/:id/invoice — retrieve invoice details
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const orderId = req.params.id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "invoice_record.*"],
    filters: { id: orderId },
  })

  const invoiceRecord = orders?.[0]?.invoice_record ?? null
  if (!invoiceRecord) {
    res.status(404).json({ message: "No hay factura para este pedido" })
    return
  }

  // Optionally fetch live data from FacturAPI
  const facturapi = req.scope.resolve(FACTURAPI_MODULE)
  let facturapiInvoice = null
  try {
    facturapiInvoice = await facturapi.getCFDI(
      invoiceRecord.facturapi_invoice_id
    )
  } catch {
    // Non-critical: return local record even if FacturAPI is unavailable
  }

  res.json({
    invoice_record: invoiceRecord,
    facturapi_invoice: facturapiInvoice,
  })
}

// POST /admin/orders/:id/invoice — manually trigger invoice creation
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const orderId = req.params.id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const facturapi = req.scope.resolve(FACTURAPI_MODULE)
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)

  // Check for existing invoice
  const { data: existingOrders } = await query.graph({
    entity: "order",
    fields: ["invoice_record.*"],
    filters: { id: orderId },
  })

  if (existingOrders?.[0]?.invoice_record) {
    res.status(409).json({ message: "Ya existe una factura para este pedido" })
    return
  }

  // Fetch order with customer, items, and payment details
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "customer_id",
      "metadata",
      "items.*",
      "payment_collections.*",
      "payment_collections.payments.*",
    ],
    filters: { id: orderId },
  })

  const order = orders?.[0]
  if (!order || !order.customer_id) {
    res.status(404).json({ message: "Pedido no encontrado" })
    return
  }

  // Fetch customer fiscal data via link
  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["email", "fiscal_data.*"],
    filters: { id: order.customer_id as string },
  })

  const fiscalData = customers?.[0]?.fiscal_data
  if (!fiscalData) {
    res.status(400).json({
      message:
        "El cliente no tiene datos fiscales. Deben guardarse primero.",
    })
    return
  }

  // Ensure FacturAPI customer exists
  let facturapiCustomerId: string = fiscalData.facturapi_customer_id ?? ""
  if (!facturapiCustomerId) {
    const facturapiCustomer = await facturapi.createFacturapiCustomer({
      legal_name: fiscalData.razon_social,
      tax_id: fiscalData.rfc,
      tax_system: fiscalData.regimen_fiscal,
      zip: fiscalData.codigo_postal_fiscal,
      email: fiscalData.email || customers?.[0]?.email || undefined,
    })
    facturapiCustomerId = facturapiCustomer.id

    // Cache the FacturAPI customer ID
    await facturapi.updateFiscalDatas({
      id: fiscalData.id,
      facturapi_customer_id: facturapiCustomerId,
    })
  }

  // Determine SAT payment form from payment data
  const payment = order.payment_collections?.[0]?.payments?.[0]
  const paymentData = (payment?.data || {}) as Record<string, any>
  const satPaymentForm = mapPaymentToSATForm(
    paymentData.payment_method_id,
    paymentData.payment_type_id
  )

  // Build CFDI line items
  const items = (order.items || []).map((item: any) => ({
    description: item.title || "Producto",
    quantity: item.quantity,
    price: Number(item.unit_price) / 100, // centavos → MXN
    product_key: SAT_PRODUCT_KEY,
    unit_key: SAT_UNIT_KEY,
    unit_name: SAT_UNIT_NAME,
    taxes: [{ type: "IVA", rate: SAT_IVA_RATE }],
  }))

  // Create CFDI in FacturAPI
  const facturapiInvoice = await facturapi.createCFDI({
    facturapi_customer_id: facturapiCustomerId,
    items,
    payment_form: satPaymentForm,
    payment_method: SAT_PAYMENT_METHOD,
    use: fiscalData.uso_cfdi,
    currency: SAT_CURRENCY,
  })

  // Store record locally
  const invoiceRecord = await facturapi.createInvoiceRecords({
    order_id: orderId,
    facturapi_invoice_id: facturapiInvoice.id,
    facturapi_customer_id: facturapiCustomerId,
    status: "active",
    uuid: facturapiInvoice.uuid || null,
    series: facturapiInvoice.series || null,
    folio_number: facturapiInvoice.folio_number || null,
    total: facturapiInvoice.total || 0,
    payment_form: satPaymentForm,
    pdf_url: null,
    xml_url: null,
  })

  // Create link between order and invoice record
  await remoteLink.create({
    [Modules.ORDER]: { order_id: orderId },
    [FACTURAPI_MODULE]: { invoice_record_id: invoiceRecord.id },
  })

  // Send invoice by email (non-blocking)
  try {
    await facturapi.sendByEmail(facturapiInvoice.id)
  } catch {
    // Log but don't fail
  }

  res.status(201).json({ invoice_record: invoiceRecord })
}
