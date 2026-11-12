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
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresStep,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";

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
  let mexicoRegion;

  if (existingRegions.length) {
    mexicoRegion = existingRegions[0];
    logger.info("Mexico region already exists, skipping.");
  } else {
    const { result: regionResult } = await createRegionsWorkflow(container).run({
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
    mexicoRegion = regionResult[0];
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

  // ── 7. SHIPPING PROFILE & FULFILLMENT ─────────────────────────────
  logger.info("Setting up shipping and fulfillment...");
  const shippingProfiles =
    await fulfillmentModuleService.listShippingProfiles({ type: "default" });
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null;

  if (!shippingProfile) {
    const { result: shippingProfileResult } =
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
    shippingProfile = shippingProfileResult[0];
  }

  const existingFulfillmentSets =
    await fulfillmentModuleService.listFulfillmentSets({ name: "Envío Cadereyta" });
  let fulfillmentSet;

  if (existingFulfillmentSets.length) {
    fulfillmentSet = existingFulfillmentSets[0];
    logger.info("Fulfillment set already exists, skipping.");
  } else {
    fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
      name: "Envío Cadereyta",
      type: "shipping",
      service_zones: [
        {
          name: "México",
          geo_zones: [
            {
              country_code: "mx",
              type: "country",
            },
          ],
        },
      ],
    });

    await link.create({
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocation.id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_set_id: fulfillmentSet.id,
      },
    });

    // Shipping option: Envío Cadereyta Mismo Día — $49 MXN flat rate
    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: "Envío Cadereyta Mismo Día",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: fulfillmentSet.service_zones[0].id,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "Mismo Día",
            description: "Envío el mismo día en Cadereyta y zona metropolitana. Gratis en pedidos mayores a $300 MXN.",
            code: "mismo-dia",
          },
          prices: [
            {
              currency_code: "mxn",
              amount: 49,
            },
            {
              region_id: mexicoRegion.id,
              amount: 49,
            },
          ],
          rules: [
            {
              attribute: "enabled_in_store",
              value: "true",
              operator: "eq",
            },
            {
              attribute: "is_return",
              value: "false",
              operator: "eq",
            },
          ],
        },
      ],
    });
    logger.info("Shipping option created.");
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
