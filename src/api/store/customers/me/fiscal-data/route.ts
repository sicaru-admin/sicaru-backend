import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { FACTURAPI_MODULE } from "../../../../../modules/facturapi"
import { isValidRFC } from "../../../../../modules/facturapi/types"

// GET /store/customers/me/fiscal-data
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context.actor_id
  if (!customerId) {
    res.status(401).json({ message: "No autenticado" })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "customer",
    fields: ["fiscal_data.*"],
    filters: { id: customerId },
  })

  const fiscalData = data?.[0]?.fiscal_data ?? null
  res.json({ fiscal_data: fiscalData })
}

// POST /store/customers/me/fiscal-data
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context.actor_id
  if (!customerId) {
    res.status(401).json({ message: "No autenticado" })
    return
  }

  const body = req.body as {
    rfc?: string
    razon_social?: string
    regimen_fiscal?: string
    codigo_postal_fiscal?: string
    uso_cfdi?: string
    email?: string
  }

  // Validate required fields
  if (
    !body.rfc ||
    !body.razon_social ||
    !body.regimen_fiscal ||
    !body.codigo_postal_fiscal ||
    !body.uso_cfdi
  ) {
    res.status(400).json({
      message:
        "Campos requeridos: rfc, razon_social, regimen_fiscal, codigo_postal_fiscal, uso_cfdi",
    })
    return
  }

  // Validate RFC format
  if (!isValidRFC(body.rfc)) {
    res.status(400).json({ message: "Formato de RFC inválido" })
    return
  }

  // Validate CP is 5 digits
  if (!/^\d{5}$/.test(body.codigo_postal_fiscal)) {
    res
      .status(400)
      .json({ message: "El código postal fiscal debe ser de 5 dígitos" })
    return
  }

  const facturapi = req.scope.resolve(FACTURAPI_MODULE)
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Check if fiscal data already exists for this customer
  const { data: existing } = await query.graph({
    entity: "customer",
    fields: ["fiscal_data.*"],
    filters: { id: customerId },
  })

  const fiscalInput = {
    rfc: body.rfc.toUpperCase(),
    razon_social: body.razon_social,
    regimen_fiscal: body.regimen_fiscal,
    codigo_postal_fiscal: body.codigo_postal_fiscal,
    uso_cfdi: body.uso_cfdi,
    email: body.email || null,
  }

  let fiscalData
  if (existing?.[0]?.fiscal_data) {
    // Update existing
    fiscalData = await facturapi.updateFiscalDatas({
      id: existing[0].fiscal_data.id,
      ...fiscalInput,
      // Reset cached FacturAPI customer ID since RFC may have changed
      facturapi_customer_id: null,
    })
  } else {
    // Create new fiscal data + link to customer
    fiscalData = await facturapi.createFiscalDatas({
      ...fiscalInput,
      customer_id: customerId,
      facturapi_customer_id: null,
    })

    await remoteLink.create({
      [Modules.CUSTOMER]: { customer_id: customerId },
      [FACTURAPI_MODULE]: { fiscal_data_id: fiscalData.id },
    })
  }

  res.json({ fiscal_data: fiscalData })
}
