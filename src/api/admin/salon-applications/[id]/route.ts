import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { SALON_PRO_MODULE } from "../../../../modules/salon-pro"

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const { id } = req.params
  const salonPro = req.scope.resolve(SALON_PRO_MODULE) as any

  try {
    const application = await salonPro.retrieveSalonApplication(id)
    res.json({ application })
  } catch {
    res.status(404).json({ message: "Solicitud no encontrada" })
  }
}

export async function PATCH(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const { id } = req.params
  const body = req.body as Record<string, any>
  const salonPro = req.scope.resolve(SALON_PRO_MODULE) as any

  const allowedFields = ["status", "admin_notes"]
  const update: Record<string, any> = { id }
  for (const field of allowedFields) {
    if (body[field] !== undefined) update[field] = body[field]
  }

  try {
    const application = await salonPro.updateSalonApplications(update)
    res.json({ application })
  } catch {
    res.status(500).json({ message: "Error al actualizar solicitud" })
  }
}
