import {
  AbstractPaymentProvider,
  BigNumber,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import crypto from "crypto"
import { MercadoPagoConfig, Payment, PaymentRefund } from "mercadopago"
import type { MercadoPagoOptions, MercadoPagoPaymentData } from "./types"
import {
  mapMPStatusToMedusa,
  isOxxoPayment,
  isOfflinePayment,
  validateOxxoAmount,
  getOxxoExpirationDate,
} from "./utils"

type InjectedDependencies = {
  logger: { info: (...args: any[]) => void; error: (...args: any[]) => void }
}

class MercadoPagoProviderService extends AbstractPaymentProvider<MercadoPagoOptions> {
  static identifier = "mercadopago"

  protected logger_: InjectedDependencies["logger"]
  protected options_: MercadoPagoOptions
  protected client_: MercadoPagoConfig
  protected payment_: Payment
  protected refund_: PaymentRefund

  static validateOptions(options: Record<any, any>): void | never {
    if (!options.accessToken) {
      throw new Error(
        "Required option `accessToken` is missing in MercadoPago provider options."
      )
    }
  }

  constructor(container: InjectedDependencies, options: MercadoPagoOptions) {
    super(container, options)

    this.logger_ = container.logger
    this.options_ = options

    this.client_ = new MercadoPagoConfig({
      accessToken: options.accessToken,
    })
    this.payment_ = new Payment(this.client_)
    this.refund_ = new PaymentRefund(this.client_)
  }

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    const { amount, currency_code, data, context } = input
    const paymentMethodId = data?.payment_method_id as string | undefined
    const amountNumber = Number(amount)

    // OXXO amount validation
    if (paymentMethodId === "oxxo") {
      validateOxxoAmount(amountNumber)
    }

    const sessionId = data?.session_id as string | undefined

    const paymentBody: Record<string, unknown> = {
      transaction_amount: amountNumber,
      description: (data?.description as string) || "Sicaru Payment",
      payer: {
        email:
          (data?.payer_email as string) ||
          context?.customer?.email ||
          "customer@example.com",
        ...(data?.payer_identification
          ? { identification: data.payer_identification }
          : {}),
      },
      metadata: {
        session_id: sessionId,
      },
    }

    // Card payments require a token from the frontend
    if (data?.token) {
      paymentBody.token = data.token
      paymentBody.payment_method_id = paymentMethodId
      paymentBody.installments = (data?.installments as number) || 1
      // Cards use manual capture by default so admin can review
      paymentBody.capture = false
    } else if (
      paymentMethodId === "oxxo" ||
      paymentMethodId === "spei" ||
      paymentMethodId === "clabe" ||
      paymentMethodId === "bancomer" ||
      paymentMethodId === "banamex"
    ) {
      // Map "spei" convenience name to the actual MP payment method ID
      paymentBody.payment_method_id =
        paymentMethodId === "spei" ? "clabe" : paymentMethodId
      // Set expiration for offline payments
      paymentBody.date_of_expiration = getOxxoExpirationDate()
    }

    // Optional notification URL for webhooks
    if (data?.notification_url) {
      paymentBody.notification_url = data.notification_url as string
    }

    try {
      const idempotencyKey =
        (context?.idempotency_key as string) || crypto.randomUUID()
      const mpPayment = await this.payment_.create({
        body: paymentBody as any,
        requestOptions: { idempotencyKey },
      })

      const responseData: MercadoPagoPaymentData = {
        id: mpPayment.id!,
        payment_method_id: mpPayment.payment_method_id,
        payment_type_id: mpPayment.payment_type_id,
        mp_status: mpPayment.status,
        transaction_amount: mpPayment.transaction_amount,
        currency_id: mpPayment.currency_id,
        session_id: sessionId,
      }

      // For OXXO: extract voucher/barcode data
      if (paymentMethodId === "oxxo") {
        responseData.voucher_url =
          mpPayment.transaction_details?.external_resource_url
        responseData.barcode =
          mpPayment.transaction_details?.barcode?.content
        responseData.reference =
          mpPayment.point_of_interaction?.transaction_data?.ticket_url
        responseData.expiration_date = mpPayment.date_of_expiration
      }

      // For SPEI: extract transfer URL
      if (paymentMethodId === "spei") {
        responseData.voucher_url =
          mpPayment.transaction_details?.external_resource_url
        responseData.expiration_date = mpPayment.date_of_expiration
      }

      return {
        id: String(mpPayment.id),
        status: mapMPStatusToMedusa(mpPayment.status || "pending"),
        data: responseData as unknown as Record<string, unknown>,
      }
    } catch (error: any) {
      const detail = error.cause
        ? JSON.stringify(error.cause)
        : JSON.stringify(error, Object.getOwnPropertyNames(error))
      this.logger_.error(`MercadoPago initiatePayment error detail: ${detail}`)
      throw new Error(
        `MercadoPago initiatePayment failed: ${detail}`
      )
    }
  }

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    const mpPaymentId = input.data?.id as string | number | undefined

    if (!mpPaymentId) {
      return { status: PaymentSessionStatus.PENDING, data: input.data }
    }

    try {
      const mpPayment = await this.payment_.get({ id: String(mpPaymentId) })
      const status = mapMPStatusToMedusa(mpPayment.status || "pending")

      return {
        status,
        data: {
          ...(input.data || {}),
          mp_status: mpPayment.status,
        },
      }
    } catch (error: any) {
      throw new Error(
        `MercadoPago authorizePayment failed: ${error.message || error}`
      )
    }
  }

  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    const mpPaymentId = input.data?.id as string | number | undefined

    if (!mpPaymentId) {
      throw new Error("No MercadoPago payment ID to capture")
    }

    // Offline payments (OXXO/SPEI) auto-capture when customer pays
    if (isOfflinePayment(input.data)) {
      return { data: input.data }
    }

    try {
      const captured = await this.payment_.capture({
        id: String(mpPaymentId),
      })

      return {
        data: {
          ...(input.data || {}),
          mp_status: captured.status,
          captured: true,
        },
      }
    } catch (error: any) {
      throw new Error(
        `MercadoPago capturePayment failed: ${error.message || error}`
      )
    }
  }

  async refundPayment(
    input: RefundPaymentInput
  ): Promise<RefundPaymentOutput> {
    const mpPaymentId = input.data?.id as string | number | undefined

    if (!mpPaymentId) {
      throw new Error("No MercadoPago payment ID to refund")
    }

    // OXXO payments cannot be refunded through the API
    if (isOxxoPayment(input.data)) {
      throw new Error(
        "OXXO payments cannot be refunded automatically. " +
          "A manual bank transfer refund is required. " +
          "Please contact the customer for their bank details."
      )
    }

    try {
      const refundAmount = Number(input.amount)
      const refundResult = await this.refund_.create({
        payment_id: Number(mpPaymentId),
        body: { amount: refundAmount },
      })

      return {
        data: {
          ...(input.data || {}),
          mp_status: "refunded",
          refund_id: refundResult.id,
        },
      }
    } catch (error: any) {
      throw new Error(
        `MercadoPago refundPayment failed: ${error.message || error}`
      )
    }
  }

  async cancelPayment(
    input: CancelPaymentInput
  ): Promise<CancelPaymentOutput> {
    const mpPaymentId = input.data?.id as string | number | undefined

    if (!mpPaymentId) {
      return { data: input.data }
    }

    try {
      await this.payment_.cancel({ id: String(mpPaymentId) })

      return {
        data: {
          ...(input.data || {}),
          mp_status: "cancelled",
        },
      }
    } catch (error: any) {
      // If already cancelled, don't throw
      this.logger_.error(
        `MercadoPago cancelPayment error: ${error.message || error}`
      )
      return { data: input.data }
    }
  }

  async deletePayment(
    input: DeletePaymentInput
  ): Promise<DeletePaymentOutput> {
    return this.cancelPayment(input)
  }

  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    const mpPaymentId = input.data?.id as string | number | undefined

    if (!mpPaymentId) {
      return { data: input.data }
    }

    try {
      const mpPayment = await this.payment_.get({ id: String(mpPaymentId) })

      return {
        data: {
          ...(input.data || {}),
          mp_status: mpPayment.status,
          transaction_amount: mpPayment.transaction_amount,
          payment_method_id: mpPayment.payment_method_id,
          status_detail: mpPayment.status_detail,
        },
      }
    } catch (error: any) {
      throw new Error(
        `MercadoPago retrievePayment failed: ${error.message || error}`
      )
    }
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const mpPaymentId = input.data?.id as string | number | undefined

    if (!mpPaymentId) {
      return { status: PaymentSessionStatus.PENDING }
    }

    try {
      const mpPayment = await this.payment_.get({ id: String(mpPaymentId) })
      return { status: mapMPStatusToMedusa(mpPayment.status || "pending") }
    } catch (error: any) {
      throw new Error(
        `MercadoPago getPaymentStatus failed: ${error.message || error}`
      )
    }
  }

  async updatePayment(
    input: UpdatePaymentInput
  ): Promise<UpdatePaymentOutput> {
    // MP doesn't support updating payment amounts directly.
    // Return current data without changes — a new payment session
    // will be created if the amount changes significantly.
    return {
      data: input.data,
      status: (input.data?.mp_status
        ? mapMPStatusToMedusa(input.data.mp_status as string)
        : undefined),
    }
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const { data, rawData, headers } = payload
    const webhookData = data as Record<string, any>

    // MP webhook sends { action: "payment.updated", data: { id: "123" } }
    // or { type: "payment", data: { id: "123" } }
    const paymentId =
      webhookData?.data?.id || webhookData?.id

    if (!paymentId) {
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    try {
      // Fetch full payment details from MP
      const mpPayment = await this.payment_.get({ id: String(paymentId) })

      const sessionId = mpPayment.metadata?.session_id as string | undefined

      if (!sessionId) {
        this.logger_.info(
          `MercadoPago webhook: no session_id in metadata for payment ${paymentId}`
        )
        return { action: PaymentActions.NOT_SUPPORTED }
      }

      const amount = new BigNumber(mpPayment.transaction_amount || 0)

      switch (mpPayment.status) {
        case "approved":
          // For offline payments (OXXO/SPEI), the payment is captured
          // immediately when the customer pays. For cards, it's authorized.
          if (
            mpPayment.payment_type_id === "ticket" ||
            mpPayment.payment_type_id === "bank_transfer"
          ) {
            return {
              action: PaymentActions.SUCCESSFUL,
              data: { session_id: sessionId, amount },
            }
          }
          return {
            action: PaymentActions.AUTHORIZED,
            data: { session_id: sessionId, amount },
          }

        case "authorized":
          return {
            action: PaymentActions.AUTHORIZED,
            data: { session_id: sessionId, amount },
          }

        case "pending":
        case "in_process":
        case "in_mediation":
          return {
            action: PaymentActions.PENDING,
            data: { session_id: sessionId, amount },
          }

        case "rejected":
          return {
            action: PaymentActions.FAILED,
            data: { session_id: sessionId, amount },
          }

        case "cancelled":
          return {
            action: PaymentActions.CANCELED,
            data: { session_id: sessionId, amount },
          }

        case "refunded":
        case "charged_back":
          return {
            action: PaymentActions.CANCELED,
            data: { session_id: sessionId, amount },
          }

        default:
          return { action: PaymentActions.NOT_SUPPORTED }
      }
    } catch (error: any) {
      this.logger_.error(
        `MercadoPago webhook error: ${error.message || error}`
      )
      return {
        action: PaymentActions.FAILED,
        data: {
          session_id: "",
          amount: new BigNumber(0),
        },
      }
    }
  }
}

export default MercadoPagoProviderService
