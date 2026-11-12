import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  createApiKeysWorkflow,
  createProductCategoriesWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresStep,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";
import { assertTechnicalSeedAuthorized } from "../utils/seed-safety";

const updateStoreCurrencies = createWorkflow(
  "update-store-currencies-sicaru",
  (input: {
    supported_currencies: { currency_code: string; is_default?: boolean }[];
    store_id: string;
  }) => {
    const normalizedInput = transform({ input }, (data) => {
      return {
        selector: { id: data.input.store_id },
        update: {
          supported_currencies: data.input.supported_currencies.map(
            (currency) => ({
              currency_code: currency.currency_code,
              is_default: currency.is_default ?? false,
            })
          ),
        },
      };
    });

    const stores = updateStoresStep(normalizedInput);
    return new WorkflowResponse(stores);
  }
);

export default async function seedSicaruData({ container }: ExecArgs) {
  assertTechnicalSeedAuthorized(process.env);

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = container.resolve(Modules.STORE);
  const regionModuleService = container.resolve(Modules.REGION);
  const stockLocationModuleService = container.resolve(Modules.STOCK_LOCATION);

  // ── 1. STORE SETUP ──────────────────────────────────────────────────
  logger.info("Seeding Distribuidora Sicarú store data...");
  const [store] = await storeModuleService.listStores();

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        name: "Distribuidora Sicarú",
      },
    },
  });

  // ── 2. SALES CHANNEL ────────────────────────────────────────────────
  logger.info("Creating sales channel: Tienda Online...");
  let salesChannels = await salesChannelModuleService.listSalesChannels({
    name: "Tienda Online",
  });

  if (!salesChannels.length) {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [{ name: "Tienda Online" }],
      },
    });
    salesChannels = salesChannelResult;
  }

  const tiendaOnline = salesChannels[0];

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_sales_channel_id: tiendaOnline.id,
      },
    },
  });

  // ── 3. CURRENCY (MXN) ──────────────────────────────────────────────
  logger.info("Setting MXN as default currency...");
  await updateStoreCurrencies(container).run({
    input: {
      store_id: store.id,
      supported_currencies: [
        { currency_code: "mxn", is_default: true },
        { currency_code: "usd" },
      ],
    },
  });

  // ── 4. REGION: MEXICO ──────────────────────────────────────────────
  logger.info("Creating Mexico region...");
  const existingRegions = await regionModuleService.listRegions({
    name: "México",
  });
  if (existingRegions.length) {
    logger.info("Mexico region already exists, skipping.");
  } else {
    await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "México",
            currency_code: "mxn",
            countries: ["mx"],
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    });
    logger.info("Mexico region created.");
  }

  // ── 5. TAX REGION: 16% IVA ────────────────────────────────────────
  logger.info("Creating tax region for Mexico (16% IVA)...");
  const { data: existingTaxRegions } = await query.graph({
    entity: "tax_region",
    fields: ["id"],
    filters: { country_code: "mx" },
  });

  if (existingTaxRegions.length) {
    logger.info("Tax region for MX already exists, skipping.");
  } else {
    await createTaxRegionsWorkflow(container).run({
      input: [
        {
          country_code: "mx",
          default_tax_rate: {
            name: "IVA",
            rate: 16,
            code: "iva-mx",
          },
          provider_id: "tp_system",
        },
      ],
    });
    logger.info("Tax region created.");
  }

  // ── 6. STOCK LOCATION ─────────────────────────────────────────────
  logger.info("Creating stock location: Almacén Cadereyta...");
  const existingLocations = await stockLocationModuleService.listStockLocations({
    name: "Almacén Cadereyta",
  });
  let stockLocation;

  if (existingLocations.length) {
    stockLocation = existingLocations[0];
    logger.info("Stock location already exists, skipping.");
  } else {
    const { result: stockLocationResult } = await createStockLocationsWorkflow(
      container
    ).run({
      input: {
        locations: [
          {
            name: "Almacén Cadereyta",
            address: {
              city: "Cadereyta Jiménez",
              country_code: "MX",
              province: "Nuevo León",
              address_1: "Centro",
            },
          },
        ],
      },
    });
    stockLocation = stockLocationResult[0];

    await link.create({
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocation.id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_provider_id: "manual_manual",
      },
    });
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_location_id: stockLocation.id,
      },
    },
  });

  // ── 7. STRUCTURAL SHIPPING PROFILE ONLY ──────────────────────────
  // Products may reference this profile; no service, rate or promise is offered.
  logger.info("Setting up the structural shipping profile...");
  const shippingProfiles =
    await fulfillmentModuleService.listShippingProfiles({ type: "default" });
  if (!shippingProfiles.length) {
    await createShippingProfilesWorkflow(container).run({
      input: {
        data: [
          {
            name: "Perfil de Envío Predeterminado",
            type: "default",
          },
        ],
      },
    });
  }

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [tiendaOnline.id],
    },
  });

  // ── 8. PUBLISHABLE API KEY ────────────────────────────────────────
  logger.info("Creating publishable API key...");
  const { data: existingKeys } = await query.graph({
    entity: "api_key",
    fields: ["id"],
    filters: { type: "publishable" },
  });

  let publishableApiKey = existingKeys?.[0];

  if (!publishableApiKey) {
    const {
      result: [apiKeyResult],
    } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          {
            title: "Tienda Online Sicarú",
            type: "publishable",
            created_by: "",
          },
        ],
      },
    });
    publishableApiKey = apiKeyResult as any;
  }

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [tiendaOnline.id],
    },
  });
  logger.info("Publishable API key created.");

  // ── 9. PRODUCT CATEGORIES ─────────────────────────────────────────
  logger.info("Creating product categories...");
  const categoryNames = [
    "Shampoo y Acondicionador",
    "Color y Tintes",
    "Styling y Acabado",
    "Línea Natural",
    "Tratamientos y Mascarillas",
    "Herramientas Pro",
  ];

  try {
    await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: categoryNames.map((name) => ({
          name,
          is_active: true,
        })),
      },
    });
    logger.info(`Created ${categoryNames.length} categories.`);
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      logger.info("Categories already exist, skipping creation.");
    } else {
      throw e;
    }
  }

  logger.info("SICARÚ technical infrastructure initialized.");
  logger.info("Products, prices and inventory require separate validated imports.");
}
