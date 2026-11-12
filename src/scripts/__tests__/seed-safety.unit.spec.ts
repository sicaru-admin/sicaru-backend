import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertLocalDemoSeed } from "../../utils/seed-safety";

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
    expect(scripts.seed).toBeUndefined();
    expect(scripts["seed:demo"]).toBe("medusa exec ./src/scripts/seed.ts");
    const demo = readFileSync(resolve(__dirname, "../seed.ts"), "utf8");
    expect(demo.indexOf("assertLocalDemoSeed(process.env)")).toBeLessThan(demo.indexOf("const logger = container.resolve"));
  });
});
