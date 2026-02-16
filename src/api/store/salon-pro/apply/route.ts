import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SALON_PRO_MODULE } from "../../../../modules/salon-pro"

const REQUIRED_FIELDS = [
  "salon_name",
  "address",
  "city",
  "state",
  "postal_code",
  "phone",
  "employee_count",
  "owner_name",
  "email",
  "whatsapp",
  "brands_interested",
  "monthly_volume",
]

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as Record<string, any>

  const missing = REQUIRED_FIELDS.filter((f) => !body[f])
  if (missing.length > 0) {
    res.status(400).json({
      message: `Campos requeridos: ${missing.join(", ")}`,
    })
    return
  }

  const salonPro = req.scope.resolve(SALON_PRO_MODULE) as any

  try {
    const application = await salonPro.createSalonApplications({
      salon_name: body.salon_name,
      address: body.address,
      city: body.city,
      state: body.state,
      postal_code: body.postal_code,
      phone: body.phone,
      employee_count: body.employee_count,
      owner_name: body.owner_name,
      email: body.email,
      whatsapp: body.whatsapp,
      rfc: body.rfc || null,
      brands_interested: Array.isArray(body.brands_interested)
        ? JSON.stringify(body.brands_interested)
        : body.brands_interested,
      monthly_volume: body.monthly_volume,
      has_current_distributor: body.has_current_distributor || false,
      current_distributor: body.current_distributor || null,
      comments: body.comments || null,
      status: "pending",
      admin_notes: null,
    })

    // Emit event for WhatsApp notifications
    const eventBus = req.scope.resolve("event_bus") as any
    await eventBus.emit("salon-pro.application.created", {
      id: application.id,
    })

    res.status(201).json({
      application: { id: application.id, status: "pending" },
    })
  } catch (error: any) {
    res.status(500).json({ message: "Error al crear solicitud" })
  }
}
