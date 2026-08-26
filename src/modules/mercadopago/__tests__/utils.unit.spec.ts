import { PaymentSessionStatus } from "@medusajs/framework/utils"
import crypto from "crypto"
import {
  mapMPStatusToMedusa,
  resolveMPPaymentSessionStatus,
  isOxxoPayment,
  isOfflinePayment,
  validateOxxoAmount,
  getOxxoExpirationDate,
  buildMercadoPagoSignatureManifest,
  parseMercadoPagoSignature,
  validateMercadoPagoWebhookSignature,
} from "../utils"

describe("MercadoPago utils", () => {
  describe("mapMPStatusToMedusa", () => {
    it("maps 'approved' to AUTHORIZED", () => {
      expect(mapMPStatusToMedusa("approved")).toBe(
        PaymentSessionStatus.AUTHORIZED
      )
    })

    it("maps 'authorized' to AUTHORIZED", () => {
      expect(mapMPStatusToMedusa("authorized")).toBe(
        PaymentSessionStatus.AUTHORIZED
      )
    })

    it("maps 'pending' to PENDING", () => {
      expect(mapMPStatusToMedusa("pending")).toBe(
        PaymentSessionStatus.PENDING
      )
    })

    it("maps 'in_process' to PENDING", () => {
      expect(mapMPStatusToMedusa("in_process")).toBe(
        PaymentSessionStatus.PENDING
      )
    })

    it("maps 'in_mediation' to PENDING", () => {
      expect(mapMPStatusToMedusa("in_mediation")).toBe(
        PaymentSessionStatus.PENDING
      )
    })

    it("maps 'rejected' to ERROR", () => {
      expect(mapMPStatusToMedusa("rejected")).toBe(
        PaymentSessionStatus.ERROR
      )
    })

    it("maps 'cancelled' to CANCELED", () => {
      expect(mapMPStatusToMedusa("cancelled")).toBe(
        PaymentSessionStatus.CANCELED
      )
    })

    it("maps 'refunded' to CANCELED", () => {
      expect(mapMPStatusToMedusa("refunded")).toBe(
        PaymentSessionStatus.CANCELED
      )
    })

    it("maps 'charged_back' to CANCELED", () => {
      expect(mapMPStatusToMedusa("charged_back")).toBe(
        PaymentSessionStatus.CANCELED
      )
    })

    it("maps unknown status to PENDING", () => {
      expect(mapMPStatusToMedusa("unknown_status")).toBe(
        PaymentSessionStatus.PENDING
      )
    })
  })

  describe("resolveMPPaymentSessionStatus", () => {
    it("keeps pending card payments pending", () => {
      expect(
        resolveMPPaymentSessionStatus("pending", {
          payment_method_id: "visa",
        })
      ).toBe(PaymentSessionStatus.PENDING)
    })

    it("authorizes pending OXXO sessions technically for order creation", () => {
      expect(
        resolveMPPaymentSessionStatus("pending", {
          payment_method_id: "oxxo",
        })
      ).toBe(PaymentSessionStatus.AUTHORIZED)
    })

    it("authorizes pending SPEI sessions technically for order creation", () => {
      expect(
        resolveMPPaymentSessionStatus("pending", {
          payment_method_id: "spei",
        })
      ).toBe(PaymentSessionStatus.AUTHORIZED)
    })

    it("keeps rejected offline payments as errors", () => {
      expect(
        resolveMPPaymentSessionStatus("rejected", {
          payment_method_id: "oxxo",
        })
      ).toBe(PaymentSessionStatus.ERROR)
    })

    it("marks approved captured card payments as captured", () => {
      expect(
        resolveMPPaymentSessionStatus("approved", {
          payment_method_id: "visa",
          payment_type_id: "credit_card",
          captured: true,
        })
      ).toBe(PaymentSessionStatus.CAPTURED)
    })

    it("keeps approved non-captured card payments authorized", () => {
      expect(
        resolveMPPaymentSessionStatus("approved", {
          payment_method_id: "visa",
          payment_type_id: "credit_card",
          captured: false,
        })
      ).toBe(PaymentSessionStatus.AUTHORIZED)
    })
  })

  describe("isOxxoPayment", () => {
    it("returns true for OXXO payment method", () => {
      expect(isOxxoPayment({ payment_method_id: "oxxo" })).toBe(true)
    })

    it("returns false for card payment method", () => {
      expect(isOxxoPayment({ payment_method_id: "visa" })).toBe(false)
    })

    it("returns false for SPEI payment method", () => {
      expect(isOxxoPayment({ payment_method_id: "spei" })).toBe(false)
    })

    it("returns false for undefined data", () => {
      expect(isOxxoPayment(undefined)).toBe(false)
    })

    it("returns false for empty data", () => {
      expect(isOxxoPayment({})).toBe(false)
    })
  })

  describe("isOfflinePayment", () => {
    it("returns true for OXXO", () => {
      expect(isOfflinePayment({ payment_method_id: "oxxo" })).toBe(true)
    })

    it("returns true for SPEI", () => {
      expect(isOfflinePayment({ payment_method_id: "spei" })).toBe(true)
    })

    it("returns false for card payments", () => {
      expect(isOfflinePayment({ payment_method_id: "visa" })).toBe(false)
    })

    it("returns false for undefined data", () => {
      expect(isOfflinePayment(undefined)).toBe(false)
    })
  })

  describe("validateOxxoAmount", () => {
    it("does not throw for amounts within limit", () => {
      expect(() => validateOxxoAmount(5000)).not.toThrow()
      expect(() => validateOxxoAmount(10000)).not.toThrow()
      expect(() => validateOxxoAmount(1)).not.toThrow()
    })

    it("throws for amounts exceeding $10,000 MXN", () => {
      expect(() => validateOxxoAmount(10001)).toThrow(
        "OXXO payments cannot exceed"
      )
      expect(() => validateOxxoAmount(15000)).toThrow(
        "OXXO payments cannot exceed"
      )
    })
  })

  describe("getOxxoExpirationDate", () => {
    it("returns a date ~72 hours in the future", () => {
      const before = new Date()
      const result = getOxxoExpirationDate()
      const expirationDate = new Date(result)
      const after = new Date()

      // 72 hours = 259200000 ms
      const expectedMin = before.getTime() + 72 * 60 * 60 * 1000
      const expectedMax = after.getTime() + 72 * 60 * 60 * 1000

      expect(expirationDate.getTime()).toBeGreaterThanOrEqual(expectedMin)
      expect(expirationDate.getTime()).toBeLessThanOrEqual(expectedMax)
    })

    it("returns a valid ISO date string", () => {
      const result = getOxxoExpirationDate()
      const parsed = new Date(result)
      expect(parsed.toISOString()).toBe(result)
    })
  })

  describe("Mercado Pago webhook signatures", () => {
    const secret = "webhook-secret"
    const dataId = "123ABC"
    const requestId = "req_123"
    const ts = "1704908010"

    it("builds the official signature manifest", () => {
      expect(
        buildMercadoPagoSignatureManifest({
          dataId,
          requestId,
          timestamp: ts,
        })
      ).toBe("id:123abc;request-id:req_123;ts:1704908010;")
    })

    it("parses x-signature header parts", () => {
      expect(parseMercadoPagoSignature(`ts=${ts},v1=abc123`)).toEqual({
        ts,
        v1: "abc123",
      })
    })

    it("validates a correct x-signature", () => {
      const manifest = buildMercadoPagoSignatureManifest({
        dataId,
        requestId,
        timestamp: ts,
      })
      const v1 = crypto
        .createHmac("sha256", secret)
        .update(manifest)
        .digest("hex")

      expect(
        validateMercadoPagoWebhookSignature({
          secret,
          dataId,
          headers: {
            "x-signature": `ts=${ts},v1=${v1}`,
            "x-request-id": requestId,
          },
        })
      ).toBe(true)
    })

    it("rejects an incorrect x-signature", () => {
      expect(
        validateMercadoPagoWebhookSignature({
          secret,
          dataId,
          headers: {
            "x-signature": `ts=${ts},v1=bad`,
            "x-request-id": requestId,
          },
        })
      ).toBe(false)
    })

    it("rejects missing signature data", () => {
      expect(
        validateMercadoPagoWebhookSignature({
          secret,
          dataId,
          headers: {},
        })
      ).toBe(false)
    })
  })
})
