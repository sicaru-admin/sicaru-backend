export type Evidence = {
  source: string;
  verifiedAt: string;
};

export type DhlPolicy = {
  schemaVersion: number;
  enabled: boolean;
  revision: string;
  terms: Evidence & {
    accountConfirmed: boolean;
    serviceCode: string;
    originPostalCode: string;
    validUntil: string;
    taxInclusive: boolean;
    allSurchargesConfirmed: boolean;
    volumetricMode: "actual_only" | "max_actual_volumetric";
    volumetricDivisor: number | null;
    roundingIncrementGrams: number;
  };
  variants: Record<string, Evidence & {
    unitWeightGrams: number;
    includesPrimaryPackaging: boolean;
  }>;
  // Exact, physically checked contents; no automatic packing/box assumptions.
  packages: Record<string, Evidence & {
    tareGrams: number;
    externalDimensionsCm: [number, number, number] | null;
  }>;
  coverage: Record<string, Evidence & {
    available: boolean;
    remoteArea: boolean | null;
    validUntil: string;
    serviceCode: string;
    originPostalCode: string;
  }>;
  optionIds: Record<"standard_1_2" | "standard_2_5" | "remote_1_2" | "remote_2_5", string | null>;
};

export type DhlCart = {
  id: string;
  currency_code?: string | null;
  items?: { variant_id?: string | null; quantity: number }[] | null;
  shipping_address?: { country_code?: string | null; postal_code?: string | null } | null;
  shipping_methods?: {
    shipping_option_id?: string | null;
    amount?: number;
    is_tax_inclusive?: boolean;
  }[] | null;
  shipping_total?: number;
  total?: number;
  payment_collection?: { amount?: number; currency_code?: string } | null;
};

const MESSAGES: Record<string, string> = {
  tariff_unconfirmed: "Confirma tu envío DHL por WhatsApp antes de pagar.",
  weight_unknown: "Necesitamos confirmar el peso de tus productos para cotizar DHL.",
  packaging_unknown: "Necesitamos confirmar el peso y las medidas del paquete para cotizar DHL.",
  volumetric_unknown: "Necesitamos confirmar el peso facturable del paquete con DHL.",
  below_1kg: "Los paquetes de menos de 1 kg requieren cotización por WhatsApp.",
  above_5kg: "Los paquetes de más de 5 kg requieren cotización por WhatsApp.",
  coverage_unknown: "Necesitamos confirmar la cobertura y si tu dirección tiene recargo de zona remota.",
  no_coverage: "Consulta por WhatsApp las opciones disponibles para tu dirección.",
  service_unconfigured: "Consulta tu cotización DHL por WhatsApp antes de pagar.",
};

export type DhlQuote =
  | { status: "quote_required"; reason: string; message: string }
  | {
      status: "available";
      shipping_option_id: string;
      amount: number;
      currency_code: "mxn";
      base_amount: number;
      remote_surcharge: number;
      actual_weight_g: number;
      billable_weight_g: number;
      policy_revision: string;
    };

export function quoteRequired(reason: string): DhlQuote {
  return { status: "quote_required", reason, message: MESSAGES[reason] ?? MESSAGES.service_unconfigured };
}

function verified(e: Evidence | undefined, now: number): boolean {
  const time = Date.parse(e?.verifiedAt ?? "");
  return typeof e?.source === "string" && !!e.source.trim() && Number.isFinite(time) && time <= now;
}

function current(e: (Evidence & { validUntil: string }) | undefined, now: number): boolean {
  return verified(e, now) && Date.parse(e!.validUntil) > now;
}

export function cartSignature(items: DhlCart["items"]): string | null {
  if (!items?.length) return null;
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.variant_id || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) return null;
    const count = (counts.get(item.variant_id) ?? 0) + item.quantity;
    if (!Number.isSafeInteger(count)) return null;
    counts.set(item.variant_id, count);
  }
  return [...counts].sort(([a], [b]) => a.localeCompare(b))
    .map(([id, count]) => `${id}:${count}`).join("|");
}

