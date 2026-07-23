const { readFileSync } = require("node:fs");
const { extname, resolve } = require("node:path");

const REQUIRED_COLUMNS = [
  "action",
  "existing_product_id",
  "existing_variant_id",
  "brand",
  "line",
  "product_type",
  "title",
  "handle",
  "description",
  "benefits",
  "instructions",
  "warnings",
  "category",
  "collection",
  "option_name",
  "variant_title",
  "tone_code",
  "tone_name",
  "presentation",
  "sku",
  "barcode",
  "ean",
  "upc",
  "price_mxn",
  "stock",
  "manage_inventory",
  "allow_backorder",
  "thumbnail_file",
  "image_files",
  "weight_g",
  "length_cm",
  "width_cm",
  "height_cm",
  "sales_channel",
  "shipping_profile",
  "tags",
  "metadata_source",
  "source_reference",
  "notes",
  "review_status",
];

const ALLOWED_ACTIONS = new Set([
  "UPDATE_EXISTING",
  "ADD_VARIANT_TO_EXISTING",
  "CREATE_NEW",
  "REVIEW_REQUIRED",
  "SKIP_DUPLICATE",
]);

const ALLOWED_REVIEW_STATUS = new Set(["PENDING", "REVIEWED", "APPROVED", "REJECTED"]);
const ALLOWED_BOOLEAN = new Set(["true", "false"]);
const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const SPACED_UNITS = /\b\d+(?:\.\d+)?(?:ml|l|oz|g|kg|cm|mm)\b/i;
const UNIT_COLUMNS = [
  "title",
  "description",
  "benefits",
  "instructions",
  "warnings",
  "variant_title",
  "presentation",
  "notes",
];

type CatalogRow = Record<string, string>;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((candidate) => candidate.some((value) => value.trim() !== ""));
}

function countBy(values) {
  return values.reduce((summary, value) => {
    summary[value] = (summary[value] ?? 0) + 1;
    return summary;
  }, {});
}

function addDuplicateWarnings(rows, key, label, warnings) {
  const seen = new Map();

  rows.forEach((row, index) => {
    const value = row[key].trim();
    if (!value) {
      return;
    }
    seen.set(value, [...(seen.get(value) ?? []), index + 2]);
  });

  for (const [value, rowNumbers] of seen) {
    if (rowNumbers.length > 1) {
      warnings.push({
        message: `${label} duplicado "${value}" en filas ${rowNumbers.join(", ")}`,
      });
    }
  }
}

