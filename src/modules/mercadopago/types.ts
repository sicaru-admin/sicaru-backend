export type MercadoPagoOptions = {
  accessToken: string
  publicKey?: string
  sandbox?: boolean
  webhookSecret?: string
}

export type MercadoPagoPaymentMethod =
  | "credit_card"
  | "debit_card"
  | "oxxo"
  | "spei"

export type MercadoPagoPaymentData = {
  /** Mercado Pago payment ID */
  id: string | number
  /** Payment method used */
  payment_method_id?: string
  /** Payment method type (credit_card, debit_card, ticket, bank_transfer) */
  payment_type_id?: string
  /** Current MP status */
  mp_status?: string
  /** OXXO/SPEI: URL for voucher or transfer instructions */
  voucher_url?: string
  /** OXXO: barcode data */
  barcode?: string
  /** OXXO: reference number for payment at store */
  reference?: string
  /** OXXO/SPEI: expiration date ISO string */
  expiration_date?: string
  /** Amount in currency units */
  transaction_amount?: number
  /** Currency code */
  currency_id?: string
  /** Medusa session ID stored in MP metadata */
  session_id?: string
}

/** Mercado Pago payment statuses */
export type MercadoPagoStatus =
  | "approved"
  | "pending"
  | "authorized"
  | "in_process"
  | "in_mediation"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back"

/** OXXO amount limit in MXN cents */
export const OXXO_MAX_AMOUNT = 10000

/** OXXO voucher validity in hours */
export const OXXO_EXPIRATION_HOURS = 72
