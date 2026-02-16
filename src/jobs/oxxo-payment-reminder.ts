import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { WHATSAPP_MODULE } from "../modules/whatsapp"
import { TEMPLATE_OXXO_REMINDER } from "../modules/whatsapp/types"

export default async function oxxoPaymentReminder(container: MedusaContainer) {
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
    // Fetch recent orders with pending payments (last 7 days window)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "metadata",
        "created_at",
        "shipping_address.*",
        "payment_collections.*",
        "payment_collections.payments.*",
      ],
      filters: {
        created_at: { $gte: sevenDaysAgo.toISOString() },
      },
    })

    const now = Date.now()
    const twentyFourHoursMs = 24 * 60 * 60 * 1000

    let remindersSent = 0

    for (const order of orders || []) {
      const metadata = (order.metadata || {}) as Record<string, unknown>

      // Skip if reminder already sent
      if (metadata.oxxo_reminder_sent === true) continue

      // Check if this is an OXXO payment
      const payment = (order.payment_collections as any)?.[0]?.payments?.[0]
      const paymentData = (payment?.data || {}) as Record<string, any>

      if (paymentData.payment_method_id !== "oxxo") continue

      // Skip if payment is already completed
      if (
        paymentData.mp_status === "approved" ||
        paymentData.mp_status === "cancelled"
      ) {
        continue
      }

      // Check if order is older than 24 hours
      const createdAt = new Date(order.created_at as string).getTime()
      if (now - createdAt < twentyFourHoursMs) continue

      // Get phone from shipping address
      const phone = (order.shipping_address as any)?.phone
      if (!phone) continue

      const firstName =
        (order.shipping_address as any)?.first_name || "Cliente"
      const reference = paymentData.reference || "N/A"
      const expiration = paymentData.expiration_date
        ? new Date(paymentData.expiration_date).toLocaleDateString("es-MX", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Pronto"

      await whatsapp.sendTemplate(phone, TEMPLATE_OXXO_REMINDER, "es_MX", [
        firstName,
        String(order.display_id || order.id),
        reference,
        expiration,
      ])

      // Mark reminder as sent to avoid duplicate sends
      try {
        const orderService = container.resolve(Modules.ORDER) as any
        await orderService.updateOrders(order.id, {
          metadata: { ...metadata, oxxo_reminder_sent: true },
        })
      } catch {
        // Non-critical — worst case is a duplicate reminder next hour
      }

      logger.info(
        `[OXXO Reminder] Sent reminder for order ${order.id} to ${phone}`
      )
      remindersSent++
    }

    if (remindersSent > 0) {
      logger.info(
        `[OXXO Reminder] Job complete: ${remindersSent} reminder(s) sent`
      )
    }
  } catch (error: any) {
    logger.error(
      `[OXXO Reminder] Job failed: ${error.message || error}`
    )
  }
}

export const config = {
  name: "oxxo-payment-reminder",
  schedule: "0 * * * *", // Every hour
}
