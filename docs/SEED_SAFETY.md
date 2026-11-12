# SICARÚ seed safety

`npm run seed:sicaru` is an exceptional technical initializer, not a deployment or routine maintenance step. It requires explicit, temporary authorization for a separately approved administrative execution. Its first statement calls `assertTechnicalSeedAuthorized(process.env)`: if `SICARU_ALLOW_TECHNICAL_SEED` is absent or is not exactly `"true"`, it throws before resolving any service or performing any write. Rejection messages do not print environment values or credentials.

The initializer creates no products, prices, inventory items, inventory levels, shipping rates or commercial shipping options. It cannot fill a missing level or assign a technical quantity to any variant. It does not define promotions, delivery deadlines or customer-facing logistics promises. Logistics policies require a separate process and explicit commercial authorization. Removing this code does not delete or alter existing shipping options or other live data.

The remaining technical operations concern store settings, currencies, regions, tax configuration, stock location, its provider/channel links, the structural default shipping profile, categories and API-key links. A profile alone is not a purchasable shipping service: the initializer creates no fulfillment sets, service zones or shipping options. These technical writes still require review of the target environment and separate authorization; the temporary opt-in is a technical safeguard, not commercial permission.

`SICARU_ALLOW_TECHNICAL_SEED` must **never persist in Production configuration**. Do not add it to Railway, a Production `.env`, CI, build or startup commands. Only a future expressly approved administrative execution may supply it temporarily to that process. This PR does not set the variable anywhere and does not run the initializer.

`npm run seed:demo` is a separate local-only demonstration command. It requires all of the following conditions.

- `SICARU_ALLOW_LOCAL_DEMO_SEED=true`.
- `NODE_ENV=development` or `NODE_ENV=test`.
- No `RAILWAY_` environment variables.
- A PostgreSQL URL on localhost, 127.0.0.1 or ::1, with database name `sicaru_demo` and no URL parameters.

The generic `npm run seed` alias has been removed. The demo command keeps the Medusa starter fixtures only for this isolated local database. Never forward this local database address to an operational database.

Railway supplies `RAILWAY_ENVIRONMENT_ID` and `RAILWAY_ENVIRONMENT_NAME`. The ID identifies the environment independently of its editable display name. The demo boundary rejects every Railway environment, so a rename or missing Production-name check cannot authorize it.

The inspected Production service uses branch `main`, build command `npm ci --include=dev && npm run build` and start command `npm run start`. Repository Railway configurations use `npm run start:production`. None of these commands invokes a seed. Recheck service overrides before a future release.

Tests exercise the authorization guard, run the isolated real entrypoint with a service-resolution spy to prove rejection precedes writes, inspect prohibited capabilities and startup configuration, and exercise the local demo boundary. They do not load a Medusa container or connect to a database. In an isolated checkout run `npm run test:unit`, `npm run build`, then `npx tsc --noEmit` after the build generates Medusa types. None of these validation commands runs a seed.

Rollback of this draft is closing the PR or reverting the code commits. No database rollback is needed because the preparation does not execute either seed or change live data. Reverting this correction would remove the explicit technical authorization guard and restore the previous initializer's commercial shipping capability; reverting the entire PR would also restore the legacy product/inventory risk. Neither rollback authorizes running a seed.
