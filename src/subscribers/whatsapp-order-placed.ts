import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { WHATSAPP_MODULE } from "../modules/whatsapp"
import {
  TEMPLATE_ORDER_CONFIRMATION,
  TEMPLATE_OXXO_VOUCHER,
} from "../modules/whatsapp/types"

export default async function whatsappOrderPlaced({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = event.data.id
  const logger = container.resolve("logger") as {
    info: (...args: any[]) => void
    error: (...args: any[]) => void
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const whatsapp = container.resolve(WHATSAPP_MODULE) as {
    sendTemplate: (
      to: string,
      templateName: string,
      languageCode: string,
      parameters: string[]
    ) => Promise<void>
  }

  try {
    // Fetch order with shipping address, items, and payment data
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "customer_id",
        "shipping_address.*",
        "items.*",
        "payment_collections.*",
        "payment_collections.payments.*",
      ],
      filters: { id: orderId },
    })

    const order = orders?.[0]
    if (!order) {
      logger.error(`[WhatsApp] Order ${orderId} not found`)
      return
    }

    // Get phone from shipping address
    const phone = (order.shipping_address as any)?.phone
    if (!phone) {
      logger.info(
        `[WhatsApp] Order ${orderId}: no phone number on shipping address, skipping`
      )
      return
    }

    const firstName =
      (order.shipping_address as any)?.first_name || "Cliente"

    // Calculate total from items
    const totalCentavos = (order.items || []).reduce(
      (sum: number, item: any) =>
        sum + Number(item.unit_price) * item.quantity,
      0
    )
    const totalFormatted = (totalCentavos / 100).toFixed(2)

    // Send order confirmation
    await whatsapp.sendTemplate(phone, TEMPLATE_ORDER_CONFIRMATION, "es_MX", [
      firstName,
      String(order.display_id || orderId),
      totalFormatted,
      "Estándar", // Default shipping method label
    ])

    // Check if OXXO payment — send voucher details
    const payment = (order.payment_collections as any)?.[0]?.payments?.[0]
    const paymentData = (payment?.data || {}) as Record<string, any>

    if (paymentData.payment_method_id === "oxxo") {
      const reference = paymentData.reference || "N/A"
      const expiration = paymentData.expiration_date
        ? new Date(paymentData.expiration_date).toLocaleDateString("es-MX", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "72 horas"

      await whatsapp.sendTemplate(phone, TEMPLATE_OXXO_VOUCHER, "es_MX", [
        firstName,
        reference,
        totalFormatted,
        expiration,
      ])

      logger.info(
        `[WhatsApp] Order ${orderId}: OXXO voucher sent to ${phone}`
      )
    }
  } catch (error: any) {
    // Never throw — WhatsApp failure must not block the order flow
    logger.error(
      `[WhatsApp] Order ${orderId}: notification failed: ${error.message || error}`
    )
  }
}

export const config: SubscriberConfig = {
  event: ["order.placed"],
}
