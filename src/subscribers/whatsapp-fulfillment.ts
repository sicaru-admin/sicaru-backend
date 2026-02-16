import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { WHATSAPP_MODULE } from "../modules/whatsapp"
import { TEMPLATE_ORDER_SHIPPED } from "../modules/whatsapp/types"

export default async function whatsappFulfillment({
  event,
  container,
}: SubscriberArgs<{ id: string; order_id: string }>) {
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

  const orderId = event.data.order_id || event.data.id

  try {
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "shipping_address.*"],
      filters: { id: orderId },
    })

    const order = orders?.[0]
    if (!order) {
      logger.error(`[WhatsApp] Order ${orderId} not found for fulfillment notification`)
      return
    }

    const phone = (order.shipping_address as any)?.phone
    if (!phone) {
      logger.info(
        `[WhatsApp] Order ${orderId}: no phone number, skipping shipment notification`
      )
      return
    }

    const firstName =
      (order.shipping_address as any)?.first_name || "Cliente"

    // Estimated delivery — default to 3-5 business days
    const estimatedDelivery = "3-5 días hábiles"

    await whatsapp.sendTemplate(phone, TEMPLATE_ORDER_SHIPPED, "es_MX", [
      firstName,
      String(order.display_id || orderId),
      estimatedDelivery,
    ])
  } catch (error: any) {
    logger.error(
      `[WhatsApp] Order ${orderId}: fulfillment notification failed: ${error.message || error}`
    )
  }
}

export const config: SubscriberConfig = {
  event: ["order.fulfillment_created"],
}
