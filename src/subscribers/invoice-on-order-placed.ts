import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { FACTURAPI_MODULE } from "../modules/facturapi"
import {
  SAT_PRODUCT_KEY,
  SAT_UNIT_KEY,
  SAT_UNIT_NAME,
  SAT_PAYMENT_METHOD,
  SAT_IVA_RATE,
  SAT_CURRENCY,
  mapPaymentToSATForm,
} from "../modules/facturapi/types"

export default async function invoiceOnOrderPlaced({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = event.data.id
  const logger = container.resolve("logger") as {
    info: (...args: any[]) => void
    error: (...args: any[]) => void
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const facturapi = container.resolve(FACTURAPI_MODULE)
  const remoteLink = container.resolve(ContainerRegistrationKeys.REMOTE_LINK)

  try {
    // 1. Fetch order with metadata, items, and payment info
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
    if (!order) {
      logger.error(`[Facturapi] Order ${orderId} not found`)
      return
    }

    // 2. Check if customer requested invoice
    const metadata = (order.metadata || {}) as Record<string, unknown>
    if (metadata.requires_invoice !== true) {
      logger.info(
        `[Facturapi] Order ${orderId}: invoice not requested, skipping`
      )
      return
    }

    if (!order.customer_id) {
      logger.error(`[Facturapi] Order ${orderId}: no customer_id, skipping`)
      return
    }

    // 3. Fetch customer fiscal data via link
    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["email", "fiscal_data.*"],
      filters: { id: order.customer_id as string },
    })

    const fiscalData = customers?.[0]?.fiscal_data
    if (!fiscalData) {
      logger.error(
        `[Facturapi] Order ${orderId}: customer ${order.customer_id} has no fiscal data`
      )
      return
    }

    // 4. Create or reuse FacturAPI customer
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

      // Cache FacturAPI customer ID for future invoices
      await facturapi.updateFiscalDatas({
        id: fiscalData.id,
        facturapi_customer_id: facturapiCustomerId,
      })
    }

    // 5. Determine SAT payment form from MercadoPago data
    const payment = order.payment_collections?.[0]?.payments?.[0]
    const paymentData = (payment?.data || {}) as Record<string, any>
    const satPaymentForm = mapPaymentToSATForm(
      paymentData.payment_method_id,
      paymentData.payment_type_id
    )

    // 6. Build CFDI line items
    const items = (order.items || []).map((item: any) => ({
      description: item.title || "Producto",
      quantity: item.quantity,
      price: Number(item.unit_price) / 100, // centavos → MXN
      product_key: SAT_PRODUCT_KEY,
      unit_key: SAT_UNIT_KEY,
      unit_name: SAT_UNIT_NAME,
      taxes: [{ type: "IVA", rate: SAT_IVA_RATE }],
    }))

    // 7. Create CFDI in FacturAPI (stamps with SAT)
    const facturapiInvoice = await facturapi.createCFDI({
      facturapi_customer_id: facturapiCustomerId,
      items,
      payment_form: satPaymentForm,
      payment_method: SAT_PAYMENT_METHOD,
      use: fiscalData.uso_cfdi,
      currency: SAT_CURRENCY,
    })

    logger.info(
      `[Facturapi] Order ${orderId}: CFDI created, UUID=${facturapiInvoice.uuid}`
    )

    // 8. Store invoice record locally
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

    // 9. Create link between order and invoice record
    await remoteLink.create({
      [Modules.ORDER]: { order_id: orderId },
      [FACTURAPI_MODULE]: { invoice_record_id: invoiceRecord.id },
    })

    // 10. Send invoice by email (non-blocking)
    try {
      await facturapi.sendByEmail(facturapiInvoice.id)
      logger.info(
        `[Facturapi] Order ${orderId}: invoice sent by email`
      )
    } catch (emailErr: any) {
      logger.error(
        `[Facturapi] Order ${orderId}: email send failed: ${emailErr.message || emailErr}`
      )
    }
  } catch (error: any) {
    // Never throw — invoice failure must not block the order flow
    logger.error(
      `[Facturapi] Order ${orderId}: invoice creation failed: ${error.message || error}`
    )
  }
}

export const config: SubscriberConfig = {
  event: ["order.placed"],
}
