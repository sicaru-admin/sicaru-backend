import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { WHATSAPP_MODULE } from "../../../modules/whatsapp"

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
        }
      }
    }
  } catch {
    // Non-critical — log only
  }
}
