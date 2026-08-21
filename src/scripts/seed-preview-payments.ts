import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";
import { linkSalesChannelsToApiKeyWorkflow } from "@medusajs/medusa/core-flows";
import seedSicaruData from "./seed-sicaru";

const REQUIRED_CONFIRMATION = "preview-payments";
const PREVIEW_KEY_TITLE = "Sicarú Preview Storefront";
const DEFAULT_SALES_CHANNEL = "Default Sales Channel";

function assertSafePreviewEnvironment() {
  const confirmation = process.env.SICARU_PREVIEW_SEED_CONFIRM;
  const databaseUrl = process.env.DATABASE_URL;
  const backendUrl = process.env.MEDUSA_BACKEND_URL || "";
  const railwayEnvironment = process.env.RAILWAY_ENVIRONMENT_NAME || "";
  const railwayService = process.env.RAILWAY_SERVICE_NAME || "";

  if (confirmation !== REQUIRED_CONFIRMATION) {
    throw new Error(
      `Refusing to seed: SICARU_PREVIEW_SEED_CONFIRM must equal ${REQUIRED_CONFIRMATION}.`
    );
  }

  if (!databaseUrl) {
    throw new Error("Refusing to seed: DATABASE_URL is missing.");
  }

  const environmentFingerprint = `${railwayEnvironment} ${railwayService} ${backendUrl}`.toLowerCase();
  const looksLikePreview = environmentFingerprint.includes("preview-payments");
  const looksLikeProduction =
    environmentFingerprint.includes("production") ||
    backendUrl.includes("sicaru-backend-production") ||
    backendUrl.includes("sicarubeauty.com");

  if (!looksLikePreview || looksLikeProduction) {
    throw new Error(
      "Refusing to seed: environment does not identify itself exclusively as preview-payments."
    );
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || "";
  const publicKey = process.env.MERCADOPAGO_PUBLIC_KEY || "";
  const sandbox = (process.env.MERCADOPAGO_SANDBOX || "").toLowerCase();

  if (!accessToken.startsWith("TEST-")) {
    throw new Error(
      "Refusing to seed: MERCADOPAGO_ACCESS_TOKEN is not a TEST credential."
    );
  }

  if (!publicKey.startsWith("TEST-")) {
    throw new Error(
      "Refusing to seed: MERCADOPAGO_PUBLIC_KEY is not a TEST credential."
    );
  }

  if (sandbox !== "true") {
    throw new Error(
      "Refusing to seed: MERCADOPAGO_SANDBOX must be true."
    );
  }
}

export default async function seedPreviewPayments(args: ExecArgs) {
  assertSafePreviewEnvironment();

  const { container } = args;
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const productModuleService = container.resolve(Modules.PRODUCT);

  logger.info("Preview safety checks passed. Seeding non-sensitive catalog data...");

  await seedSicaruData(args);

  const { data: mexicoRegions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "payment_providers.id"],
    filters: { name: "México" },
  });

  if (!mexicoRegions.length) {
    throw new Error("Required region not found: México.");
  }

  const mexicoRegion = mexicoRegions[0];

  const { data: paymentProviders } = await query.graph({
    entity: "payment_provider",
    fields: ["id", "is_enabled"],
  });

  const mercadoPagoProvider = paymentProviders.find((provider: any) => {
    const id = String(provider.id || "").toLowerCase();
    return id.includes("mercadopago") || id.includes("mercado_pago");
  });

  if (!mercadoPagoProvider) {
    throw new Error("Required Mercado Pago payment provider not found.");
  }

  const hasMercadoPagoProvider = (mexicoRegion.payment_providers || []).some(
    (provider: any) => provider.id === mercadoPagoProvider.id
  );

  if (!hasMercadoPagoProvider) {
    try {
      await link.create({
        [Modules.REGION]: { region_id: mexicoRegion.id },
        [Modules.PAYMENT]: {
          payment_provider_id: mercadoPagoProvider.id,
        },
      });
    } catch (error: any) {
      const message = String(error?.message || error).toLowerCase();
      if (!message.includes("already") && !message.includes("duplicate")) {
        throw error;
      }
    }
  }

  const defaultChannels = await salesChannelModuleService.listSalesChannels({
    name: DEFAULT_SALES_CHANNEL,
  });

  if (!defaultChannels.length) {
    throw new Error(
      `Required sales channel not found: ${DEFAULT_SALES_CHANNEL}.`
    );
  }

  const defaultSalesChannel = defaultChannels[0];
  const products = await productModuleService.listProducts({});

  for (const product of products) {
    try {
      await link.create({
        [Modules.PRODUCT]: { product_id: product.id },
        [Modules.SALES_CHANNEL]: {
          sales_channel_id: defaultSalesChannel.id,
        },
      });
    } catch (error: any) {
      const message = String(error?.message || error).toLowerCase();
      if (!message.includes("already") && !message.includes("duplicate")) {
        throw error;
      }
    }
  }

  const { data: previewKeys } = await query.graph({
    entity: "api_key",
    fields: ["id", "title", "type"],
    filters: { title: PREVIEW_KEY_TITLE, type: "publishable" },
  });

  if (!previewKeys.length) {
    throw new Error(`Publishable API key not found: ${PREVIEW_KEY_TITLE}.`);
  }

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: previewKeys[0].id,
      add: [defaultSalesChannel.id],
    },
  });

  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id"],
  });
  const { data: collections } = await query.graph({
    entity: "product_collection",
    fields: ["id"],
  });
  const { data: shippingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id"],
  });
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });
  const { data: productsWithVariants } = await query.graph({
    entity: "product",
    fields: ["id", "variants.id"],
  });

  const variantCount = productsWithVariants.reduce(
    (total, product: any) => total + (product.variants?.length || 0),
    0
  );

  logger.info(
    JSON.stringify({
      environment: REQUIRED_CONFIRMATION,
      sales_channel: DEFAULT_SALES_CHANNEL,
      publishable_key: PREVIEW_KEY_TITLE,
      products: products.length,
      variants: variantCount,
      categories: categories.length,
      collections: collections.length,
      shipping_options: shippingOptions.length,
      inventory_items: inventoryItems.length,
      mercado_pago: "TEST",
    })
  );
}
