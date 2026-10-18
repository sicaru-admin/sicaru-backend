import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { registerHooks } from "node:module";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixture } from "./dhl-fixtures.mjs";

const directory = mkdtempSync(join(tmpdir(), "sicaru-dhl-test-"));
const previousFile = process.env.DHL_POLICY_FILE;
process.env.DHL_POLICY_FILE = join(directory, "policy.json");
let state;
let options;
let links;
let listingCalls;
const validations = {};
const mockKey = Symbol.for("sicaru.dhl.server.test");
class TestMedusaError extends Error {
  static Types = { INVALID_DATA: "invalid_data", NOT_FOUND: "not_found" };
  constructor(type, message) { super(message); this.type = type; }
}
globalThis[mockKey] = {
  MedusaError: TestMedusaError,
  listShippingOptionsForCartWorkflow: () => ({ run: async () => {
    listingCalls++;
    return { result: options };
  } }),
  addShippingMethodToCartWorkflow: { hooks: { validate: (fn) => { validations.add = fn; } } },
  completeCartWorkflow: { hooks: { validate: (fn) => { validations.complete = fn; } } },
};
const globals = "globalThis[Symbol.for('sicaru.dhl.server.test')]";
const hook = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@medusajs/framework/utils") return {
      shortCircuit: true,
      url: "data:text/javascript,export const ContainerRegistrationKeys={QUERY:'query'}; export const MedusaError=" + globals + ".MedusaError;",
    };
    if (specifier === "@medusajs/medusa/core-flows") return {
      shortCircuit: true,
      url: "data:text/javascript,export const { listShippingOptionsForCartWorkflow, addShippingMethodToCartWorkflow, completeCartWorkflow }=" + globals + ";",
    };
    if (specifier === "@medusajs/framework/http") return {
      shortCircuit: true, url: "data:text/javascript,export const defineMiddlewares = (value) => value;",
    };
    if (/\/dhl-(policy|checkout)$/.test(specifier)) {
      return next(new URL(specifier + ".ts", context.parentURL).href, context);
    }
    return next(specifier, context);
  },
});
const { getDhlCheckout, readDhlPolicy } = await import("../src/lib/dhl-checkout.ts");
const { guardDhlPayment } = await import("../src/api/middlewares.ts");
const { GET } = await import("../src/api/store/carts/[id]/dhl-quote/route.ts");
const { default: prepareOptions } = await import("../src/scripts/prepare-dhl-options.ts");
const { default: auditMedusa } = await import("../src/scripts/audit-dhl-readiness.ts");
await import("../src/workflows/hooks/dhl-checkout.ts");
hook.deregister();

const container = { resolve: () => ({
  graph: async ({ entity }) => ({ data: entity === "cart" ? [state.cart] : links }),
}) };
function savePolicy() {
  writeFileSync(process.env.DHL_POLICY_FILE, JSON.stringify(state.policy));
}
beforeEach(() => {
  state = fixture();
  state.cart.payment_collection = { amount: 514, currency_code: "mxn" };
  savePolicy();
  options = [{
    id: "dhl_small_test", name: "DHL 1–2 kg", provider_id: "manual_manual",
    price_type: "flat", amount: 214, is_tax_inclusive: true,
  }, {
    id: "local_old", name: "Envío Cadereyta", provider_id: "manual_manual",
    price_type: "flat", amount: 49, is_tax_inclusive: true,
  }];
  links = [{ cart_id: "cart_test" }];
  listingCalls = 0;
});
after(() => {
  if (previousFile === undefined) delete process.env.DHL_POLICY_FILE;
  else process.env.DHL_POLICY_FILE = previousFile;
  delete globalThis[mockKey];
  rmSync(directory, { recursive: true });
});

