/** Exceptional technical bootstrap requires a temporary, explicit authorization. */
export function assertTechnicalSeedAuthorized(env: NodeJS.ProcessEnv): void {
  if (env.SICARU_ALLOW_TECHNICAL_SEED !== "true") {
    throw new Error(
      "Technical seed requires explicit temporary authorization: SICARU_ALLOW_TECHNICAL_SEED=true."
    );
  }
}

/** Demo fixtures are restricted to an explicitly named database on this machine. */
export function assertLocalDemoSeed(env: NodeJS.ProcessEnv): void {
  if (
    env.SICARU_ALLOW_LOCAL_DEMO_SEED !== "true" ||
    !["development", "test"].includes(env.NODE_ENV ?? "") ||
    Object.keys(env).some((key) => key.startsWith("RAILWAY_"))
  ) {
    throw new Error("Demo seed requires an explicit local development environment.");
  }

  let database: URL;
  try {
    database = new URL(env.DATABASE_URL ?? "");
  } catch {
    throw new Error("Demo seed requires the local sicaru_demo database.");
  }

  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) ||
    database.pathname !== "/sicaru_demo" ||
    database.search !== ""
  ) {
    throw new Error("Demo seed requires the local sicaru_demo database.");
  }
}
