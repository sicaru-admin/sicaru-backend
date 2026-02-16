export type RecoveryStatus =
  | "active"
  | "reminded_1"
  | "reminded_2"
  | "reminded_3"
  | "recovered"
  | "opted_out"
  | "expired"

export type AbandonedCartData = {
  id: string
  cart_id: string
  customer_id: string | null
  email: string | null
  phone: string | null
  cart_total: number
  items_snapshot: string
  recovery_status: RecoveryStatus
  recovery_token: string
  recovery_code: string | null
  opted_out: boolean
  last_cart_activity: Date
  message_1_sent_at: Date | null
  message_2_sent_at: Date | null
  message_3_sent_at: Date | null
  recovered_at: Date | null
}

export type CartSnapshotItem = {
  variant_id: string
  title: string
  quantity: number
  unit_price: number
  thumbnail: string | null
}