function validateCatalog(filePath) {
  const csv = readFileSync(filePath, "utf8");
  const parsedRows = parseCsv(csv);
  const [header, ...records] = parsedRows;
  const errors = [];
  const warnings = [];

  if (!header) {
    errors.push({ message: "El CSV está vacío." });
    return { rows: [], errors, warnings };
  }

  header[0] = header[0]?.replace(/^\uFEFF/, "") ?? "";

  const missingColumns = REQUIRED_COLUMNS.filter((column) => !header.includes(column));
  const extraColumns = header.filter((column) => !REQUIRED_COLUMNS.includes(column));

  for (const column of missingColumns) {
    errors.push({ message: `Falta la columna obligatoria "${column}".` });
  }

  for (const column of extraColumns) {
    warnings.push({ message: `Columna no esperada "${column}".` });
  }

  if (missingColumns.length > 0) {
    return { rows: [], errors, warnings };
  }

  const rows: CatalogRow[] = records.map((record, recordIndex) => {
    const row: CatalogRow = {};
    REQUIRED_COLUMNS.forEach((column) => {
      const sourceIndex = header.indexOf(column);
      row[column] = record[sourceIndex]?.trim() ?? "";
    });

    if (record.length !== header.length) {
      errors.push({
        row: recordIndex + 2,
        message: `La fila tiene ${record.length} columnas; se esperaban ${header.length}.`,
      });
    }

    return row;
  });

  rows.forEach((row, index) => {
    const rowNumber = index + 2;

    if (!ALLOWED_ACTIONS.has(row.action)) {
      errors.push({ row: rowNumber, message: `action inválida: "${row.action}".` });
    }

    if (!ALLOWED_REVIEW_STATUS.has(row.review_status)) {
      errors.push({ row: rowNumber, message: `review_status inválido: "${row.review_status}".` });
    }

    if (row.brand !== "Voglia") {
      errors.push({ row: rowNumber, message: "brand debe ser Voglia." });
    }

    if (row.collection !== "Voglia") {
      errors.push({ row: rowNumber, message: "collection debe ser Voglia." });
    }

    if (!ALLOWED_BOOLEAN.has(row.manage_inventory)) {
      errors.push({ row: rowNumber, message: "manage_inventory debe ser true o false." });
    }

    if (!ALLOWED_BOOLEAN.has(row.allow_backorder)) {
      errors.push({ row: rowNumber, message: "allow_backorder debe ser true o false." });
    }

    if (row.price_mxn && !/^\d+(?:\.\d{1,2})?$/.test(row.price_mxn)) {
      errors.push({ row: rowNumber, message: `price_mxn inválido: "${row.price_mxn}".` });
    }

    if (row.stock && !/^\d+$/.test(row.stock)) {
      errors.push({ row: rowNumber, message: `stock inválido: "${row.stock}".` });
    }

    if (!row.presentation) {
      errors.push({ row: rowNumber, message: "presentation no debe estar vacía." });
    }

    if (row.handle && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.handle)) {
      errors.push({ row: rowNumber, message: `handle debe estar en minúsculas, sin acentos y con guiones: "${row.handle}".` });
    }

    if (!row.metadata_source && !row.source_reference) {
      errors.push({ row: rowNumber, message: "La fila no tiene fuente: metadata_source o source_reference." });
    }

    if (row.action === "CREATE_NEW" && row.existing_product_id) {
      errors.push({ row: rowNumber, message: "CREATE_NEW no debe incluir existing_product_id." });
    }

    if (row.action === "UPDATE_EXISTING" && !row.existing_product_id) {
      errors.push({ row: rowNumber, message: "UPDATE_EXISTING requiere existing_product_id." });
    }

    if (row.action === "ADD_VARIANT_TO_EXISTING" && !row.existing_product_id) {
      errors.push({ row: rowNumber, message: "ADD_VARIANT_TO_EXISTING requiere existing_product_id." });
    }

    if (row.action === "SKIP_DUPLICATE" && !row.notes) {
      errors.push({ row: rowNumber, message: "SKIP_DUPLICATE requiere una nota explicativa." });
    }

    const imageFiles = [row.thumbnail_file, ...row.image_files.split(";")].map((item) => item.trim()).filter(Boolean);
    for (const imageFile of imageFiles) {
      const extension = extname(imageFile).toLowerCase();
      if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
        errors.push({ row: rowNumber, message: `Imagen con extensión no permitida: "${imageFile}".` });
      }
    }

    for (const column of REQUIRED_COLUMNS) {
      const value = row[column];
      if (/\s{2,}/.test(value)) {
        warnings.push({ row: rowNumber, message: `Espacios dobles detectados en "${column}".` });
      }
    }

    for (const column of UNIT_COLUMNS) {
      const value = row[column];
      if (SPACED_UNITS.test(value)) {
        warnings.push({ row: rowNumber, message: `Unidad pegada detectada en "${column}": "${value}". Usa formato como "250 ml".` });
      }
    }
  });

  addDuplicateWarnings(rows, "sku", "SKU", warnings);
  addDuplicateWarnings(rows, "handle", "handle", warnings);

  const productIds = new Map();
  rows.forEach((row) => {
    if (!row.existing_product_id || !row.handle) {
      return;
    }
    const handles = productIds.get(row.existing_product_id) ?? new Set();
    handles.add(row.handle);
    productIds.set(row.existing_product_id, handles);
  });

  for (const [productId, handles] of productIds) {
    if (handles.size > 1) {
      errors.push({
        message: `existing_product_id duplicado incompatible "${productId}" con handles: ${Array.from(handles).join(", ")}`,
      });
    }
  }

  return { rows, errors, warnings };
}

function printMessages(title, messages) {
  console.log(`\n${title}: ${messages.length}`);
  for (const entry of messages) {
    const prefix = entry.row ? `Fila ${entry.row}: ` : "";
    console.log(`- ${prefix}${entry.message}`);
  }
}

const filePath = resolve(process.argv[2] ?? "data/voglia-catalog-master.csv");
const { rows, errors, warnings } = validateCatalog(filePath);
const uniqueProducts = new Set(rows.map((row) => row.existing_product_id || row.handle).filter(Boolean));
const actionCounts = countBy(rows.map((row) => row.action));
const reviewStatusCounts = countBy(rows.map((row) => row.review_status));

console.log("Reporte de validación del catálogo Voglia");
console.log(`Archivo: ${filePath}`);
console.log(`Total de filas: ${rows.length}`);
console.log(`Total de productos únicos: ${uniqueProducts.size}`);
console.log(`Total de variantes: ${rows.length}`);
console.log(`Total por action: ${JSON.stringify(actionCounts)}`);
console.log(`Total por review_status: ${JSON.stringify(reviewStatusCounts)}`);

printMessages("Errores", errors);
printMessages("Advertencias", warnings);

if (errors.length > 0) {
  process.exitCode = 1;
}