test("Medusa's eligible option and price must match the verified DHL rule", async () => {
  const result = await getDhlCheckout(container, "cart_test");
  assert.equal(result.quote.amount, 214);
  assert.equal(result.shippingOption.id, "dhl_small_test");
  assert.equal(listingCalls, 1);
});
test("the quote endpoint returns one DHL option with no cached response", async () => {
  let body;
  const headers = {};
  await GET({ scope: container, params: { id: "cart_test" } }, {
    setHeader: (name, value) => { headers[name] = value; },
    json: (value) => { body = value; },
  });
  assert.equal(headers["Cache-Control"], "private, no-store");
  assert.deepEqual(body.shipping_options.map((o) => o.id), ["dhl_small_test"]);
});
test("disabled or malformed policy exposes no payable option", async () => {
  state.policy.enabled = false;
  savePolicy();
  let result = await getDhlCheckout(container, "cart_test");
  assert.equal(result.quote.status, "quote_required");
  assert.equal(result.shippingOption, null);
  assert.equal(listingCalls, 0);
  writeFileSync(process.env.DHL_POLICY_FILE, "{");
  assert.equal(readDhlPolicy(), null);
  result = await getDhlCheckout(container, "cart_test");
  assert.equal(result.quote.status, "quote_required");
});
test("an old storefront cannot submit the former local $49 shipping method", async () => {
  await assert.rejects(validations.add({
    input: { cart_id: "cart_test", options: [{ id: "local_old" }] },
  }, { container }), /DHL verificado/);
});
test("an old saved $49 option cannot complete a cart through the workflow", async () => {
  state.cart.shipping_methods = [{ shipping_option_id: "local_old", amount: 49, is_tax_inclusive: true }];
  state.cart.shipping_total = 49;
  await assert.rejects(validations.complete({ input: { id: "cart_test" } }, { container }), /Actualiza/);
});
test("an invalid local method is rejected before the payment route runs", async () => {
  state.cart.shipping_methods[0].shipping_option_id = "local_old";
  let routeError;
  await guardDhlPayment({ scope: container, params: { id: "collection_test" } }, {}, (error) => { routeError = error; });
  assert.match(routeError.message, /Actualiza/);
});
test("a verified DHL cart can proceed to the payment route without creating a payment in the test", async () => {
  let called = false;
  await guardDhlPayment({ scope: container, params: { id: "collection_test" } }, {}, (error) => {
    assert.equal(error, undefined);
    called = true;
  });
  assert.equal(called, true);
  await assert.doesNotReject(validations.complete({ input: { id: "cart_test" } }, { container }));
});
test("changing to a destination without verified coverage invalidates a saved DHL method", async () => {
  state.cart.shipping_address.postal_code = "01001";
  await assert.rejects(validations.complete({ input: { id: "cart_test" } }, { container }), /Necesitamos cotizar el envío/);
});
test("Medusa price, tax or eligibility mismatches cannot be paid", async () => {
  for (const edit of [{ amount: 49 }, { amount: 0 }, { is_tax_inclusive: false }, { price_type: "calculated" }]) {
    const original = { ...options[0] };
    Object.assign(options[0], edit);
    assert.equal((await getDhlCheckout(container, "cart_test")).quote.status, "quote_required");
    options[0] = original;
  }
  options = options.filter((o) => o.id === "local_old");
  assert.equal((await getDhlCheckout(container, "cart_test")).quote.status, "quote_required");
});
test("a misconfigured local ID is rejected even if it is assigned the DHL amount", async () => {
  state.policy.optionIds.standard_1_2 = "local_old";
  savePolicy();
  options[1].amount = 214;
  assert.equal((await getDhlCheckout(container, "cart_test")).quote.status, "quote_required");
});
test("wrong total, extra shipping tax and shipping discounts block payment", async () => {
  for (const amount of [0, 49, 248.24]) {
    state.cart.shipping_total = amount;
    await assert.rejects(validations.complete({ input: { id: "cart_test" } }, { container }), /Actualiza/);
  }
});
test("an unlinked or ambiguous payment collection cannot start payment", async () => {
  for (const data of [[], [{ cart_id: "a" }, { cart_id: "b" }]]) {
    links = data;
    let routeError;
    await guardDhlPayment({ scope: container, params: { id: "collection_test" } }, {}, (error) => { routeError = error; });
    assert.match(routeError.message, /verificar/);
  }
});

test("a stale payment collection cannot charge a total that omitted DHL", async () => {
  state.cart.payment_collection.amount = 300;
  await assert.rejects(validations.complete({ input: { id: "cart_test" } }, { container }), /importe de pago/);
  let routeError;
  await guardDhlPayment({ scope: container, params: { id: "collection_test" } }, {}, (error) => { routeError = error; });
  assert.match(routeError.message, /importe de pago/);
});

test("the configuration proposal is read-only, disabled and uses the four approved amounts", async () => {
  const log = console.log;
  let plan;
  try {
    console.log = (text) => { plan = JSON.parse(text); };
    await prepareOptions({ container });
  } finally {
    console.log = log;
  }
  assert.equal(plan.apply, false);
  assert.deepEqual(plan.options.map((o) => o.prices[0].amount), [214, 270, 332, 388]);
  assert.equal(plan.options.every((o) => o.rules[0].value === "false"), true);
  assert.equal(plan.options.every((o) => o.service_zone_id === null && o.shipping_profile_id === null), true);
  assert.equal(listingCalls, 0);
});

test("the administrative audit reads raw units and flags missing or demo weights without changing data", async () => {
  const products = [
    { id: "p1", weight: null, variants: [{ id: "v1", weight: null }] },
    { id: "p2", weight: 400, variants: [{ id: "v2", weight: null }] },
  ];
  const before = structuredClone(products);
  const log = console.log;
  let report;
  try {
    console.log = (text) => { report = JSON.parse(text); };
    await auditMedusa({ container: { resolve: () => ({
      graph: async ({ entity }) => ({ data: entity === "product" ? products : [] }),
    }) } });
  } finally {
    console.log = log;
  }
  assert.equal(report.weight_audit[0].status, "missing_or_nonpositive");
  assert.equal(report.weight_audit[1].unit, "not_confirmed");
  assert.equal(report.weight_audit[1].matches_demo_400_value, true);
  assert.deepEqual(products, before);
});

test("missing contact or an incomplete address cannot complete or initiate payment", async () => {
  state.cart.email = "";
  await assert.rejects(validations.complete({input:{id:"cart_test"}}, {container}), /correo/);
  state.cart.email = "review@example.invalid";
  delete state.cart.shipping_address.address_1;
  let routeError;
  await guardDhlPayment({scope:container,params:{id:"collection_test"}},{}, error=>{routeError=error});
  assert.match(routeError.message,/dirección/);
});

test("the production start layout reads the disabled root policy without enabling DHL", () => {
  const previousCwd = process.cwd();
  const runtime = join(directory, ".medusa/server");
  const config = join(directory, "config");
  mkdirSync(runtime, { recursive: true }); mkdirSync(config, { recursive: true });
  writeFileSync(join(config, "dhl-provisional.json"), JSON.stringify({ schemaVersion: 1, enabled: false }));
  try {
    delete process.env.DHL_POLICY_FILE; process.chdir(runtime);
    assert.equal(readDhlPolicy().enabled, false);
  } finally {
    process.chdir(previousCwd); process.env.DHL_POLICY_FILE = join(directory, "policy.json");
  }
});
