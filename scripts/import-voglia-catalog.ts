#!/usr/bin/env node

import type { ExecArgs } from "@medusajs/framework/types";

const fs = require("node:fs");
const path = require("node:path");

const REQUIRED_COLUMNS = [
  "action", "existing_product_id", "existing_variant_id", "brand", "line",
  "product_type", "title", "handle", "description", "benefits",
  "instructions", "warnings", "category", "collection", "option_name",
  "variant_title", "tone_code", "tone_name", "presentation", "sku",
  "barcode", "ean", "upc", "price_mxn", "stock", "manage_inventory",
  "allow_backorder", "thumbnail_file", "image_files", "weight_g", "length_cm",
  "width_cm", "height_cm", "sales_channel", "shipping_profile", "tags",
  "metadata_source", "source_reference", "notes", "review_status",
];

const EXPECTED = {
  tintProductId: "prod_01KVV3GD5ZD8R40HF48DRBF37A",
  tintVariantId: "variant_01KVV3GD87A2S476H48GGKQWK7",
  tintHandle: "voglia-tinte-permanente-90ml",
  allInOneProductId: "prod_01KVXJG9PX1NN0MAYZ283R9H7N",
  allInOneVariantId: "variant_01KVXJG9SAT8J02A1HXGCBSCRT",
  allInOneHandle: "voglia-all-in-one-keratin-250ml",
  allInOneSku: "VOGLIA-ALL-IN-ONE-250ML",
};

const APPLY_CONFIRMATION = "APPLY_VOGLIA_CATALOG";

type ValidationMessage = {
  row?: number;
  message: string;
};

function parseArgs(input: string[]) {
  const args = {
    mode: "dry-run",
    file: "voglia-catalog-master-final.csv",
    confirm: "",
  };

  for (let i = 0; i < input.length; i += 1) {
    const value = input[i];

    if (value === "--dry-run") {
      args.mode = "dry-run";
    } else if (value === "--preflight-live") {
      args.mode = "preflight-live";
    } else if (value === "--apply") {
      args.mode = "apply";
    } else if (value === "--file") {
      const file = input[++i];
      if (!file) throw new Error("--file requiere una ruta.");
      args.file = file;
    } else if (value === "--confirm") {
      const confirmation = input[++i];
      if (!confirmation) throw new Error("--confirm requiere un valor.");
      args.confirm = confirmation;
    } else {
      throw new Error(`Argumento no reconocido: ${value}`);
    }
  }

  return args;
}

function parseCsv(text) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows.filter((candidate) => candidate.some((value) => value !== ""));
}

function readCatalog(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`No existe el archivo CSV: ${filePath}`);
  const parsed = parseCsv(fs.readFileSync(filePath, "utf8"));
  const header = parsed[0] ? [...parsed[0]] : [];
  if (header.length) header[0] = header[0]?.replace(/^\uFEFF/, "") ?? "";
  return {
    header,
    rows: parsed.slice(1).map((values, index) => ({
      rowNumber: index + 2,
      values: Object.fromEntries(header.map((column, columnIndex) => [column, values[columnIndex] ?? ""])),
    })),
  };
}

function toNumber(value) {
  if (!/^\d+(\.\d+)?$/.test(String(value))) return Number.NaN;
  return Number(value);
}

function duplicates(rows, column) {
  const seen = new Map();
  for (const row of rows) {
    const value = row.values[column]?.trim();
    if (!value) continue;
    seen.set(value, [...(seen.get(value) ?? []), row.rowNumber]);
  }
  return [...seen.entries()]
    .filter(([, rowNumbers]) => rowNumbers.length > 1)
    .map(([value, rowNumbers]) => ({ value, rowNumbers }));
}

