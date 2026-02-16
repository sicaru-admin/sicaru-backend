import { model } from "@medusajs/framework/utils"

const SalonApplication = model.define("salon_application", {
  id: model.id().primaryKey(),
  // Step 1 — Salon info
  salon_name: model.text(),
  address: model.text(),
  city: model.text(),
  state: model.text(),
  postal_code: model.text(),
  phone: model.text(),
  employee_count: model.text(),
  // Step 2 — Owner info
  owner_name: model.text(),
  email: model.text(),
  whatsapp: model.text(),
  rfc: model.text().nullable(),
  // Step 3 — Purchase info
  brands_interested: model.text(),
  monthly_volume: model.text(),
  has_current_distributor: model.boolean().default(false),
  current_distributor: model.text().nullable(),
  comments: model.text().nullable(),
  // Admin management
  status: model.enum(["pending", "approved", "rejected"]).default("pending"),
  admin_notes: model.text().nullable(),
})

export default SalonApplication
