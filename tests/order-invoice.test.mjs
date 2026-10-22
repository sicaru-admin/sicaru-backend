import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { registerHooks } from "node:module";

// All external services are in-process fakes. No invoices, messages or payments are sent.
const oldEnvironment = process.env.RAILWAY_ENVIRONMENT_ID;
const hook = registerHooks({ resolve(specifier, context, next) {
  const data = source => ({ shortCircuit: true, url: "data:text/javascript," + encodeURIComponent(source) });
  if (specifier === "@medusajs/framework/utils") return data("export const ContainerRegistrationKeys={QUERY:'query',REMOTE_LINK:'remote_link'};export const Modules={ORDER:'order'};");
  if (specifier.endsWith("/modules/facturapi")) return data("export const FACTURAPI_MODULE='facturapi';");
  if (specifier.endsWith("/modules/whatsapp")) return data("export const WHATSAPP_MODULE='whatsapp';");
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return next(new URL(specifier + ".ts", context.parentURL).href, context);
  return next(specifier, context);
} });
const { buildOrderInvoiceItems, formatOrderTotalMxn } = await import("../src/lib/order-invoice.ts");
const { POST: invoiceRoute } = await import("../src/api/admin/orders/[id]/invoice/route.ts");
const { default: invoiceSubscriber } = await import("../src/subscribers/invoice-on-order-placed.ts");
const { default: whatsappSubscriber } = await import("../src/subscribers/whatsapp-order-placed.ts");
hook.deregister();

function fixture(quantity = 1) {
  const total = 97 * quantity;
  const tax = total * 0.16 / 1.16;
  return {
    id: "order_synthetic", customer_id: "customer_synthetic", display_id: 123,
    metadata: { requires_invoice: true }, currency_code: "mxn", total, tax_total: tax,
    shipping_total: 0, discount_total: 0,
    shipping_address: { phone: "0000000000", first_name: "Sintética" },
    shipping_methods: [{ name: "Paquetería verificada" }],
    items: [{ title: "Producto sintético", quantity, unit_price: 97, is_tax_inclusive: true,
      total, tax_total: tax, discount_total: 0, tax_lines: [{ rate: 16 }] }],
    payment_collections: [{ payments: [{ data: { payment_type_id: "credit_card" } }] }],
  };
}
beforeEach(() => { delete process.env.RAILWAY_ENVIRONMENT_ID; });
after(() => { if (oldEnvironment === undefined) delete process.env.RAILWAY_ENVIRONMENT_ID; else process.env.RAILWAY_ENVIRONMENT_ID = oldEnvironment; });

function services(order) {
  const calls = [];
  const container = { resolve(name) {
    if (name === "logger") return { info() {}, error(message) { calls.push(["error", message]); } };
    if (name === "query") return { graph: async ({ entity }) => ({ data: entity === "order" ? [order] : [{ email: "synthetic@example.invalid", fiscal_data: {
      id: "fiscal_synthetic", razon_social: "SINTÉTICA", rfc: "SYNTHETIC", regimen_fiscal: "616", codigo_postal_fiscal: "67480", uso_cfdi: "S01",
    } }] }) };
    if (name === "remote_link") return { create: async () => { calls.push(["link"]); } };
    if (name === "facturapi") return {
      createFacturapiCustomer: async () => { calls.push(["customer"]); return { id: "f_customer" }; },
      updateFiscalDatas: async () => {},
      createCFDI: async value => { calls.push(["invoice", value]); return { id: "f_invoice", total: order.total }; },
      createInvoiceRecords: async () => ({ id: "invoice_record_synthetic" }),
      sendByEmail: async () => { calls.push(["email"]); },
    };
    if (name === "whatsapp") return { sendTemplate: async (...args) => { calls.push(["whatsapp", ...args]); } };
    throw new Error("Unexpected service: " + name);
  } };
  return { container, calls };
}

test("Medusa v2 prices retain MXN and explicit IVA inclusion for quantities one and three", () => {
  for (const qty of [1, 3]) {
    const lines = buildOrderInvoiceItems(fixture(qty));
    assert.equal(lines[0].price, 97);
    assert.equal(lines[0].quantity, qty);
    assert.equal(lines[0].tax_included, true);
    assert.deepEqual(lines[0].taxes, [{ type: "IVA", rate: 0.16 }]);
  }
});

