import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { WHATSAPP_MODULE } from "../../../modules/whatsapp"
import { LOYALTY_MODULE } from "../../../modules/loyalty"
import { TIER_LABELS } from "../../../modules/loyalty/types"
import { ABANDONED_CART_MODULE } from "../../../modules/abandoned-cart"

// GET /webhooks/whatsapp — Meta webhook verification
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const mode = req.query["hub.mode"] as string
  const token = req.query["hub.verify_token"] as string
  const challenge = req.query["hub.challenge"] as string

  const whatsapp = req.scope.resolve(WHATSAPP_MODULE) as {
    getVerifyToken: () => string
  }
  const verifyToken = whatsapp.getVerifyToken()

  if (mode === "subscribe" && token === verifyToken) {
    res.status(200).send(challenge)
    return
  }

  res.status(403).json({ message: "Verification failed" })
}

// POST /webhooks/whatsapp — incoming messages from Meta
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve("logger") as {
    info: (...args: any[]) => void
  }

  // Meta requires 200 response within 5 seconds
  res.status(200).json({ status: "ok" })

  // Process webhook payload asynchronously
  try {
    const body = req.body as any
    const entries = body?.entry || []

    for (const entry of entries) {
      const changes = entry?.changes || []
      for (const change of changes) {
        const messages = change?.value?.messages || []
        for (const message of messages) {
          logger.info(
            `[WhatsApp Webhook] From: ${message.from}, Type: ${message.type}, Body: ${message.text?.body || "(non-text)"}`
          )

          // Handle cart opt-out keywords (NO / CANCELAR)
          if (message.type === "text") {
            const upperBody = message.text?.body?.toUpperCase().trim()
            if (upperBody === "NO" || upperBody === "CANCELAR") {
              try {
                const abandonedCartModule = req.scope.resolve(
                  ABANDONED_CART_MODULE
                ) as any
                const waService = req.scope.resolve(WHATSAPP_MODULE) as {
                  sendText: (to: string, text: string) => Promise<void>
                }

                const activeCarts =
                  await abandonedCartModule.listAbandonedCarts(
                    { phone: message.from, opted_out: false },
                    { order: { last_cart_activity: "DESC" }, take: 1 }
                  )

                if (activeCarts.length > 0) {
                  await abandonedCartModule.updateAbandonedCarts({
                    id: activeCarts[0].id,
                    opted_out: true,
                    recovery_status: "opted_out",
                  })
                  await waService.sendText(
                    message.from,
                    "Listo, no te enviaremos mas recordatorios sobre tu carrito."
                  )
                }
              } catch (err: any) {
                logger.info(
                  `[WhatsApp Webhook] Opt-out handling failed: ${err.message || err}`
                )
              }
            }
          }

          // Handle PUNTOS keyword
          if (
            message.type === "text" &&
            message.text?.body?.toUpperCase().trim() === "PUNTOS"
          ) {
            try {
              const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
              const loyalty = req.scope.resolve(LOYALTY_MODULE) as any
              const whatsapp = req.scope.resolve(WHATSAPP_MODULE) as {
                sendText: (to: string, text: string) => Promise<void>
              }

              // Look up customer by phone number
              const phone = message.from as string
              const { data: customers } = await query.graph({
                entity: "customer",
                fields: ["id", "first_name", "loyalty_account.*"],
                filters: { phone: phone },
              }) as { data: any[] }

              const customer = customers?.[0]
              if (!customer?.loyalty_account) {
                await whatsapp.sendText(
                  phone,
                  "Hola! No encontramos una cuenta de recompensas asociada a este numero. Visita sicaru.com/cuenta para registrarte."
                )
              } else {
                const acct = customer.loyalty_account as any
                const tierLabel = TIER_LABELS[acct.tier as keyof typeof TIER_LABELS] || "Sicaru"
                const valueMXN = Math.floor(acct.points_balance / 100) * 10

                await whatsapp.sendText(
                  phone,
                  `Hola ${customer.first_name || ""}! Tus Recompensas Sicaru:\n\n` +
                    `Puntos: ${acct.points_balance}\n` +
                    `Valor: $${valueMXN} MXN\n` +
                    `Nivel: ${tierLabel}\n` +
                    `Puntos acumulados: ${acct.lifetime_points}\n\n` +
                    `Visita sicaru.com/cuenta/recompensas para canjear tus puntos.`
                )
              }
            } catch (err: any) {
              logger.info(
                `[WhatsApp Webhook] PUNTOS lookup failed: ${err.message || err}`
              )
            }
          }
        }
      }
    }
  } catch {
    // Non-critical — log only
  }
}