function validate(header, rows) {
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];
  const missing = REQUIRED_COLUMNS.filter((column) => !header.includes(column));
  const extra = header.filter((column) => !REQUIRED_COLUMNS.includes(column));
  if (missing.length) errors.push({ message: `Faltan columnas: ${missing.join(", ")}` });
  if (extra.length) warnings.push({ message: `Columnas extra ignoradas: ${extra.join(", ")}` });
  if (header.length !== REQUIRED_COLUMNS.length) errors.push({ message: `El CSV debe tener ${REQUIRED_COLUMNS.length} columnas; tiene ${header.length}.` });
  if (rows.length !== 24) errors.push({ message: `El CSV debe tener 24 filas; tiene ${rows.length}.` });

  for (const row of rows) {
    const item = row.values;
    if (item.review_status !== "APPROVED") errors.push({ row: row.rowNumber, message: `Fila ${row.rowNumber}: review_status no es APPROVED.` });
    if (!["UPDATE_EXISTING", "ADD_VARIANT_TO_EXISTING"].includes(item.action)) errors.push({ row: row.rowNumber, message: `Fila ${row.rowNumber}: action invalida.` });
    if (![EXPECTED.tintProductId, EXPECTED.allInOneProductId].includes(item.existing_product_id)) errors.push({ row: row.rowNumber, message: `Fila ${row.rowNumber}: Product ID fuera de alcance.` });
    if (!item.sku) errors.push({ row: row.rowNumber, message: `Fila ${row.rowNumber}: falta SKU.` });
    if (!item.barcode) errors.push({ row: row.rowNumber, message: `Fila ${row.rowNumber}: falta barcode.` });
    if (Number.isNaN(toNumber(item.price_mxn))) errors.push({ row: row.rowNumber, message: `Fila ${row.rowNumber}: precio invalido.` });
    if (!Number.isInteger(toNumber(item.stock))) errors.push({ row: row.rowNumber, message: `Fila ${row.rowNumber}: stock invalido.` });
    if (!["true", "false"].includes(item.manage_inventory)) errors.push({ row: row.rowNumber, message: `Fila ${row.rowNumber}: manage_inventory invalido.` });
    if (!["true", "false"].includes(item.allow_backorder)) errors.push({ row: row.rowNumber, message: `Fila ${row.rowNumber}: allow_backorder invalido.` });
  }

  const tintRows = rows.filter((row) => row.values.existing_product_id === EXPECTED.tintProductId);
  const allRows = rows.filter((row) => row.values.existing_product_id === EXPECTED.allInOneProductId);
  const tintUpdates = tintRows.filter((row) => row.values.action === "UPDATE_EXISTING");
  const tintCreates = tintRows.filter((row) => row.values.action === "ADD_VARIANT_TO_EXISTING");
  const tintUpdate = tintUpdates[0]?.values;
  const allInOne = allRows[0]?.values;

  if (tintRows.length !== 23) errors.push({ message: `Tintes debe tener 23 filas; tiene ${tintRows.length}.` });
  if (tintUpdates.length !== 1) errors.push({ message: `Tintes debe tener 1 UPDATE_EXISTING; tiene ${tintUpdates.length}.` });
  if (tintCreates.length !== 22) errors.push({ message: `Tintes debe tener 22 ADD_VARIANT_TO_EXISTING; tiene ${tintCreates.length}.` });
  if (allRows.length !== 1) errors.push({ message: `All in One debe tener 1 fila; tiene ${allRows.length}.` });
  if (tintUpdate?.existing_variant_id !== EXPECTED.tintVariantId) errors.push({ message: "Variant ID de tinte no coincide con el confirmado." });
  if (tintUpdate?.handle !== EXPECTED.tintHandle) errors.push({ message: "Handle de tinte no coincide." });
  if (tintUpdate?.sku !== "VOGLIA-TINTE-1-90ML") errors.push({ message: "SKU nuevo de la variante reutilizada no coincide." });
  if (tintUpdate?.price_mxn !== "97") errors.push({ message: "Precio de tinte debe ser 97 MXN." });
  if (tintUpdate?.stock !== "10") errors.push({ message: "Stock de tinte debe ser 10." });
  if (allInOne?.action !== "UPDATE_EXISTING") errors.push({ message: "All in One debe ser UPDATE_EXISTING." });
  if (allInOne?.existing_variant_id !== EXPECTED.allInOneVariantId) errors.push({ message: "Variant ID de All in One no coincide." });
  if (allInOne?.handle !== EXPECTED.allInOneHandle) errors.push({ message: "Handle de All in One no coincide." });
  if (allInOne?.sku !== EXPECTED.allInOneSku) errors.push({ message: "SKU de All in One no debe cambiar." });
  if (allInOne?.price_mxn !== "146") errors.push({ message: "Precio de All in One debe conservar 146 MXN." });
  if (allInOne?.stock !== "5") errors.push({ message: "Stock de All in One debe ser 5." });

  const duplicateSkus = duplicates(rows, "sku");
  const duplicateBarcodes = duplicates(rows, "barcode");
  for (const duplicate of duplicateSkus) errors.push({ message: `SKU duplicado ${duplicate.value} en filas ${duplicate.rowNumbers.join(", ")}.` });
  for (const duplicate of duplicateBarcodes) errors.push({ message: `Barcode duplicado ${duplicate.value} en filas ${duplicate.rowNumbers.join(", ")}.` });
  return { errors, warnings, duplicateSkus, duplicateBarcodes };
}

