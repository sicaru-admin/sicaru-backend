import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { ABANDONED_CART_MODULE } from "../modules/abandoned-cart"
import { WHATSAPP_MODULE } from "../modules/whatsapp"
import {
  TEMPLATE_CART_REMINDER_1,
  TEMPLATE_CART_REMINDER_2,
  TEMPLATE_CART_REMINDER_3,
} from "../modules/whatsapp/types"

const STORE_URL = process.env.STORE_URL || "https://sicaru.com"

// Timing thresholds in milliseconds
const THIRTY_MINUTES = 30 * 60 * 1000
const SIX_HOURS = 6 * 60 * 60 * 1000
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000

// Minimum cart total for discount (in centavos) — $500 MXN
const DISCOUNT_THRESHOLD = 50000

export default async function cartAbandonmentRecovery(
  container: MedusaContainer
) {
  const logger = container.resolve("logger") as {
    info: (...args: any[]) => void
    error: (...args: any[]) => void
  }
  const abandonedCart = container.resolve(ABANDONED_CART_MODULE) as any
  const whatsapp = container.resolve(WHATSAPP_MODULE) as {
    sendTemplate: (
      to: string,
      templateName: string,
      languageCode: string,
      parameters: string[]
    ) => Promise<void>
  }

  try {
    // Fetch carts eligible for messaging
    const carts = await abandonedCart.listAbandonedCarts(
      {
        recovery_status: ["active", "reminded_1", "reminded_2", "reminded_3"],
        opted_out: false,
      },
      { take: 200 }
    )

    const now = Date.now()
    let messagesSent = 0

    for (const cart of carts) {
      if (!cart.phone) continue

      const elapsed = now - new Date(cart.last_cart_activity).getTime()
      const recoveryUrl = `${STORE_URL}/carrito/recuperar/${cart.recovery_token}`
      const firstName = cart.customer_id ? "Cliente" : "Cliente"
      const productList = abandonedCart.formatProductList(cart.items_snapshot)

      try {
        // Message 1: 30+ minutes, status = active
        if (cart.recovery_status === "active" && elapsed >= THIRTY_MINUTES) {
          await whatsapp.sendTemplate(
            cart.phone,
            TEMPLATE_CART_REMINDER_1,
            "es_MX",
            [firstName, productList, recoveryUrl]
          )

          await abandonedCart.updateAbandonedCarts({
            id: cart.id,
            recovery_status: "reminded_1",
            message_1_sent_at: new Date(),
          })

          messagesSent++
          logger.info(
            `[Cart Recovery] Message 1 sent to ${cart.phone} for cart ${cart.cart_id}`
          )
        }

        // Message 2: 6+ hours, status = reminded_1
        if (cart.recovery_status === "reminded_1" && elapsed >= SIX_HOURS) {
          const formattedTotal = abandonedCart.formatTotal(cart.cart_total)

          await whatsapp.sendTemplate(
            cart.phone,
            TEMPLATE_CART_REMINDER_2,
            "es_MX",
            [firstName, productList, formattedTotal, recoveryUrl]
          )

          await abandonedCart.updateAbandonedCarts({
            id: cart.id,
            recovery_status: "reminded_2",
            message_2_sent_at: new Date(),
          })

          messagesSent++
          logger.info(
            `[Cart Recovery] Message 2 sent to ${cart.phone} for cart ${cart.cart_id}`
          )
        }

        // Message 3: 24+ hours, status = reminded_2
        if (
          cart.recovery_status === "reminded_2" &&
          elapsed >= TWENTY_FOUR_HOURS
        ) {
          let discountText = "Completa tu compra hoy"
          let recoveryCode: string | null = null

          // Create discount code for high-value carts
          if (cart.cart_total >= DISCOUNT_THRESHOLD) {
            recoveryCode = `CART-${cart.id.slice(-6).toUpperCase()}-${Date.now()}`

            try {
              const promotionModule = container.resolve(Modules.PROMOTION) as any
              const discountMXN = Math.round(cart.cart_total * 0.1) / 100

              await promotionModule.createPromotions([
                {
                  code: recoveryCode,
                  type: "standard",
                  is_automatic: false,
                  status: "active",
                  application_method: {
                    type: "percentage",
                    value: 10,
                    target_type: "order",
                    allocation: "total",
                    currency_code: "mxn",
                    max_quantity: 1,
                  },
                  rules: [],
                },
              ])

              discountText = `10% de descuento con codigo ${recoveryCode}`
            } catch (promoErr: any) {
              logger.error(
                `[Cart Recovery] Failed to create discount for cart ${cart.cart_id}: ${promoErr.message || promoErr}`
              )
              // Still send message without discount
            }
          }

          await whatsapp.sendTemplate(
            cart.phone,
            TEMPLATE_CART_REMINDER_3,
            "es_MX",
            [firstName, discountText, recoveryUrl]
          )

          await abandonedCart.updateAbandonedCarts({
            id: cart.id,
            recovery_status: "reminded_3",
            message_3_sent_at: new Date(),
            ...(recoveryCode ? { recovery_code: recoveryCode } : {}),
          })

          messagesSent++
          logger.info(
            `[Cart Recovery] Message 3 sent to ${cart.phone} for cart ${cart.cart_id}${recoveryCode ? ` with code ${recoveryCode}` : ""}`
          )
        }

        // Expiry: 48+ hours after last activity, status = reminded_3
        if (
          cart.recovery_status === "reminded_3" &&
          elapsed >= FORTY_EIGHT_HOURS
        ) {
          await abandonedCart.updateAbandonedCarts({
            id: cart.id,
            recovery_status: "expired",
          })
        }
      } catch (cartErr: any) {
        logger.error(
          `[Cart Recovery] Failed to process cart ${cart.cart_id}: ${cartErr.message || cartErr}`
        )
      }
    }

    if (messagesSent > 0) {
      logger.info(
        `[Cart Recovery] Job complete: ${messagesSent} message(s) sent`
      )
    }
  } catch (error: any) {
    logger.error(
      `[Cart Recovery] Job failed: ${error.message || error}`
    )
  }
}

export const config = {
  name: "cart-abandonment-recovery",
  schedule: "*/10 * * * *",
}
