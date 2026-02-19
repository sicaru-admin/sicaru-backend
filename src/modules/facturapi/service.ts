import { MedusaService } from "@medusajs/framework/utils"
import FiscalData from "./models/fiscal-data"
import InvoiceRecord from "./models/invoice-record"
import type { FacturapiModuleOptions, CreateInvoiceParams } from "./types"

type InjectedDependencies = {
  logger: { info: (...args: any[]) => void; error: (...args: any[]) => void }
}

class FacturapiService extends MedusaService({
  FiscalData,
  InvoiceRecord,
}) {
  private clientPromise: Promise<any>
  protected logger_: InjectedDependencies["logger"]
  protected options_: FacturapiModuleOptions

  constructor(
    container: InjectedDependencies,
    options: FacturapiModuleOptions
  ) {
    super(...arguments)
    this.logger_ = container.logger
    this.options_ = options

    // Dynamic import to avoid ESM issues (same pattern as MeiliSearch)
    this.clientPromise = import("facturapi").then((mod) => {
      const Facturapi = (mod as any).default?.default || (mod as any).default || mod
      return new Facturapi(options.apiKey)
    })
  }

  private async getClient() {
    return this.clientPromise
  }

  // ─── FacturAPI Customer ──────────────────────────────────────

  async createFacturapiCustomer(data: {
    legal_name: string
    tax_id: string
    tax_system: string
    zip: string
    email?: string
  }) {
    const client = await this.getClient()
    return client.customers.create({
      legal_name: data.legal_name,
      tax_id: data.tax_id,
      tax_system: data.tax_system,
      email: data.email,
      address: { zip: data.zip },
    })
  }

  // ─── FacturAPI Invoices (CFDI) ──────────────────────────────

  async createCFDI(params: CreateInvoiceParams) {
    const client = await this.getClient()
    return client.invoices.create({
      customer: params.facturapi_customer_id,
      payment_form: params.payment_form,
      payment_method: params.payment_method,
      use: params.use,
      currency: params.currency,
      items: params.items.map((item) => ({
        quantity: item.quantity,
        product: {
          description: item.description,
          product_key: item.product_key,
          price: item.price,
          unit_key: item.unit_key,
          unit_name: item.unit_name,
          taxes: item.taxes,
        },
      })),
    })
  }

  async cancelCFDI(facturapiInvoiceId: string) {
    const client = await this.getClient()
    return client.invoices.cancel(facturapiInvoiceId)
  }

  async getCFDI(facturapiInvoiceId: string) {
    const client = await this.getClient()
    return client.invoices.retrieve(facturapiInvoiceId)
  }

  async downloadPdf(facturapiInvoiceId: string): Promise<NodeJS.ReadableStream> {
    const client = await this.getClient()
    return client.invoices.downloadPdf(facturapiInvoiceId)
  }

  async downloadXml(facturapiInvoiceId: string): Promise<NodeJS.ReadableStream> {
    const client = await this.getClient()
    return client.invoices.downloadXml(facturapiInvoiceId)
  }

  async sendByEmail(facturapiInvoiceId: string, email?: string) {
    const client = await this.getClient()
    return client.invoices.sendByEmail(facturapiInvoiceId, { email })
  }
}

export default FacturapiService