function variantPayload(row) {
  const item = row.values;
  return {
    row: row.rowNumber,
    action: item.action,
    product_id: item.existing_product_id,
    variant_id: item.existing_variant_id || null,
    title: item.variant_title,
    options: { [item.option_name]: item.variant_title },
    sku: item.sku,
    barcode: item.barcode,
    ean: item.ean || null,
    upc: item.upc || null,
    price_mxn: toNumber(item.price_mxn),
    stock: toNumber(item.stock),
    manage_inventory: item.manage_inventory === "true",
    allow_backorder: item.allow_backorder === "true",
  };
}

function buildPlan(rows) {
  const tintRows = rows.filter((row) => row.values.existing_product_id === EXPECTED.tintProductId);
  return {
    option: { product_id: EXPECTED.tintProductId, title: "Tono", values: tintRows.map((row) => row.values.variant_title) },
    updates: rows.filter((row) => row.values.action === "UPDATE_EXISTING").map(variantPayload),
    creates: rows.filter((row) => row.values.action === "ADD_VARIANT_TO_EXISTING").map(variantPayload),
  };
}

function count(rows, column) {
  return rows.reduce((acc, row) => ({ ...acc, [row.values[column]]: (acc[row.values[column]] ?? 0) + 1 }), {});
}

function printTable(title, rows, columns) {
  console.log(`\n${title}`);
  console.log(columns.join("\t"));
  for (const row of rows) console.log(columns.map((column) => row[column] ?? "").join("\t"));
}

function printDryRun(file, header, rows, validation, plan) {
  console.log("Voglia catalog import dry-run");
  console.log(`CSV: ${path.resolve(file)}`);
  console.log(`Columnas: ${header.length}`);
  console.log(`Filas: ${rows.length}`);
  console.log(`Errores: ${validation.errors.length}`);
  console.log(`Advertencias: ${validation.warnings.length}`);
  console.log(`Acciones: ${JSON.stringify(count(rows, "action"))}`);
  console.log(`Review status: ${JSON.stringify(count(rows, "review_status"))}`);
  console.log(`SKUs duplicados: ${validation.duplicateSkus.length}`);
  console.log(`Barcodes duplicados: ${validation.duplicateBarcodes.length}`);
  console.log("\nIDs objetivo confirmados por CSV maestro y auditoria previa:");
  console.log(`- Tinte Product ID: ${EXPECTED.tintProductId}`);
  console.log(`- Tinte Variant ID reutilizado: ${EXPECTED.tintVariantId}`);
  console.log(`- All in One Product ID: ${EXPECTED.allInOneProductId}`);
  console.log(`- All in One Variant ID: ${EXPECTED.allInOneVariantId}`);
  console.log("\nContexto que --apply debe confirmar desde Medusa antes de escribir:");
  console.log("- Region MXN, sales channel, stock location, price sets y duplicados globales.");
  console.log(`\nOpcion simulada: ${plan.option.title} (${plan.option.values.length} valores)`);
  printTable("Variantes existentes que se actualizarian", plan.updates, ["product_id", "variant_id", "title", "sku", "barcode", "price_mxn", "stock"]);
  printTable("22 variantes que se crearian", plan.creates, ["title", "sku", "barcode", "price_mxn", "stock"]);
  console.log("\nResultado: dry-run completado. No se escribio ningun dato.");
}


function uniqueValues(rows, column) {
  return [...new Set(rows.map((row) => row.values[column]).filter(Boolean))];
}

function classifyMatch(value, matches, expectedProductIds) {
  if (!matches.length) return { value, status: "no encontrado", matches: [] };
  const expected = matches.every((match) => expectedProductIds.includes(match.product_id));
  return {
    value,
    status: expected ? "coincidencia esperada" : "conflicto",
    matches: matches.map((match) => ({
      product_id: match.product_id,
      product_title: match.product_title,
      variant_id: match.id,
      sku: match.sku,
      barcode: match.barcode,
    })),
  };
}

function printJson(title, value) {
  console.log(`\n${title}`);
  console.log(JSON.stringify(value, null, 2));
}

