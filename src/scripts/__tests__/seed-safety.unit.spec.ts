import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Script } from "node:vm";
import { assertLocalDemoSeed, assertTechnicalSeedAuthorized } from "../../utils/seed-safety";

describe("exceptional technical seed authorization", () => {
  it.each([undefined, "", "false", "TRUE", "True", "1", " true", "true ", "true\n"])(
    "rejects a missing or nonexact authorization value %p",
    (value) => {
      expect(() => assertTechnicalSeedAuthorized({ SICARU_ALLOW_TECHNICAL_SEED: value })).toThrow(
        "Technical seed requires explicit temporary authorization"
      );
    }
  );

  it("accepts only the exact explicit authorization", () => {
    expect(() => assertTechnicalSeedAuthorized({ SICARU_ALLOW_TECHNICAL_SEED: "true" })).not.toThrow();
  });

  it("does not include environment values in rejection messages", () => {
    expect(() => assertTechnicalSeedAuthorized({
      SICARU_ALLOW_TECHNICAL_SEED: "synthetic-private-authorization",
      DATABASE_URL: "postgres://synthetic:synthetic-password@remote.invalid/live",
      TOKEN: "synthetic-private-token",
    })).toThrow(
      new Error("Technical seed requires explicit temporary authorization: SICARU_ALLOW_TECHNICAL_SEED=true.")
    );
  });
});

const local = {
  NODE_ENV: "development",
  SICARU_ALLOW_LOCAL_DEMO_SEED: "true",
  DATABASE_URL: "postgres://demo:synthetic@127.0.0.1:5432/sicaru_demo",
};

describe("local demo seed boundary", () => {
  it.each([
    {},
    { ...local, NODE_ENV: "production" },
    { ...local, NODE_ENV: undefined },
    { ...local, SICARU_ALLOW_LOCAL_DEMO_SEED: undefined },
    { ...local, RAILWAY_ENVIRONMENT_ID: "synthetic-production" },
    { ...local, RAILWAY_ENVIRONMENT_NAME: "production" },
    { ...local, RAILWAY_ENVIRONMENT_NAME: "staging" },
    { ...local, RAILWAY_PROJECT_ID: "synthetic-project" },
    { ...local, DATABASE_URL: "postgres://demo:synthetic@remote.invalid/sicaru_demo" },
    { ...local, DATABASE_URL: "postgres://demo:synthetic@localhost/production" },
    { ...local, DATABASE_URL: "postgres://demo:synthetic@localhost/sicaru_demo?host=remote.invalid" },
    { ...local, DATABASE_URL: "invalid" },
  ])("rejects nonlocal or implicit demo configuration %#", (env) => {
    expect(() => assertLocalDemoSeed(env)).toThrow();
  });

  it.each(["localhost", "127.0.0.1", "[::1]"])("allows the explicitly named local demo database on %s", (hostname) => {
    expect(() => assertLocalDemoSeed({
      ...local,
      DATABASE_URL: `postgresql://demo:synthetic@${hostname}/sicaru_demo`,
    })).not.toThrow();
  });

  it("does not include the database URL in rejection messages", () => {
    const address = "postgres://synthetic:private-value@remote.invalid/live";
    try {
      assertLocalDemoSeed({ ...local, DATABASE_URL: address });
      throw new Error("Expected a rejected URL");
    } catch (error) {
      expect((error as Error).message).not.toContain("private-value");
      expect((error as Error).message).not.toContain("remote.invalid");
    }
  });
});

