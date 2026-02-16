export type ApplicationStatus = "pending" | "approved" | "rejected"

export type SalonApplicationData = {
  id: string
  salon_name: string
  address: string
  city: string
  state: string
  postal_code: string
  phone: string
  employee_count: string
  owner_name: string
  email: string
  whatsapp: string
  rfc: string | null
  brands_interested: string
  monthly_volume: string
  has_current_distributor: boolean
  current_distributor: string | null
  comments: string | null
  status: ApplicationStatus
  admin_notes: string | null
  created_at: string
  updated_at: string
}

export const BRAND_OPTIONS = [
  { value: "kuul", label: "Küül" },
  { value: "voglia", label: "Voglia" },
  { value: "nekane", label: "Nekane Capilar" },
  { value: "hidra-color", label: "Hidra Color" },
  { value: "xiomara", label: "Xiomara" },
  { value: "vitale", label: "Vitale" },
  { value: "montis", label: "Montis" },
] as const

export const EMPLOYEE_RANGES = ["1-3", "4-10", "11-20", "20+"] as const

export const VOLUME_RANGES = [
  "$2,000-5,000",
  "$5,000-15,000",
  "$15,000-30,000",
  "$30,000+",
] as const