export function quoteDhl(
  policy: DhlPolicy | null | undefined,
  cart: DhlCart,
  now = Date.now()
): DhlQuote {
  const terms = policy?.terms;
  if (
    policy?.enabled !== true || policy.schemaVersion !== 1 || !policy.revision ||
    terms?.accountConfirmed !== true || !current(terms, now) ||
    terms.taxInclusive !== true || terms.allSurchargesConfirmed !== true ||
    !terms.serviceCode?.trim() || !/^\d{5}$/.test(terms.originPostalCode ?? "") ||
    !Number.isSafeInteger(terms.roundingIncrementGrams) || terms.roundingIncrementGrams <= 0
  ) return quoteRequired("tariff_unconfirmed");
  if (cart.currency_code?.toLowerCase() !== "mxn") return quoteRequired("service_unconfigured");

  const signature = cartSignature(cart.items);
  if (!signature) return quoteRequired("weight_unknown");
  let productsGrams = 0;
  for (const item of cart.items!) {
    const weight = policy.variants?.[item.variant_id!];
    if (!verified(weight, now) || weight?.includesPrimaryPackaging !== true ||
      !Number.isSafeInteger(weight.unitWeightGrams) || weight.unitWeightGrams <= 0) {
      return quoteRequired("weight_unknown");
    }
    productsGrams += weight.unitWeightGrams * item.quantity;
  }
  if (!Number.isSafeInteger(productsGrams)) return quoteRequired("weight_unknown");
  const pack = policy.packages?.[signature];
  if (!verified(pack, now) || !Number.isSafeInteger(pack?.tareGrams) || pack!.tareGrams <= 0) {
    return quoteRequired("packaging_unknown");
  }
  const actualGrams = productsGrams + pack!.tareGrams;
  if (!Number.isSafeInteger(actualGrams)) return quoteRequired("packaging_unknown");
  let billableGrams = actualGrams;
  if (terms.volumetricMode === "max_actual_volumetric") {
    const dimensions = pack!.externalDimensionsCm;
    if (!dimensions || dimensions.length !== 3 ||
      dimensions.some((n) => !Number.isFinite(n) || n <= 0) ||
      !Number.isFinite(terms.volumetricDivisor) || terms.volumetricDivisor! <= 0) {
      return quoteRequired("volumetric_unknown");
    }
    const volumeGrams = dimensions.reduce((a, b) => a * b, 1) / terms.volumetricDivisor! * 1000;
    if (!Number.isFinite(volumeGrams)) return quoteRequired("volumetric_unknown");
    billableGrams = Math.max(actualGrams, Math.ceil(volumeGrams));
  } else if (terms.volumetricMode !== "actual_only") {
    return quoteRequired("volumetric_unknown");
  }
  // No implicit one-kilogram minimum: the under-1kg case is unapproved.
  if (billableGrams < 1000) return quoteRequired("below_1kg");
  billableGrams = Math.ceil(billableGrams / terms.roundingIncrementGrams) * terms.roundingIncrementGrams;
  if (billableGrams > 5000) return quoteRequired("above_5kg");

  const address = cart.shipping_address;
  if (address?.country_code?.toLowerCase() !== "mx" || !/^\d{5}$/.test(address.postal_code ?? "")) {
    return quoteRequired("coverage_unknown");
  }
  const coverage = policy.coverage?.[address.postal_code!];
  if (!current(coverage, now) || coverage!.serviceCode !== terms.serviceCode ||
      coverage!.originPostalCode !== terms.originPostalCode ||
      typeof coverage!.remoteArea !== "boolean") return quoteRequired("coverage_unknown");
  if (coverage!.available !== true) return quoteRequired("no_coverage");
  const small = billableGrams <= 2000;
  const key = `${coverage!.remoteArea ? "remote" : "standard"}_${small ? "1_2" : "2_5"}` as keyof DhlPolicy["optionIds"];
  const optionId = policy.optionIds?.[key];
  const ids = Object.values(policy.optionIds ?? {}).filter(Boolean);
  if (!optionId || new Set(ids).size !== ids.length) return quoteRequired("service_unconfigured");
  const base = small ? 214 : 270;
  const surcharge = coverage!.remoteArea ? 118 : 0;
  return {
    status: "available", shipping_option_id: optionId, amount: base + surcharge,
    currency_code: "mxn", base_amount: base, remote_surcharge: surcharge,
    actual_weight_g: actualGrams, billable_weight_g: billableGrams,
    policy_revision: policy.revision,
  };
}

export function assertSelectedDhl(cart: DhlCart, quote: DhlQuote): void {
  if (quote.status !== "available") throw new Error(quote.message);
  const methods = cart.shipping_methods ?? [];
  if (methods.length !== 1 || methods[0].shipping_option_id !== quote.shipping_option_id ||
      Number(methods[0].amount) !== quote.amount || methods[0].is_tax_inclusive !== true ||
      Number(cart.shipping_total) !== quote.amount ||
      !Number.isFinite(Number(cart.total)) || Number(cart.total) < quote.amount) {
    throw new Error("Actualiza tu envío DHL y revisa el total antes de pagar. El envío local se coordina por WhatsApp.");
  }
}