describe("technical seed capabilities", () => {
  // Parse the script without loading Medusa, its services, or any database.
  const ts = require("typescript") as typeof import("typescript");
  const source = readFileSync(resolve(__dirname, "../seed-sicaru.ts"), "utf8");
  const tree = ts.createSourceFile("seed-sicaru.ts", source, ts.ScriptTarget.Latest, true);
  const calls: string[] = [];
  function visit(node: import("typescript").Node) {
    if (ts.isCallExpression(node)) calls.push(node.expression.getText(tree));
    ts.forEachChild(node, visit);
  }
  visit(tree);

  const entry = tree.statements.find((node): node is import("typescript").FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "seedSicaruData"
  );
  if (!entry?.body) throw new Error("Technical seed entrypoint is missing");

  // Execute only the real entrypoint body, without importing Medusa or a database.
  const isolatedEntry = ts.transpileModule(
    entry.getText(tree).replace(/^export default /, "") + "\nseedSicaruData;",
    { compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS } }
  ).outputText;

  it.each([undefined, "", "false", "TRUE", "1", " true", "true "])(
    "rejects %p before resolving any service or reaching any write",
    async (value) => {
      const resolveService = jest.fn(() => { throw new Error("Service resolution must not occur"); });
      const seed = new Script(isolatedEntry).runInNewContext({
        assertTechnicalSeedAuthorized,
        process: { env: { SICARU_ALLOW_TECHNICAL_SEED: value } },
      });

      await expect(seed({ container: { resolve: resolveService } })).rejects.toThrow(
        "Technical seed requires explicit temporary authorization"
      );
      expect(resolveService).not.toHaveBeenCalled();
    }
  );

  it("makes the authorization check the first entrypoint statement", () => {
    expect(entry.body!.statements[0].getText(tree)).toBe("assertTechnicalSeedAuthorized(process.env);");
  });

  it("has no product or inventory write capability, in Production or any other environment", () => {
    expect(calls).not.toContain("createProductsWorkflow");
    expect(calls).not.toContain("createInventoryLevelsWorkflow");
    expect(source).not.toMatch(/stocked_quantity|KUUL-CURE-1L|KUUL-COLOR-3OZ/);
    expect(source).not.toContain("Modules.PRODUCT");
    expect(source).not.toContain("Modules.INVENTORY");
  });

  it("cannot fill an unstocked inventory item, including a new variant such as the QA pilot", () => {
    const graphCalls = [...source.matchAll(/entity:\s*"([^"]+)"/g)].map((match) => match[1]);
    expect(graphCalls).not.toContain("inventory_item");
    expect(graphCalls).not.toContain("inventory_level");
    expect(calls.filter((call) => /inventory|stocked/i.test(call))).toEqual([]);
  });

  it.each([
    "createProductsWorkflow",
    "createInventoryLevelsWorkflow",
    "stocked_quantity",
    "createShippingOptionsWorkflow",
    "$49",
    "Envío Cadereyta Mismo Día",
    "Gratis en pedidos mayores a $300",
  ])("has no commercial product, inventory or shipping capability: %s", (forbidden) => {
    expect(source).not.toContain(forbidden);
  });

  it("cannot create shipping rates, promotions or fulfillment service zones", () => {
    expect(source).not.toMatch(/\b(?:prices|amount|price_type)\s*:/);
    expect(calls).not.toContain("fulfillmentModuleService.createFulfillmentSets");
    expect(source).not.toContain("service_zones");
  });

  it("retains technical bootstrap capabilities for new environments", () => {
    for (const workflow of ["createSalesChannelsWorkflow", "createRegionsWorkflow", "createStockLocationsWorkflow", "createProductCategoriesWorkflow"]) {
      expect(calls).toContain(workflow);
    }
  });

  it("keeps seeds outside normal build, deploy and startup commands", () => {
    const { scripts } = JSON.parse(readFileSync(resolve(__dirname, "../../../package.json"), "utf8"));
    for (const command of [scripts.build, scripts.start, scripts["start:production"]]) {
      expect(command).not.toMatch(/seed|src\/scripts/);
    }
    for (const [name, command] of Object.entries(scripts)) {
      if (/^(?:pre|post)?(?:build|start(?::production)?|deploy)$/.test(name)) {
        expect(command).not.toMatch(/seed|medusa\s+exec|src\/scripts/);
      }
    }
    for (const filename of ["railway.toml", "railway.json", "nixpacks.toml"]) {
      const config = readFileSync(resolve(__dirname, "../../..", filename), "utf8");
      expect(config).not.toMatch(/seed|medusa\s+exec|src\/scripts/);
    }
    expect(scripts.seed).toBeUndefined();
    expect(scripts["seed:sicaru"]).toBe("medusa exec ./src/scripts/seed-sicaru.ts");
    expect(scripts["seed:demo"]).toBe("medusa exec ./src/scripts/seed.ts");
    const demo = readFileSync(resolve(__dirname, "../seed.ts"), "utf8");
    expect(demo.indexOf("assertLocalDemoSeed(process.env)")).toBeLessThan(demo.indexOf("const logger = container.resolve"));
  });
});
