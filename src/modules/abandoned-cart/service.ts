import { MedusaService } from "@medusajs/framework/utils"
import AbandonedCart from "./models/abandoned-cart"
import type { CartSnapshotItem } from "./types"

class AbandonedCartService extends MedusaService({ AbandonedCart }) {
  generateRecoveryToken(): string {
    return crypto.randomUUID()
  }

  serializeItems(items: any[]): string {
    const snapshot: CartSnapshotItem[] = items.map((item) => ({
      variant_id: item.variant_id,
      title: item.title || item.product_title || "",
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
      thumbnail: item.thumbnail || null,
    }))
    return JSON.stringify(snapshot)
  }

  formatProductList(itemsJson: string): string {
    try {
      const items: CartSnapshotItem[] = JSON.parse(itemsJson)
      return items
        .map(
          (item) =>
            `\u2022 ${item.title}${item.quantity > 1 ? ` x${item.quantity}` : ""}`
        )
        .join("\n")
    } catch {
      return ""
    }
  }

  formatTotal(centavos: number): string {
    const mxn = centavos / 100
    return `$${mxn.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`
  }
}

export default AbandonedCartService
