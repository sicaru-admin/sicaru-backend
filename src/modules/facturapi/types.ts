// ─── Module options ────────────────────────────────────────────

export type FacturapiModuleOptions = {
  apiKey: string
  sandbox?: boolean
}

// ─── SAT / CFDI constants ─────────────────────────────────────

/** SAT product key for beauty / hair care products */
export const SAT_PRODUCT_KEY = "53111506"
/** SAT unit key: pieza (piece) */
export const SAT_UNIT_KEY = "H87"
/** SAT unit name */
export const SAT_UNIT_NAME = "Pieza"
/** Pago en una exhibición */
export const SAT_PAYMENT_METHOD = "PUE"
/** Mexican IVA rate */
export const SAT_IVA_RATE = 0.16
/** Currency code */
export const SAT_CURRENCY = "MXN"

// ─── SAT payment form mapping (MercadoPago → SAT) ─────────────

export const SAT_PAYMENT_FORMS = {
  EFECTIVO: "01",
  TRANSFERENCIA: "03",
  TARJETA_CREDITO: "04",
  TARJETA_DEBITO: "28",
  POR_DEFINIR: "99",
} as const

/**
 * Maps MercadoPago payment data to the SAT "forma de pago" code.
 */
export function mapPaymentToSATForm(
  paymentMethodId?: string,
  paymentTypeId?: string
): string {
  if (paymentMethodId === "oxxo") return SAT_PAYMENT_FORMS.EFECTIVO
  if (paymentMethodId === "spei" || paymentMethodId === "clabe")
    return SAT_PAYMENT_FORMS.TRANSFERENCIA
  if (paymentTypeId === "credit_card") return SAT_PAYMENT_FORMS.TARJETA_CREDITO
  if (paymentTypeId === "debit_card") return SAT_PAYMENT_FORMS.TARJETA_DEBITO
  return SAT_PAYMENT_FORMS.POR_DEFINIR
}

// ─── DTOs ─────────────────────────────────────────────────────

export type FiscalDataInput = {
  rfc: string
  razon_social: string
  regimen_fiscal: string
  codigo_postal_fiscal: string
  uso_cfdi: string
  email?: string
}

export type InvoiceLineItem = {
  description: string
  quantity: number
  /** Unit price in MXN (NOT centavos) */
  price: number
  product_key: string
  unit_key: string
  unit_name: string
  taxes: Array<{ type: string; rate: number }>
}

export type CreateInvoiceParams = {
  facturapi_customer_id: string
  items: InvoiceLineItem[]
  payment_form: string
  payment_method: string
  use: string
  currency: string
}

// ─── Common SAT regimen fiscal codes ──────────────────────────

export const REGIMEN_FISCAL_OPTIONS = [
  { code: "601", label: "General de Ley Personas Morales" },
  { code: "603", label: "Personas Morales con Fines no Lucrativos" },
  { code: "605", label: "Sueldos y Salarios" },
  { code: "606", label: "Arrendamiento" },
  { code: "608", label: "Demás ingresos" },
  { code: "610", label: "Residentes en el Extranjero" },
  { code: "612", label: "Personas Físicas con Actividades Empresariales" },
  { code: "616", label: "Sin obligaciones fiscales" },
  { code: "620", label: "Sociedades Cooperativas de Producción" },
  { code: "621", label: "Incorporación Fiscal" },
  { code: "625", label: "Régimen de las Actividades Agrícolas" },
  { code: "626", label: "Régimen Simplificado de Confianza" },
] as const

// ─── RFC validation ───────────────────────────────────────────

const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/

export function isValidRFC(rfc: string): boolean {
  return RFC_REGEX.test(rfc.toUpperCase())
}
