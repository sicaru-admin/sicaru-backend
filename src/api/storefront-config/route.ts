import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const [{ data: apiKeys }, { data: products }] = await Promise.all([
    query.graph({
      entity: "api_key",
      fields: ["token"],
      filters: { type: "publishable" },
    }),
    query.graph({
      entity: "product",
      fields: ["id"],
    }),
  ])

  res.status(200).json({
    publishable_key: apiKeys[0]?.token ?? null,
    product_count: products.length,
  })
}
