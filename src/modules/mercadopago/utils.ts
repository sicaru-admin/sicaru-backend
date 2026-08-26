import { PaymentSessionStatus } from "@medusajs/framework/utils"
import crypto from "crypto"
import {
  MercadoPagoStatus,
  OXXO_MAX_AMOUNT,
  OXXO_EXPIRATION_HOURS,
} from "./types"

/**
 * Maps a Mercado Pago payment status to a Medusa PaymentSessionStatus.
 */
export function mapMPStatusToMedusa(
  mpStatus: MercadoPagoStatus | string
): PaymentSessionStatus {
  switch (mpStatus) {
    case "approved":
      return PaymentSessionStatus.AUTHORIZED
    case "authorized":
      return PaymentSessionStatus.AUTHORIZED
    case "pending":
    case "in_process":
    case "in_mediation":
      return PaymentSessionStatus.PENDING
    case "rejected":
      return PaymentSessionStatus.ERROR
    case "cancelled":
      return PaymentSessionStatus.CANCELED
    case "refunded":
    case "charged_back":
      return PaymentSessionStatus.CANCELED
    default:
      return PaymentSessionStatus.PENDING
  }
}

/**
 * Resolve the technical Medusa session status while preserving the real
 * Mercado Pago financial status in session data. Offline payments such as
 * OXXO/SPEI are pending until the customer pays, but Medusa needs the payment
 * session to be authorized so it can create an order with the voucher.
 */
export function resolveMPPaymentSessionStatus(
  mpStatus: MercadoPagoStatus | string | undefined,
  data?: Record<string, unknown>
): PaymentSessionStatus {
  if (mpStatus === "approved" && data?.captured === true) {
    return PaymentSessionStatus.CAPTURED
  }

  if (
    isOfflinePayment(data) &&
    (mpStatus === "pending" || mpStatus === "in_process")
  ) {
    return PaymentSessionStatus.AUTHORIZED
  }

  return mapMPStatusToMedusa(mpStatus || "pending")
}

/**
 * Check if the payment method is OXXO.
 */
export function isOxxoPayment(
  data?: Record<string, unknown>
): boolean {
  return data?.payment_method_id === "oxxo"
}

/**
 * Check if the payment is an offline method (OXXO or SPEI).
 */
export function isOfflinePayment(
  data?: Record<string, unknown>
): boolean {
  const method = data?.payment_method_id as string | undefined
  return method === "oxxo" || method === "spei" || method === "clabe"
}

/**
 * Validate that the OXXO payment amount does not exceed the $10,000 MXN limit.
 * @param amount - Amount in MXN (currency units, not cents)
 * @throws Error if the amount exceeds the limit
 */
export function validateOxxoAmount(amount: number): void {
  if (amount > OXXO_MAX_AMOUNT) {
    throw new Error(
      `OXXO payments cannot exceed $${OXXO_MAX_AMOUNT.toLocaleString()} MXN. ` +
        `Received: $${amount.toLocaleString()} MXN.`
    )
  }
}

/**
 * Returns an ISO date string for the OXXO voucher expiration (72 hours from now).
 */
export function getOxxoExpirationDate(): string {
  const expiration = new Date()
  expiration.setHours(expiration.getHours() + OXXO_EXPIRATION_HOURS)
  return expiration.toISOString()
}

export function getHeaderValue(
  headers: Record<string, unknown> | undefined,
  name: string
): string | undefined {
  const lowerName = name.toLowerCase()
  const value = Object.entries(headers || {}).find(
    ([key]) => key.toLowerCase() === lowerName
  )?.[1]

  if (Array.isArray(value)) {
    return value[0] ? String(value[0]) : undefined
  }

  return value === undefined ? undefined : String(value)
}

export function parseMercadoPagoSignature(
  signature: string | undefined
): { ts?: string; v1?: string } {
  return (signature || "").split(",").reduce(
    (parts, part) => {
      const [key, ...valueParts] = part.split("=")
      const value = valueParts.join("=").trim()

      if (key?.trim() === "ts") {
        parts.ts = value
      }

      if (key?.trim() === "v1") {
        parts.v1 = value
      }

      return parts
    },
    {} as { ts?: string; v1?: string }
  )
}

export function buildMercadoPagoSignatureManifest({
  dataId,
  requestId,
  timestamp,
}: {
  dataId?: string
  requestId?: string
  timestamp: string
}): string {
  const parts: string[] = []

  if (dataId) {
    parts.push(`id:${dataId.toLowerCase()};`)
  }

  if (requestId) {
    parts.push(`request-id:${requestId};`)
  }

  parts.push(`ts:${timestamp};`)

  return parts.join("")
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex")
  const right = Buffer.from(b, "hex")

  if (left.length !== right.length) {
    return false
  }

  return crypto.timingSafeEqual(left, right)
}

export function validateMercadoPagoWebhookSignature({
  headers,
  dataId,
  secret,
}: {
  headers: Record<string, unknown>
  dataId?: string
  secret?: string
}): boolean {
  if (!secret || !dataId) {
    return false
  }

  const signature = getHeaderValue(headers, "x-signature")
  const requestId =
    getHeaderValue(headers, "x-request-id") ||
    getHeaderValue(headers, "request-id")
  const { ts, v1 } = parseMercadoPagoSignature(signature)

  if (!signature || !requestId || !ts || !v1) {
    return false
  }

  const manifest = buildMercadoPagoSignatureManifest({
    dataId,
    requestId,
    timestamp: ts,
  })
  const expected = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex")

  return timingSafeEqualHex(expected, v1)
}
