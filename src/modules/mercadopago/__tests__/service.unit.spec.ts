import crypto from "crypto"
import { PaymentActions, PaymentSessionStatus } from "@medusajs/framework/utils"
import MercadoPagoProviderService from "../service"

const createMock = jest.fn()
const getMock = jest.fn()
const captureMock = jest.fn()

jest.mock("mercadopago", () => ({
  MercadoPagoConfig: jest.fn().mockImplementation((config) => config),
  Payment: jest.fn().mockImplementation(() => ({
    create: createMock,
    get: getMock,
    capture: captureMock,
  })),
  PaymentRefund: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
  })),
}))

const logger = {
  info: jest.fn(),
  error: jest.fn(),
}

const WEBHOOK_SECRET = "webhook-secret"

function createProvider(options: Record<string, unknown> = {}) {
  return new MercadoPagoProviderService({ logger }, {
    accessToken: "TEST-token",
    sandbox: true,
    ...options,
  })
}

function signWebhook(paymentId: string, requestId = "req_123", ts = "1704908010") {
  const manifest = `id:${paymentId.toLowerCase()};request-id:${requestId};ts:${ts};`
  const v1 = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(manifest)
    .digest("hex")

  return {
    "x-signature": `ts=${ts},v1=${v1}`,
    "x-request-id": requestId,
  }
}

function webhookPayload(
  paymentId: string,
  headers: Record<string, unknown> = signWebhook(paymentId)
) {
  return {
    data: {
      action: "payment.updated",
      type: "payment",
      data: { id: paymentId },
    },
    rawData: JSON.stringify({ data: { id: paymentId } }),
    headers,
  }
}

