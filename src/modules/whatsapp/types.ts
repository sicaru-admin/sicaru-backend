export type WhatsAppModuleOptions = {
  accessToken: string
  phoneNumberId: string
  verifyToken: string
}

// Template names — must match what's registered in Meta Business Manager
export const TEMPLATE_ORDER_CONFIRMATION = "order_confirmation"
export const TEMPLATE_OXXO_VOUCHER = "oxxo_voucher"
export const TEMPLATE_OXXO_REMINDER = "oxxo_reminder"
export const TEMPLATE_OXXO_CONFIRMED = "oxxo_confirmed"
export const TEMPLATE_ORDER_SHIPPED = "order_shipped"
export const TEMPLATE_ORDER_DELIVERED = "order_delivered"
export const TEMPLATE_CART_REMINDER_1 = "cart_reminder_1"
export const TEMPLATE_CART_REMINDER_2 = "cart_reminder_2"
export const TEMPLATE_CART_REMINDER_3 = "cart_reminder_3"
export const TEMPLATE_SALON_PRO_RECEIVED = "salon_pro_received"

export type TemplateParameter = {
  type: "text"
  text: string
}

export type TemplateComponent = {
  type: "body"
  parameters: TemplateParameter[]
}

export type SendTemplatePayload = {
  messaging_product: "whatsapp"
  to: string
  type: "template"
  template: {
    name: string
    language: { code: string }
    components: TemplateComponent[]
  }
}

export type SendTextPayload = {
  messaging_product: "whatsapp"
  to: string
  type: "text"
  text: { body: string }
}

export type SendImagePayload = {
  messaging_product: "whatsapp"
  to: string
  type: "image"
  image: { link: string; caption?: string }
}
