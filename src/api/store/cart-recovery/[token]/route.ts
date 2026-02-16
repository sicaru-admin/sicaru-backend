import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ABANDONED_CART_MODULE } from "../../../../modules/abandoned-cart"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const token = req.params.token as string

  if (!token) {
    res.status(400).json({ message: "Token requerido" })
    return
  }

  const abandonedCart = req.scope.resolve(ABANDONED_CART_MODULE) as any

  const carts = await abandonedCart.listAbandonedCarts(
    { recovery_token: token },
    { take: 1 }
  )

  const cart = carts?.[0]
  if (!cart) {
    res.status(404).json({ message: "Carrito no encontrado" })
    return
  }

  if (
    cart.recovery_status === "expired" ||
    cart.recovery_status === "opted_out"
  ) {
    res.status(410).json({ message: "Este enlace de recuperacion ha expirado" })
    return
  }

  try {
    const items = JSON.parse(cart.items_snapshot)
    res.json({
      items,
      recovery_code: cart.recovery_code,
      cart_total: cart.cart_total,
    })
  } catch {
    res.status(500).json({ message: "Error al procesar carrito" })
  }
}