describe("MercadoPago provider", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("creates card payments with automatic capture", async () => {
    createMock.mockResolvedValueOnce({
      id: 123,
      payment_method_id: "visa",
      payment_type_id: "credit_card",
      status: "approved",
      status_detail: "accredited",
      transaction_amount: 98.6,
      currency_id: "MXN",
      captured: true,
    })

    const result = await createProvider().initiatePayment({
      amount: 98.6,
      currency_code: "mxn",
      data: {
        token: "card-token",
        payment_method_id: "visa",
        installments: 1,
        payer_email: "test@example.com",
        session_id: "payses_test",
      },
      context: {},
    } as any)

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          token: "card-token",
          payment_method_id: "visa",
          capture: true,
          external_reference: "payses_test",
          metadata: expect.objectContaining({
            session_id: "payses_test",
            medusa_payment_session_id: "payses_test",
          }),
        }),
      })
    )
    expect(result.status).toBe(PaymentSessionStatus.CAPTURED)
    expect(result.data).toEqual(
      expect.objectContaining({
        id: 123,
        mp_status: "approved",
        status_detail: "accredited",
        captured: true,
      })
    )
  })

  it("keeps rejected card payments as errors", async () => {
    createMock.mockResolvedValueOnce({
      id: 124,
      payment_method_id: "visa",
      payment_type_id: "credit_card",
      status: "rejected",
      status_detail: "cc_rejected_other_reason",
      transaction_amount: 98.6,
      currency_id: "MXN",
      captured: false,
    })

    const result = await createProvider().initiatePayment({
      amount: 98.6,
      currency_code: "mxn",
      data: {
        token: "card-token",
        payment_method_id: "visa",
      },
      context: {},
    } as any)

    expect(result.status).toBe(PaymentSessionStatus.ERROR)
    expect(result.data).toEqual(
      expect.objectContaining({
        mp_status: "rejected",
        captured: false,
      })
    )
  })

  it("does not capture again when payment data is already captured", async () => {
    const data = {
      id: 123,
      payment_method_id: "visa",
      payment_type_id: "credit_card",
      mp_status: "approved",
      captured: true,
    }

    const result = await createProvider().capturePayment({ data } as any)

    expect(getMock).not.toHaveBeenCalled()
    expect(captureMock).not.toHaveBeenCalled()
    expect(result.data).toBe(data)
  })

  it("does not capture again when Mercado Pago already reports captured", async () => {
    getMock.mockResolvedValueOnce({
      id: 123,
      payment_method_id: "visa",
      payment_type_id: "credit_card",
      status: "approved",
      status_detail: "accredited",
      transaction_amount: 98.6,
      currency_id: "MXN",
      captured: true,
    })

    const result = await createProvider().capturePayment({
      data: {
        id: 123,
        payment_method_id: "visa",
        payment_type_id: "credit_card",
      },
    } as any)

    expect(captureMock).not.toHaveBeenCalled()
    expect(result.data).toEqual(
      expect.objectContaining({
        mp_status: "approved",
        status_detail: "accredited",
        captured: true,
      })
    )
  })

  it("keeps OXXO pending without card capture", async () => {
    createMock.mockResolvedValueOnce({
      id: 125,
      payment_method_id: "oxxo",
      payment_type_id: "ticket",
      status: "pending",
      status_detail: "pending_waiting_payment",
      transaction_amount: 98.6,
      currency_id: "MXN",
      captured: false,
      transaction_details: {
        external_resource_url: "https://sandbox.mercadopago.test/voucher",
        barcode: { content: "1234567890" },
      },
      point_of_interaction: {
        transaction_data: { ticket_url: "https://sandbox.mercadopago.test/ticket" },
      },
      date_of_expiration: "2026-08-25T00:00:00.000Z",
    })

    const result = await createProvider().initiatePayment({
      amount: 98.6,
      currency_code: "mxn",
      data: {
        payment_method_id: "oxxo",
      },
      context: {},
    } as any)

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.not.objectContaining({
          capture: expect.any(Boolean),
        }),
      })
    )
    expect(result.status).toBe(PaymentSessionStatus.AUTHORIZED)
    expect(result.data).toEqual(
      expect.objectContaining({
        payment_method_id: "oxxo",
        mp_status: "pending",
        captured: false,
        voucher_url: "https://sandbox.mercadopago.test/voucher",
        barcode: "1234567890",
      })
    )
  })

  it("keeps SPEI pending without card capture", async () => {
    createMock.mockResolvedValueOnce({
      id: 126,
      payment_method_id: "clabe",
      payment_type_id: "bank_transfer",
      status: "pending",
      status_detail: "pending_waiting_transfer",
      transaction_amount: 98.6,
      currency_id: "MXN",
      captured: false,
      transaction_details: {
        external_resource_url: "https://sandbox.mercadopago.test/spei",
      },
      date_of_expiration: "2026-08-25T00:00:00.000Z",
    })

    const result = await createProvider().initiatePayment({
      amount: 98.6,
      currency_code: "mxn",
      data: {
        payment_method_id: "spei",
      },
      context: {},
    } as any)

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          payment_method_id: "clabe",
        }),
      })
    )
    expect(result.status).toBe(PaymentSessionStatus.AUTHORIZED)
    expect(result.data).toEqual(
      expect.objectContaining({
        payment_method_id: "clabe",
        mp_status: "pending",
        captured: false,
        voucher_url: "https://sandbox.mercadopago.test/spei",
      })
    )
  })

  it("accepts a valid Mercado Pago webhook signature", async () => {
    getMock.mockResolvedValueOnce({
      id: 127,
      payment_method_id: "visa",
      payment_type_id: "credit_card",
      status: "approved",
      status_detail: "accredited",
      transaction_amount: 98.6,
      captured: true,
      metadata: { session_id: "payses_test" },
    })

    const result = await createProvider({
      webhookSecret: WEBHOOK_SECRET,
    }).getWebhookActionAndData(webhookPayload("127") as any)

    expect(result.action).toBe(PaymentActions.SUCCESSFUL)
    expect(result.data).toEqual(
      expect.objectContaining({
        session_id: "payses_test",
      })
    )
  })

  it("ignores an invalid Mercado Pago webhook signature", async () => {
    const result = await createProvider({
      webhookSecret: WEBHOOK_SECRET,
    }).getWebhookActionAndData(
      webhookPayload("127", {
        "x-signature": "ts=1704908010,v1=bad",
        "x-request-id": "req_123",
      }) as any
    )

    expect(result.action).toBe(PaymentActions.NOT_SUPPORTED)
    expect(getMock).not.toHaveBeenCalled()
  })

  it("ignores a Mercado Pago webhook with missing signature headers", async () => {
    const result = await createProvider({
      webhookSecret: WEBHOOK_SECRET,
    }).getWebhookActionAndData(webhookPayload("127", {}) as any)

    expect(result.action).toBe(PaymentActions.NOT_SUPPORTED)
    expect(getMock).not.toHaveBeenCalled()
  })

  it("fails safely when Mercado Pago payment id is unknown", async () => {
    getMock.mockRejectedValueOnce(new Error("not found"))

    const result = await createProvider({
      webhookSecret: WEBHOOK_SECRET,
    }).getWebhookActionAndData(webhookPayload("404") as any)

    expect(result.action).toBe(PaymentActions.FAILED)
    expect(result.data).toEqual(
      expect.objectContaining({
        session_id: "",
      })
    )
  })

  it("maps card approved webhooks to captured actions", async () => {
    getMock.mockResolvedValueOnce({
      id: 128,
      payment_method_id: "visa",
      payment_type_id: "credit_card",
      status: "approved",
      status_detail: "accredited",
      transaction_amount: 98.6,
      captured: true,
      external_reference: "payses_card",
      metadata: {},
    })

    const result = await createProvider({
      webhookSecret: WEBHOOK_SECRET,
    }).getWebhookActionAndData(webhookPayload("128") as any)

    expect(result.action).toBe(PaymentActions.SUCCESSFUL)
    expect(result.data?.session_id).toBe("payses_card")
  })

  it("maps card rejected webhooks to failed actions", async () => {
    getMock.mockResolvedValueOnce({
      id: 129,
      payment_method_id: "visa",
      payment_type_id: "credit_card",
      status: "rejected",
      status_detail: "cc_rejected_other_reason",
      transaction_amount: 98.6,
      captured: false,
      external_reference: "payses_rejected",
      metadata: {},
    })

    const result = await createProvider({
      webhookSecret: WEBHOOK_SECRET,
    }).getWebhookActionAndData(webhookPayload("129") as any)

    expect(result.action).toBe(PaymentActions.FAILED)
    expect(result.data?.session_id).toBe("payses_rejected")
  })

  it("keeps OXXO pending webhooks pending", async () => {
    getMock.mockResolvedValueOnce({
      id: 130,
      payment_method_id: "oxxo",
      payment_type_id: "ticket",
      status: "pending",
      status_detail: "pending_waiting_payment",
      transaction_amount: 98.6,
      captured: false,
      external_reference: "payses_oxxo",
      metadata: {},
    })

    const result = await createProvider({
      webhookSecret: WEBHOOK_SECRET,
    }).getWebhookActionAndData(webhookPayload("130") as any)

    expect(result.action).toBe(PaymentActions.PENDING)
    expect(result.data?.session_id).toBe("payses_oxxo")
  })

  it("maps OXXO pending to approved webhooks to captured actions", async () => {
    getMock.mockResolvedValueOnce({
      id: 131,
      payment_method_id: "oxxo",
      payment_type_id: "ticket",
      status: "approved",
      status_detail: "accredited",
      transaction_amount: 98.6,
      captured: true,
      external_reference: "payses_oxxo_paid",
      metadata: {},
      transaction_details: {
        external_resource_url: "https://sandbox.mercadopago.test/voucher",
        barcode: { content: "1234567890" },
      },
      date_of_expiration: "2026-08-25T00:00:00.000Z",
    })

    const result = await createProvider({
      webhookSecret: WEBHOOK_SECRET,
    }).getWebhookActionAndData(webhookPayload("131") as any)

    expect(result.action).toBe(PaymentActions.SUCCESSFUL)
    expect(result.data?.session_id).toBe("payses_oxxo_paid")
  })

  it("maps OXXO expired or cancelled webhooks to canceled actions", async () => {
    getMock.mockResolvedValueOnce({
      id: 132,
      payment_method_id: "oxxo",
      payment_type_id: "ticket",
      status: "cancelled",
      status_detail: "expired",
      transaction_amount: 98.6,
      captured: false,
      external_reference: "payses_oxxo_expired",
      metadata: {},
    })

    const result = await createProvider({
      webhookSecret: WEBHOOK_SECRET,
    }).getWebhookActionAndData(webhookPayload("132") as any)

    expect(result.action).toBe(PaymentActions.CANCELED)
    expect(result.data?.session_id).toBe("payses_oxxo_expired")
  })

  it("processes duplicate webhooks idempotently", async () => {
    const mpPayment = {
      id: 133,
      payment_method_id: "visa",
      payment_type_id: "credit_card",
      status: "approved",
      status_detail: "accredited",
      transaction_amount: 98.6,
      captured: true,
      external_reference: "payses_duplicate",
      metadata: {},
    }
    getMock.mockResolvedValueOnce(mpPayment).mockResolvedValueOnce(mpPayment)

    const provider = createProvider({ webhookSecret: WEBHOOK_SECRET })
    const first = await provider.getWebhookActionAndData(webhookPayload("133") as any)
    const second = await provider.getWebhookActionAndData(webhookPayload("133") as any)

    expect(first).toEqual(second)
    expect(captureMock).not.toHaveBeenCalled()
  })

  it("fails safely when Mercado Pago payment API fails", async () => {
    getMock.mockRejectedValueOnce(new Error("Mercado Pago unavailable"))

    const result = await createProvider({
      webhookSecret: WEBHOOK_SECRET,
    }).getWebhookActionAndData(webhookPayload("134") as any)

    expect(result.action).toBe(PaymentActions.FAILED)
    expect(logger.error).toHaveBeenCalled()
  })

  it("correlates webhook payments without storefront metadata.session_id", async () => {
    getMock.mockResolvedValueOnce({
      id: 135,
      payment_method_id: "visa",
      payment_type_id: "credit_card",
      status: "approved",
      status_detail: "accredited",
      transaction_amount: 98.6,
      captured: true,
      external_reference: "payses_external_reference",
      metadata: {},
    })

    const result = await createProvider({
      webhookSecret: WEBHOOK_SECRET,
    }).getWebhookActionAndData(webhookPayload("135") as any)

    expect(result.action).toBe(PaymentActions.SUCCESSFUL)
    expect(result.data?.session_id).toBe("payses_external_reference")
  })
})
