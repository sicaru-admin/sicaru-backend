import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
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

  // ── 1. STORE SETUP ──────────────────────────────────────────────────
  logger.info("Seeding Distribuidora Sicarú store data...");
  const [store] = await storeModuleService.listStores();

  // Update store name
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
  const mexicoRegion = regionResult[0];
  logger.info("Mexico region created.");

  // ── 5. TAX REGION: 16% IVA ────────────────────────────────────────
  logger.info("Creating tax region for Mexico (16% IVA)...");
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

  // ── 6. STOCK LOCATION ─────────────────────────────────────────────
  logger.info("Creating stock location: Almacén Cadereyta...");
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
  const stockLocation = stockLocationResult[0];

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_location_id: stockLocation.id,
      },
    },
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
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

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
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
    publishableApiKey = apiKeyResult;
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
  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        { name: "Shampoo y Acondicionador", is_active: true },
        { name: "Color y Tintes", is_active: true },
        { name: "Styling y Acabado", is_active: true },
        { name: "Línea Natural", is_active: true },
        { name: "Tratamientos y Mascarillas", is_active: true },
        { name: "Herramientas Pro", is_active: true },
      ],
    },
  });

  const catByName = (name: string) =>
    categoryResult.find((c) => c.name === name)!.id;

  logger.info(
    `Created ${categoryResult.length} categories: ${categoryResult.map((c) => c.name).join(", ")}`
  );

  // ── 10. PRODUCTS (8 items) ────────────────────────────────────────
  logger.info("Creating products...");
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Küül Cure Me Reconstructor 1L",
          handle: "kuul-cure-me-reconstructor-1l",
          description:
            "Tratamiento reconstructor profesional Küül Cure Me de 1 litro. Restaura fibra capilar dañada con keratina y proteínas.",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          category_ids: [catByName("Tratamientos y Mascarillas")],
          collection_id: undefined,
          options: [{ title: "Tamaño", values: ["1L"] }],
          variants: [
            {
              title: "1L",
              sku: "KUUL-CURE-1L",
              options: { "Tamaño": "1L" },
              manage_inventory: true,
              prices: [{ currency_code: "mxn", amount: 389 }],
            },
          ],
          sales_channels: [{ id: tiendaOnline.id }],
        },
        {
          title: "Voglia Tinte Permanente 90ml",
          handle: "voglia-tinte-permanente-90ml",
          description:
            "Tinte permanente Voglia con pigmentos de alta cobertura. 90ml. Disponible en amplia gama de tonos.",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          category_ids: [catByName("Color y Tintes")],
          options: [{ title: "Tamaño", values: ["90ml"] }],
          variants: [
            {
              title: "90ml",
              sku: "VOGLIA-TINTE-90ML",
              options: { "Tamaño": "90ml" },
              manage_inventory: true,
              prices: [{ currency_code: "mxn", amount: 85 }],
            },
          ],
          sales_channels: [{ id: tiendaOnline.id }],
        },
        {
          title: "Montis Shampoo Extracto Natural",
          handle: "montis-shampoo-extracto-natural",
          description:
            "Shampoo Montis con extractos naturales para cabello saludable y brillante. Libre de parabenos.",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          category_ids: [catByName("Shampoo y Acondicionador")],
          options: [{ title: "Tamaño", values: ["500ml"] }],
          variants: [
            {
              title: "500ml",
              sku: "MONTIS-SHAMPOO-NAT",
              options: { "Tamaño": "500ml" },
              manage_inventory: true,
              prices: [{ currency_code: "mxn", amount: 165 }],
            },
          ],
          sales_channels: [{ id: tiendaOnline.id }],
        },
        {
          title: "Nekane Capilar Tratamiento Hidra Intenso",
          handle: "nekane-tratamiento-hidra-intenso",
          description:
            "Tratamiento de hidratación intensiva Nekane Capilar. Nutre y repara cabello seco y maltratado.",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          category_ids: [catByName("Tratamientos y Mascarillas")],
          options: [{ title: "Tamaño", values: ["300ml"] }],
          variants: [
            {
              title: "300ml",
              sku: "NEKANE-HIDRA-300ML",
              options: { "Tamaño": "300ml" },
              manage_inventory: true,
              prices: [{ currency_code: "mxn", amount: 220 }],
            },
          ],
          sales_channels: [{ id: tiendaOnline.id }],
        },
        {
          title: "Hidra Color Tinte Cremoso",
          handle: "hidra-color-tinte-cremoso",
          description:
            "Tinte cremoso Hidra Color con fórmula hidratante. Cobertura total de canas con brillo intenso.",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          category_ids: [catByName("Color y Tintes")],
          options: [{ title: "Tamaño", values: ["90ml"] }],
          variants: [
            {
              title: "90ml",
              sku: "HIDRA-COLOR-90ML",
              options: { "Tamaño": "90ml" },
              manage_inventory: true,
              prices: [{ currency_code: "mxn", amount: 95 }],
            },
          ],
          sales_channels: [{ id: tiendaOnline.id }],
        },
        {
          title: "Xiomara Gel Fijación Fuerte",
          handle: "xiomara-gel-fijacion-fuerte",
          description:
            "Gel de fijación fuerte Xiomara para peinados duraderos. No deja residuos ni resequedad.",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          category_ids: [catByName("Styling y Acabado")],
          options: [{ title: "Tamaño", values: ["250ml"] }],
          variants: [
            {
              title: "250ml",
              sku: "XIOMARA-GEL-250ML",
              options: { "Tamaño": "250ml" },
              manage_inventory: true,
              prices: [{ currency_code: "mxn", amount: 78 }],
            },
          ],
          sales_channels: [{ id: tiendaOnline.id }],
        },
        {
          title: "Vitale Keratina Profesional",
          handle: "vitale-keratina-profesional",
          description:
            "Keratina profesional Vitale para alisado y restauración capilar. Resultados de salón en casa.",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          category_ids: [catByName("Tratamientos y Mascarillas")],
          options: [{ title: "Tamaño", values: ["500ml"] }],
          variants: [
            {
              title: "500ml",
              sku: "VITALE-KERAT-500ML",
              options: { "Tamaño": "500ml" },
              manage_inventory: true,
              prices: [{ currency_code: "mxn", amount: 350 }],
            },
          ],
          sales_channels: [{ id: tiendaOnline.id }],
        },
        {
          title: "Küül Color System Cream 3oz",
          handle: "kuul-color-system-cream-3oz",
          description:
            "Crema colorante Küül Color System de 3oz. Fórmula profesional con pigmentos de alta durabilidad.",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          category_ids: [catByName("Color y Tintes")],
          options: [{ title: "Tamaño", values: ["3oz"] }],
          variants: [
            {
              title: "3oz",
              sku: "KUUL-COLOR-3OZ",
              options: { "Tamaño": "3oz" },
              manage_inventory: true,
              prices: [{ currency_code: "mxn", amount: 75 }],
            },
          ],
          sales_channels: [{ id: tiendaOnline.id }],
        },
      ],
    },
  });
  logger.info("Created 8 products.");

  // ── 11. INVENTORY LEVELS ──────────────────────────────────────────
  logger.info("Setting inventory levels...");
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });

  const inventoryLevels: CreateInventoryLevelInput[] = inventoryItems.map(
    (item) => ({
      location_id: stockLocation.id,
      stocked_quantity: 500,
      inventory_item_id: item.id,
    })
  );

  await createInventoryLevelsWorkflow(container).run({
    input: { inventory_levels: inventoryLevels },
  });
  logger.info(`Set inventory for ${inventoryItems.length} items.`);

  // ── DONE ──────────────────────────────────────────────────────────
  logger.info("✅ Distribuidora Sicarú seed data complete!");
  logger.info("   Store: Distribuidora Sicarú");
  logger.info("   Region: México (MXN)");
  logger.info("   Tax: 16% IVA");
  logger.info("   Products: 8");
  logger.info("   Categories: 6");
  logger.info("   Shipping: Envío Cadereyta Mismo Día ($49 MXN)");
  logger.info("   Sales Channel: Tienda Online");
}
