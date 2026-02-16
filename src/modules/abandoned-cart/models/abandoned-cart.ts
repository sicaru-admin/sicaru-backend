import { model } from "@medusajs/framework/utils"

const AbandonedCart = model.define("abandoned_cart", {
  id: model.id().primaryKey(),
  cart_id: model.text(),
  customer_id: model.text().nullable(),
  email: model.text().nullable(),
  phone: model.text().nullable(),
  cart_total: model.number().default(0),
  items_snapshot: model.text(),
  recovery_status: model
    .enum([
      "active",
      "reminded_1",
      "reminded_2",
      "reminded_3",
      "recovered",
      "opted_out",
      "expired",
    ])
    .default("active"),
  recovery_token: model.text(),
  recovery_code: model.text().nullable(),
  opted_out: model.boolean().default(false),
  last_cart_activity: model.dateTime(),
  message_1_sent_at: model.dateTime().nullable(),
  message_2_sent_at: model.dateTime().nullable(),
  message_3_sent_at: model.dateTime().nullable(),
  recovered_at: model.dateTime().nullable(),
})

export default AbandonedCart
