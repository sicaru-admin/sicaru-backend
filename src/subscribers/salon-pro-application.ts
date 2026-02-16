import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { SALON_PRO_MODULE } from "../modules/salon-pro"
import { WHATSAPP_MODULE } from "../modules/whatsapp"
import { TEMPLATE_SALON_PRO_RECEIVED } from "../modules/whatsapp/types"

const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP_NUMBER || "528281111023"

export default async function salonProApplicationCreated({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const applicationId = event.data.id
  const logger = container.resolve("logger") as {
    info: (...args: any[]) => void
    error: (...args: any[]) => void
  }
  const salonPro = container.resolve(SALON_PRO_MODULE) as any
  const whatsapp = container.resolve(WHATSAPP_MODULE) as {
    sendTemplate: (
      to: string,
      templateName: string,
      languageCode: string,
      parameters: string[]
    ) => Promise<void>
    sendText: (to: string, text: string) => Promise<void>
  }

  try {
    const application = await salonPro.retrieveSalonApplication(applicationId)
    if (!application) {
      logger.error(
        `[SalonPro] Application ${applicationId} not found for notification`
      )
      return
    }

    // Send WhatsApp confirmation to applicant
    await whatsapp.sendTemplate(
      application.whatsapp,
      TEMPLATE_SALON_PRO_RECEIVED,
      "es_MX",
      [application.owner_name, application.salon_name]
    )

    // Notify admin via plain text
    let brands = ""
    try {
      brands = JSON.parse(application.brands_interested).join(", ")
    } catch {
      brands = application.brands_interested
    }

    const adminMsg = [
      "Nueva solicitud Sicaru PRO",
      `Salon: ${application.salon_name}`,
      `Contacto: ${application.owner_name}`,
      `WhatsApp: ${application.whatsapp}`,
      `Email: ${application.email}`,
      `Ciudad: ${application.city}, ${application.state}`,
      `Empleados: ${application.employee_count}`,
      `Volumen: ${application.monthly_volume}`,
      `Marcas: ${brands}`,
      application.rfc ? `RFC: ${application.rfc}` : "",
      application.has_current_distributor
        ? `Distribuidor actual: ${application.current_distributor || "Si"}`
        : "",
      application.comments ? `Comentarios: ${application.comments}` : "",
    ]
      .filter(Boolean)
      .join("\n")

    await whatsapp.sendText(ADMIN_WHATSAPP, adminMsg)

    logger.info(
      `[SalonPro] Notifications sent for application ${applicationId}`
    )
  } catch (error: any) {
    logger.error(
      `[SalonPro] Notification failed for ${applicationId}: ${error.message || error}`
    )
  }
}

export const config: SubscriberConfig = {
  event: ["salon-pro.application.created"],
}
