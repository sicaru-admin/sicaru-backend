/**
 * WhatsApp Message Template Reference
 *
 * These templates must be registered manually in Meta Business Manager
 * (https://business.facebook.com → WhatsApp Manager → Message Templates).
 *
 * All templates use language code "es_MX" (Spanish - Mexico).
 * Parameters are numbered {{1}}, {{2}}, etc. in order.
 *
 * ──────────────────────────────────────────────────────────────────────
 *
 * Template: order_confirmation
 * Category: UTILITY
 * Body:
 *   ¡Hola {{1}}! Tu pedido #{{2}} ha sido confirmado.
 *   Total: ${{3}} MXN
 *   Envío: {{4}}
 *   Te avisaremos cuando tu pedido sea enviado. ¡Gracias por tu compra!
 *
 * Parameters:
 *   {{1}} first_name
 *   {{2}} display_id (order number)
 *   {{3}} total (formatted amount)
 *   {{4}} shipping_method
 *
 * ──────────────────────────────────────────────────────────────────────
 *
 * Template: oxxo_voucher
 * Category: UTILITY
 * Body:
 *   ¡Hola {{1}}! Aquí están los datos para pagar tu pedido en OXXO:
 *   Referencia: {{2}}
 *   Monto: ${{3}} MXN
 *   Vence: {{4}}
 *   Presenta este número de referencia en cualquier tienda OXXO para completar tu pago.
 *
 * Parameters:
 *   {{1}} first_name
 *   {{2}} reference
 *   {{3}} total (formatted amount)
 *   {{4}} expiration (formatted date)
 *
 * ──────────────────────────────────────────────────────────────────────
 *
 * Template: oxxo_reminder
 * Category: UTILITY
 * Body:
 *   ¡Hola {{1}}! Tu pedido #{{2}} aún está pendiente de pago.
 *   Referencia OXXO: {{3}}
 *   Vence: {{4}}
 *   Recuerda pagar antes de la fecha de vencimiento para no perder tu pedido.
 *
 * Parameters:
 *   {{1}} first_name
 *   {{2}} display_id
 *   {{3}} reference
 *   {{4}} expiration (formatted date)
 *
 * ──────────────────────────────────────────────────────────────────────
 *
 * Template: oxxo_confirmed
 * Category: UTILITY
 * Body:
 *   ¡Hola {{1}}! Tu pago OXXO para el pedido #{{2}} ha sido confirmado.
 *   Estamos preparando tu envío. ¡Gracias!
 *
 * Parameters:
 *   {{1}} first_name
 *   {{2}} display_id
 *
 * ──────────────────────────────────────────────────────────────────────
 *
 * Template: order_shipped
 * Category: UTILITY
 * Body:
 *   ¡Hola {{1}}! Tu pedido #{{2}} ha sido enviado.
 *   Entrega estimada: {{3}}
 *   Te avisaremos cuando llegue. ¡Gracias por tu paciencia!
 *
 * Parameters:
 *   {{1}} first_name
 *   {{2}} display_id
 *   {{3}} estimated_delivery
 *
 * ──────────────────────────────────────────────────────────────────────
 *
 * Template: order_delivered
 * Category: UTILITY
 * Body:
 *   ¡Hola {{1}}! Tu pedido #{{2}} ha sido entregado.
 *   Esperamos que disfrutes tus productos. ¿Podrías dejarnos tu opinión?
 *   {{3}}
 *
 * Parameters:
 *   {{1}} first_name
 *   {{2}} display_id
 *   {{3}} review_url
 */

export {} // Make this a module
