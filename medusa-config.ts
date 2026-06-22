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
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
})
