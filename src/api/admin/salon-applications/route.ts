import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { SALON_PRO_MODULE } from "../../../modules/salon-pro"

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const salonPro = req.scope.resolve(SALON_PRO_MODULE) as any

  const status = req.query.status as string | undefined
  const filters: Record<string, any> = {}
  if (status) filters.status = status

  const limit = Number(req.query.limit) || 50
  const offset = Number(req.query.offset) || 0

  const applications = await salonPro.listSalonApplications(filters, {
    take: limit,
    skip: offset,
    order: { created_at: "DESC" },
  })

  res.json({ applications, limit, offset })
}
