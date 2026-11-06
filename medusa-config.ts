import { loadEnv, defineConfig } from '@medusajs/framework/utils'
import { join } from 'node:path'
import type { InputConfigModules } from '@medusajs/framework/types'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// Temporary local storage for this isolated QA environment only.
// Other environments retain their existing File Module behavior.
const isStagingMediaQa =
  process.env.RAILWAY_PROJECT_ID === "7b251006-cebd-48b3-a7a5-97b6c65d6baf" &&
  process.env.RAILWAY_ENVIRONMENT_ID === "da5e95b1-c2fc-456b-bb75-5b71b95c8f4b" &&
  process.env.RAILWAY_ENVIRONMENT_NAME === "staging-voglia" &&
  process.env.RAILWAY_SERVICE_ID === "50beb418-f34d-467d-b1f2-111c725c807d"

const stagingFileModules: InputConfigModules = []
if (isStagingMediaQa) {
  const backendUrl = new URL(process.env.MEDUSA_BACKEND_URL || "")
  if (
    backendUrl.protocol !== "https:" ||
    backendUrl.username || backendUrl.password ||
    backendUrl.pathname !== "/" || backendUrl.search || backendUrl.hash
  ) {
    throw new Error("Staging media QA requires an HTTPS MEDUSA_BACKEND_URL origin")
  }
  stagingFileModules.push({
    resolve: "@medusajs/medusa/file",
    options: {
      providers: [{
        resolve: "@medusajs/medusa/file-local",
        id: "local",
        options: {
          upload_dir: join(process.cwd(), "static"),
          backend_url: `${backendUrl.origin}/static`,
        },
      }],
    },
  })
}

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
    ...stagingFileModules,
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