async function preflightLive(container, rows) {
  if (!container) throw new Error("--preflight-live debe ejecutarse con medusa exec para recibir el contenedor de Medusa.");
  let query;
  try {
    query = container.resolve("query");
  } catch (error) {
    throw new Error(`No se pudo cargar el servicio de lectura query: ${error.message}`);
  }

  const expectedProductIds = [EXPECTED.tintProductId, EXPECTED.allInOneProductId];
  const csvSkus = uniqueValues(rows, "sku");
  const csvBarcodes = uniqueValues(rows, "barcode");
  const csvHandles = [EXPECTED.tintHandle, EXPECTED.allInOneHandle];

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id", "title", "handle", "status", "thumbnail", "images.*", "options.*",
      "sales_channels.*", "shipping_profile.*", "variants.*", "variants.options.*",
      "variants.price_set.*", "variants.prices.*", "variants.inventory_items.*",
    ],
    filters: { id: expectedProductIds },
  });

  if (products.length !== 2) throw new Error("Preflight abortado: no se encontraron exactamente los dos productos objetivo.");

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code"],
    filters: { currency_code: "mxn" },
  });
  const { data: stockLocations } = await query.graph({ entity: "stock_location", fields: ["id", "name"] });
  const { data: salesChannels } = await query.graph({ entity: "sales_channel", fields: ["id", "name"] });
  const { data: shippingProfiles } = await query.graph({ entity: "shipping_profile", fields: ["id", "name", "type"] });
  const { data: skuMatches } = await query.graph({
    entity: "product_variant",
    fields: ["id", "sku", "barcode", "product_id", "product.title"],
    filters: { sku: csvSkus },
  });
  const { data: barcodeMatches } = await query.graph({
    entity: "product_variant",
    fields: ["id", "sku", "barcode", "product_id", "product.title"],
    filters: { barcode: csvBarcodes },
  });
  const { data: handleMatches } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle"],
    filters: { handle: csvHandles },
  });

  const targetInventoryItemIds = products
    .flatMap((product) => product.variants ?? [])
    .flatMap((variant) => variant.inventory_items ?? [])
    .map((item) => item.inventory_item_id ?? item.id)
    .filter(Boolean);

  const { data: inventoryLevels } = targetInventoryItemIds.length
    ? await query.graph({
        entity: "inventory_level",
        fields: ["id", "inventory_item_id", "location_id", "stocked_quantity", "reserved_quantity"],
        filters: { inventory_item_id: targetInventoryItemIds },
      })
    : { data: [] };

  printJson("Productos objetivo", products);
  printJson("Regiones MXN", regions);
  printJson("Sales channels", salesChannels);
  printJson("Stock locations", stockLocations);
  printJson("Shipping profiles", shippingProfiles);
  printJson("Inventory levels actuales", inventoryLevels);
  printJson("Coincidencias de handles", csvHandles.map((handle) => ({
    handle,
    status: handleMatches.some((match) => match.handle === handle) ? "coincidencia esperada" : "no encontrado",
    matches: handleMatches.filter((match) => match.handle === handle),
  })));
  printJson("Coincidencias de SKUs", csvSkus.map((sku) => classifyMatch(sku, skuMatches.filter((match) => match.sku === sku), expectedProductIds)));
  printJson("Coincidencias de barcodes", csvBarcodes.map((barcode) => classifyMatch(barcode, barcodeMatches.filter((match) => match.barcode === barcode), expectedProductIds)));

  const tint = products.find((product) => product.id === EXPECTED.tintProductId);
  console.log("\nEstructura de tinte");
  console.log(`Opcion Tono existente: ${Boolean((tint.options ?? []).some((option) => option.title === "Tono"))}`);
  console.log(`Variante reutilizable conservando ID: ${Boolean((tint.variants ?? []).some((variant) => variant.id === EXPECTED.tintVariantId))}`);
  console.log("Resultado esperado tras apply futuro: 23 variantes en el producto de tintes, sin productos nuevos.");
  console.log("\nPreflight live finalizado. No se invoco ningun workflow ni servicio de escritura.");
}

async function assertApplySafety(container, args) {
  if (!container) throw new Error("--apply debe ejecutarse con medusa exec para recibir el contenedor de Medusa.");
  if (args.confirm !== APPLY_CONFIRMATION) throw new Error(`--apply requiere --confirm ${APPLY_CONFIRMATION}.`);
  const query = container.resolve("query");
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "options.*", "variants.*", "variants.options.*", "variants.prices.*", "variants.inventory_items.*", "sales_channels.*"],
    filters: { id: [EXPECTED.tintProductId, EXPECTED.allInOneProductId] },
  });
  const tint = products.find((product) => product.id === EXPECTED.tintProductId);
  const allInOne = products.find((product) => product.id === EXPECTED.allInOneProductId);
  if (products.length !== 2 || tint?.handle !== EXPECTED.tintHandle || allInOne?.handle !== EXPECTED.allInOneHandle) throw new Error("Apply abortado: productos objetivo inesperados.");
  if (!(tint.variants ?? []).some((variant) => variant.id === EXPECTED.tintVariantId)) throw new Error("Apply abortado: falta Variant ID real de tintes.");
  if (!(allInOne.variants ?? []).some((variant) => variant.id === EXPECTED.allInOneVariantId)) throw new Error("Apply abortado: falta Variant ID real de All in One.");
  return { query, tint };
}

