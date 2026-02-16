import { PaymentSessionStatus } from "@medusajs/framework/utils"
import {
  mapMPStatusToMedusa,
  isOxxoPayment,
  isOfflinePayment,
  validateOxxoAmount,
  getOxxoExpirationDate,
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
})
