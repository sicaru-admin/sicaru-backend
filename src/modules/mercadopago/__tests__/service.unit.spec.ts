import { PaymentSessionStatus } from "@medusajs/framework/utils"
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

function createProvider() {
  return new MercadoPagoProviderService(logger, {
    accessToken: "TEST-token",
    sandbox: true,
  })
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
})
