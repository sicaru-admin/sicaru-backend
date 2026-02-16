import { MedusaService } from "@medusajs/framework/utils"
import SalonApplication from "./models/salon-application"

class SalonProService extends MedusaService({ SalonApplication }) {}

export default SalonProService
