import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const paymentProviders = process.env.MERCADOPAGO_ACCESS_TOKEN
  ? [
      {
        resolve: "./src/modules/mercadopago",
        id: "mercadopago",
        options: {
          accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
          publicKey: process.env.MERCADOPAGO_PUBLIC_KEY,
          sandbox: process.env.MERCADOPAGO_SANDBOX === "true",
          webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET,
        },
      },
    ]
  : []

const disableAdmin =
  process.env.DISABLE_ADMIN === "true" ||
  (process.env.NODE_ENV === "production" && process.env.ENABLE_ADMIN !== "true")

// Only the isolated review environment may accept these exact Preview origins.
// Preserve the existing STORE_CORS value, including any other approved origins.
const isPreviewPayments =
  process.env.RAILWAY_ENVIRONMENT_ID === "a04c43a9-03ec-44ff-8486-f64524c1cc8f"
const storeCors = isPreviewPayments
  ? [
      process.env.STORE_CORS,
      "https://sicaru-6sdncskmy-sicaru-admins-projects.vercel.app",
      "https://sicaru-git-codex-dhl-provisional-sicaru-admins-projects.vercel.app",
    ].filter(Boolean).join(",")
  : process.env.STORE_CORS

if (isPreviewPayments) {
  console.info("[SICARU review] Exact Preview origins appended to STORE_CORS")
}

module.exports = defineConfig({
  admin: {
    disable: disableAdmin,
    backendUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
  },
  modules: [
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: paymentProviders,
      },
    },
    {
      resolve: "./src/modules/meilisearch",
      options: {
        host: process.env.MEILISEARCH_HOST || "http://localhost:7700",
        apiKey: process.env.MEILISEARCH_API_KEY || "",
      },
    },
    {
      resolve: "./src/modules/facturapi",
      options: {
        apiKey: process.env.FACTURAPI_API_KEY || "",
        sandbox: process.env.FACTURAPI_SANDBOX === "true",
      },
    },
    {
      resolve: "./src/modules/whatsapp",
      options: {
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
        verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
      },
    },
    {
      resolve: "./src/modules/loyalty",
    },
    {
      resolve: "./src/modules/abandoned-cart",
    },
    {
      resolve: "./src/modules/salon-pro",
    },
  ],
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: storeCors!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
})
