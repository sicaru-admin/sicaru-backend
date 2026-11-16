import {
  SAT_PRODUCT_KEY,
  SAT_UNIT_KEY,
  SAT_UNIT_NAME,
  SAT_IVA_RATE,
} from "../modules/facturapi/types"
import type { InvoiceLineItem } from "../modules/facturapi/types"

type InvoiceItem = {
  title?: string | null
  quantity?: unknown
  unit_price?: unknown
  is_tax_inclusive?: unknown
  total?: unknown
  tax_total?: unknown
  discount_total?: unknown
  tax_lines?: ({ rate?: unknown } | null | undefined)[] | null
}

type InvoiceOrder = {
  currency_code?: string | null
  total?: unknown
  tax_total?: unknown
  shipping_total?: unknown
  discount_total?: unknown
  items?: (InvoiceItem | null | undefined)[] | null
}

export const INVOICE_ORDER_FIELDS = [
  "currency_code", "total", "tax_total", "shipping_total", "discount_total",
  "items.*", "items.tax_lines.*",
]

function amount(value: unknown, field: string): number {
  if (value === undefined || value === null || value === "" || typeof value === "boolean") {
    throw new Error(`Importe fiscal no disponible: ${field}.`)
  }
  const result = Number(value)
  if (!Number.isFinite(result) || result < 0) {
    throw new Error(`Importe fiscal inválido: ${field}.`)
  }
  return result
}

function cents(value: unknown, field: string): number {
  const result = Math.round((amount(value, field) + Number.EPSILON) * 100)
  if (!Number.isSafeInteger(result)) throw new Error(`Importe fiscal inválido: ${field}.`)
  return result
}

function requireMxn(order: Pick<InvoiceOrder, "currency_code">): void {
  if (order.currency_code?.toLowerCase() !== "mxn") {
    throw new Error("La moneda del pedido debe verificarse en MXN antes de facturar.")
  }
}

/** Medusa v2 stores major currency units. Use the saved total, including delivery and IVA. */
export function formatOrderTotalMxn(order: Pick<InvoiceOrder, "currency_code" | "total">): string {
  requireMxn(order)
  return (cents(order.total, "total") / 100).toFixed(2)
}

/**
 * Build only the fiscal cases whose totals can be reconciled without assumptions.
 * The existing product SAT key covers merchandise. A shipping classification and
 * discount treatment have not been approved, so those orders need fiscal review
 * rather than an incomplete or incorrectly taxed CFDI.
 */
export function buildOrderInvoiceItems(order: InvoiceOrder): InvoiceLineItem[] {
  requireMxn(order)
  if (amount(order.shipping_total, "shipping_total") !== 0) {
    throw new Error("La factura requiere revisión fiscal de la paquetería; no se emitió un CFDI incompleto.")
  }
  if (amount(order.discount_total, "discount_total") !== 0) {
    throw new Error("La factura requiere revisión fiscal de los descuentos antes de emitir el CFDI.")
  }
  if (!order.items?.length) throw new Error("No hay partidas verificadas para facturar.")

  let invoiceTotal = 0
  let invoiceTax = 0
  const lines = order.items.map((item): InvoiceLineItem => {
    if (!item) throw new Error("No se pudo verificar una partida del pedido.")
    const quantity = Number(item.quantity)
    if (!Number.isSafeInteger(quantity) || quantity <= 0 ||
        typeof item.is_tax_inclusive !== "boolean" ||
        !item.tax_lines || item.tax_lines.length !== 1 ||
        Number(item.tax_lines[0]?.rate) !== SAT_IVA_RATE * 100) {
      throw new Error("No se pudo verificar la cantidad y el IVA de una partida del pedido.")
    }
    if (amount(item.discount_total, "item.discount_total") !== 0) {
      throw new Error("La factura requiere revisión fiscal de los descuentos antes de emitir el CFDI.")
    }
    const price = amount(item.unit_price, "item.unit_price")
    const rawGross = price * quantity * (item.is_tax_inclusive ? 1 : 1 + SAT_IVA_RATE)
    const rawTax = item.is_tax_inclusive
      ? rawGross * SAT_IVA_RATE / (1 + SAT_IVA_RATE)
      : price * quantity * SAT_IVA_RATE
    const gross = cents(rawGross, "calculated_item.total")
    const tax = cents(rawTax, "calculated_item.tax_total")
    if (gross !== cents(item.total, "item.total") || tax !== cents(item.tax_total, "item.tax_total")) {
      throw new Error("Los importes de la partida y su IVA no coinciden con el pedido; revisa la factura.")
    }
    invoiceTotal += gross
    invoiceTax += tax
    return {
      description: item.title || "Producto",
      quantity,
      price, // MXN already; never divide Medusa v2 prices by 100.
      tax_included: item.is_tax_inclusive,
      product_key: SAT_PRODUCT_KEY,
      unit_key: SAT_UNIT_KEY,
      unit_name: SAT_UNIT_NAME,
      taxes: [{ type: "IVA", rate: SAT_IVA_RATE }],
    }
  })

  if (invoiceTotal !== cents(order.total, "total") || invoiceTax !== cents(order.tax_total, "tax_total")) {
    throw new Error("La suma de la factura y su IVA no coincide con el total del pedido; no se emitió el CFDI.")
  }
  return lines
}