async function applyCatalog(container, args, plan) {
  const { query, tint } = await assertApplySafety(container, args);
  const {
    createProductVariantsWorkflow,
    updateProductVariantsWorkflow,
    updateProductsWorkflow,
    createInventoryLevelsWorkflow,
    updateInventoryLevelsWorkflow,
  } = require("@medusajs/medusa/core-flows");

  if (!(tint.options ?? []).some((option) => option.title === "Tono")) {
    await updateProductsWorkflow(container).run({ input: { selector: { id: EXPECTED.tintProductId }, update: { options: [{ title: "Tono", values: plan.option.values }] } } });
  }

  await updateProductVariantsWorkflow(container).run({ input: { product_variants: plan.updates.map((variant) => ({ id: variant.variant_id, product_id: variant.product_id, title: variant.title, sku: variant.sku, barcode: variant.barcode, ean: variant.ean, upc: variant.upc, manage_inventory: variant.manage_inventory, allow_backorder: variant.allow_backorder, options: variant.options, prices: [{ currency_code: "mxn", amount: variant.price_mxn }] })) } });

  if (plan.creates.length) {
    await createProductVariantsWorkflow(container).run({ input: { product_variants: plan.creates.map((variant) => ({ product_id: variant.product_id, title: variant.title, sku: variant.sku, barcode: variant.barcode, ean: variant.ean, upc: variant.upc, manage_inventory: variant.manage_inventory, allow_backorder: variant.allow_backorder, options: variant.options, prices: [{ currency_code: "mxn", amount: variant.price_mxn }] })) } });
  }

  const { data: stockLocations } = await query.graph({ entity: "stock_location", fields: ["id", "name"] });
  if (stockLocations.length !== 1) throw new Error("Apply abortado: no se pudo identificar una sola stock location activa.");
  const stockLocation = stockLocations[0];
  const targetSkus = [...plan.updates, ...plan.creates].map((variant) => variant.sku);
  const { data: variants } = await query.graph({ entity: "product_variant", fields: ["id", "sku", "inventory_items.*"], filters: { sku: targetSkus } });
  const creates: { location_id: string; stocked_quantity: number; inventory_item_id: string }[] = [];
  const updates: { id: string; stocked_quantity: number }[] = [];

  for (const variant of [...plan.updates, ...plan.creates]) {
    const current = variants.find((item) => item.sku === variant.sku);
    const inventoryItem = current?.inventory_items?.[0];
    const inventoryItemId = inventoryItem?.inventory_item_id ?? inventoryItem?.id;
    if (!inventoryItemId) throw new Error(`Apply abortado: no se encontro inventory item para ${variant.sku}.`);
    const { data: levels } = await query.graph({ entity: "inventory_level", fields: ["id", "inventory_item_id", "location_id", "stocked_quantity"], filters: { inventory_item_id: inventoryItemId, location_id: stockLocation.id } });
    if (levels.length) updates.push({ id: levels[0].id, stocked_quantity: variant.stock });
    else creates.push({ location_id: stockLocation.id, stocked_quantity: variant.stock, inventory_item_id: inventoryItemId });
  }

  if (creates.length) await createInventoryLevelsWorkflow(container).run({ input: { inventory_levels: creates } });
  if (updates.length) await updateInventoryLevelsWorkflow(container).run({ input: { inventory_levels: updates } });
}

async function run({ container, args: cliArgs }: ExecArgs) {
  const args = parseArgs(cliArgs ?? []);
  const { header, rows } = readCatalog(args.file);
  const validation = validate(header, rows);
  const plan = buildPlan(rows);
  if (validation.errors.length) {
    console.error("Errores de validacion:");
    validation.errors.forEach((error) => console.error(`- ${error.message}`));
    process.exitCode = 1;
    return;
  }
  if (args.mode === "dry-run") printDryRun(args.file, header, rows, validation, plan);
  else if (args.mode === "preflight-live") await preflightLive(container, rows);
  else if (args.mode === "apply") await applyCatalog(container, args, plan);
  else throw new Error(`Modo no reconocido: ${args.mode}`);
}

export default run;