test("exclusive IVA prices are passed as exclusive without altering commercial prices", () => {
  const order = fixture();
  Object.assign(order, { total: 116, tax_total: 16 });
  Object.assign(order.items[0], { unit_price: 100, is_tax_inclusive: false, total: 116, tax_total: 16 });
  const [line] = buildOrderInvoiceItems(order);
  assert.equal(line.price, 100);
  assert.equal(line.tax_included, false);
});

test("unverified tax evidence and mismatched totals cannot be invoiced", () => {
  for (const edit of [
    order => { order.total = 0.97; },
    order => { order.total = 112.52; },
    order => { order.tax_total = 0; },
    order => { order.items[0].tax_lines = []; },
    order => { order.items[0].is_tax_inclusive = undefined; },
    order => { order.items[0].tax_total = 15.52; },
    order => { order.items[0].quantity = 0; },
    order => { order.currency_code = "usd"; },
    order => { delete order.total; },
  ]) {
    const order = fixture(); edit(order);
    assert.throws(() => buildOrderInvoiceItems(order));
  }
});

test("paid shipping and discounts need fiscal review instead of incomplete CFDI totals", () => {
  const shipped = fixture(); Object.assign(shipped, { shipping_total: 214, total: 311 });
  assert.throws(() => buildOrderInvoiceItems(shipped), /revisión fiscal de la paquetería/);
  const discounted = fixture(); Object.assign(discounted, { discount_total: 10, total: 87 });
  assert.throws(() => buildOrderInvoiceItems(discounted), /revisión fiscal de los descuentos/);
  const lineDiscounted = fixture(); lineDiscounted.items[0].discount_total = 10;
  assert.throws(() => buildOrderInvoiceItems(lineDiscounted), /revisión fiscal de los descuentos/);
});

test("both invoice entry points pass the verified MXN price and tax inclusion", async () => {
  for (const mode of ["route", "subscriber"]) {
    const order = fixture(3), { container, calls } = services(order);
    if (mode === "route") {
      let status;
      const response = { status(value) { status = value; return this; }, json() {} };
      await invoiceRoute({ scope: container, params: { id: order.id } }, response);
      assert.equal(status, 201);
    } else await invoiceSubscriber({ event: { data: { id: order.id } }, container });
    const issued = calls.find(([type]) => type === "invoice");
    assert.equal(issued[1].items[0].price, 97);
    assert.equal(issued[1].items[0].tax_included, true);
    assert.equal(issued[1].items[0].quantity, 3);
  }
});

test("invoice mismatch stops both entry points before customer creation or stamping", async () => {
  for (const mode of ["route", "subscriber"]) {
    const order = fixture(); Object.assign(order, { shipping_total: 214, total: 311 });
    const { container, calls } = services(order);
    if (mode === "route") {
      let status;
      const response = { status(value) { status = value; return this; }, json() {} };
      await invoiceRoute({ scope: container, params: { id: order.id } }, response);
      assert.equal(status, 400);
    } else await invoiceSubscriber({ event: { data: { id: order.id } }, container });
    assert.equal(calls.some(([type]) => ["customer", "invoice", "email"].includes(type)), false);
  }
});

test("manual invoice creation is disabled in review before resolving external services", async () => {
  process.env.RAILWAY_ENVIRONMENT_ID = "a04c43a9-03ec-44ff-8486-f64524c1cc8f";
  let status;
  await invoiceRoute({ scope: { resolve() { throw new Error("External service resolved"); } } }, {
    status(value) { status = value; return this; }, json() {},
  });
  assert.equal(status, 403);
});

test("WhatsApp formats the saved order total with shipping, discounts and IVA in MXN", async () => {
  const order = fixture(); Object.assign(order, { total: 301, shipping_total: 214, discount_total: 10 });
  assert.equal(formatOrderTotalMxn(order), "301.00");
  const { container, calls } = services(order);
  await whatsappSubscriber({ event: { data: { id: order.id } }, container });
  const sent = calls.find(([type]) => type === "whatsapp");
  assert.equal(sent.at(-1)[2], "301.00");
  assert.equal(sent.at(-1)[3], "Paquetería verificada");
});
