# SICARÚ seed safety

`npm run seed:sicaru` initializes the existing technical store configuration. It no longer defines commercial products, product prices, inventory items or inventory levels. Catalog imports require their own validated inputs and authorization. Existing data is untouched by this code change.

The technical initializer still writes store settings, categories, fulfillment configuration and API-key links. It is an explicit administrative operation and is not part of normal startup. Its existing shipping configuration is retained in this focused change. Running it against an operational environment still requires authorization.

`npm run seed:demo` is a separate local-only demonstration command. It requires all of the following conditions.

- `SICARU_ALLOW_LOCAL_DEMO_SEED=true`.
- `NODE_ENV=development` or `NODE_ENV=test`.
- No `RAILWAY_` environment variables.
- A PostgreSQL URL on localhost, 127.0.0.1 or ::1, with database name `sicaru_demo` and no URL parameters.

The generic `npm run seed` alias has been removed. The demo command keeps the Medusa starter fixtures only for this isolated local database. Never forward this local database address to an operational database.

Railway supplies `RAILWAY_ENVIRONMENT_ID` and `RAILWAY_ENVIRONMENT_NAME`. The ID identifies the environment independently of its editable display name. The demo boundary rejects every Railway environment, so a rename or missing Production-name check cannot authorize it.

The inspected Production service uses branch `main`, build command `npm ci --include=dev && npm run build` and start command `npm run start`. Repository Railway configurations use `npm run start:production`. None of these commands invokes a seed. Recheck service overrides before a future release.

Tests inspect the technical seed and exercise the demo boundary without loading a Medusa container or connecting to a database. Run `npm run test:unit`, `npx tsc --noEmit` and `npm run build` in an isolated checkout.

Rollback of this draft is closing the PR or reverting its commit. No database rollback is needed because the preparation does not execute either seed or change any live data. A future code rollback would restore the unsafe legacy initializer, so it must not be run.
