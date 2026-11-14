# Review: draft exclusion and original Fantasy Nails media

13 November 2026. Review branch only. No production deployment, index rebuild, database write, price/stock change, product/category creation or PR merge was performed. Tests used a new local Meilisearch instance and the existing synthetic local Medusa rehearsal database, never production credentials or records.

## Draft protection

- One publication mapper is shared by subscriber, startup reconciliation and manual rebuild. It returns a document only for `status === "published"`; missing, draft, proposed and rejected states fail closed.
- Created/updated events reread current status without cache. Missing/nonpublished products are deleted, including previously leaked documents. Delayed created events cannot restore a currently draft product.
- Startup and manual rebuild clear the old index before indexing only published records. This removes legacy drafts and deleted products that no longer appear in Medusa. The rebuild may briefly leave search empty; an interrupted rebuild must be retried.
- Events and rebuilds use one PostgreSQL advisory transaction lock, coordinating separate workers without requiring a schema change or relying on a process-local mutex. Every asynchronous Meilisearch task is awaited and checked for success.
- Only active, noninternal category names/IDs are included in public documents.
- `/store/catalog-search` revalidates candidate hits against current, uncached Medusa status and the storefront key's channels. It returns no stale hits/totals/private-category facets if a product has become draft before the subscriber finishes. It sends `Cache-Control: no-store` and fails closed with 503 when verification fails.

**Boundary:** database state and Meilisearch are separate systems; subscriber deletion is asynchronous, not an atomic access-control mechanism. Public clients must use Medusa Store API or the validated endpoint, not a direct public Meilisearch key. The active storefront already searches `/productos?q=...` using Medusa Store products. Legacy direct-Meilisearch components are not mounted by the deployed navigation. Do not enable them or direct index access without migrating to the validated boundary and reviewing key scopes. Existing production caches/keys have not been changed by this PR.

The existing Medusa Store product routes enforce published status. This change does not replace those routes or modify categories/product records. Search-index documents and their category attributes are the only future synchronization writes.

## Regression results

`npm run test:search`: **16/16 passed**, against official Meilisearch 1.13.3 (Apple Silicon) and PostgreSQL 18 on loopback. Fixtures were synthetic. The test process creates its own temporary search data directory and stops its server.

Covered:

1. Real PostgreSQL transactions serialize index jobs across workers.
2. Draft creation removes a previously leaked document.
3. Draft update never adds a document.
4. Published → draft is excluded by the public response before its event, then removed from the raw index after the event.
5. A delayed created event sees current draft status.
6. Rebuild removes legacy/deleted documents and private/inactive categories.
7. Manual rebuild handles 103 published products across pages and excludes a draft.
8. The service itself rejects a nonpublished document supplied by a caller.
9. Search restart preserves clean data; backend startup reconciliation removes stale entries.
10. Empty-index reconstruction indexes only current published records.
11. Deleted/missing products are removed.
12. The public endpoint requires trusted storefront-key context.
13. Stale hits, other channels and private category attributes are excluded without leaking totals.
14. A failed asynchronous indexing task is not reported as success.
15. Medusa failure produces 503 with no stale-index fallback.

The outer suite plus these 15 checks accounts for 16 reported tests. Full `npm run build` passed (backend and admin frontend). `tsc -p tsconfig.search.json` passed; full `tsc --noEmit` passed after build generated module types. No dependency versions changed.

Reproduction: install locked dependencies; provide `MEILI_TEST_BINARY` pointing to the official local binary and `SEARCH_TEST_DATABASE_URL` pointing to a synthetic loopback database named `sicaru_fantasy_isolated_v2`; run `npm run test:search`. Guards reject nonloopback database targets. PostgreSQL is used only for advisory locks; the regression suite does not insert catalog/price/inventory rows.

## Six original photographs: two frontend previews

Both deployments are READY and contain the same six original JPEG assets:

- Preview A: `sicaru-g29k9cvcb-sicaru-admins-projects.vercel.app`, implementation commit `aca5c290ce56ae73ff16caf62e9f63884f08d310`.
- Preview B: `sicaru-7amvoa30j-sicaru-admins-projects.vercel.app`, later deployment of commit `cf94cc36b8601bcd1f5f13c42da89621c9997a01`.

| SKU | Path in both deployments |
| --- | --- |
| 17133 | `/images/fantasy-nails/17133.jpeg` |
| 17141 | `/images/fantasy-nails/17141.jpeg` |
| 17136 | `/images/fantasy-nails/17136.jpeg` |
| 28101 | `/images/fantasy-nails/28101.jpeg` |
| 28102 | `/images/fantasy-nails/28102.jpeg` |
| 20132 | `/images/fantasy-nails/20132.jpeg` |

**12/12 authorized fetches:** HTTP 200, `image/jpeg`, byte length and ETag MD5 matching each corresponding original. Original files retain their verified SHA256 in PR #30's manifest. The connector decodes binary response bodies as text, so this check uses the server's ETag and content length rather than pretending to recompute response SHA256 from lossy text.

**Access limitation:** anonymous requests to these previews redirect to Vercel Authentication and eventually return HTML. That HTML 200 was detected and rejected as an image check. Authorized preview access was used without disabling Deployment Protection. Any temporary connector share credentials were excluded from evidence and are not proposed as permanent image URLs. See `fantasy-original-media-previews.json` for the clean URLs and results.

The user explicitly selected two-preview review and prohibited publishing the files to production. Therefore the existing 404s on the production image paths are **not claimed fixed**. Production remains untouched. Before publishing or Meta ingestion, approve a durable public HTTPS media origin or deployment of the six original files, then verify HTTP 200 without cookies, tokens, redirects or expiring URLs on that origin after redeployment. JPEG format alone does not establish Meta catalog approval.

## Isolated Medusa check

`fantasy-original-media-isolated.json`: six original images fetched over local HTTP with HTTP 200 and SHA256 identical to the originals; each image relation drives the existing storefront gallery for its exact variant. Existing rehearsal products remain draft. READ ONLY checks confirm zero stock levels, reservations, prices and sales-channel links. No new product, category, inventory or price record was created in this review.

The local provider's files survived the prior server restart; local `/tmp` storage and localhost URLs are test artifacts, not a production media solution. No rejected edited images were used.

## Documentation and approval gates

- Supplier note V52007133 (29 October 2026): **direct inspection remains pending**. Original labels support 15 ml; the November inventory sheet relates SKU and commercial name. A sheet's citation of the note does not verify the original note.
- PR review is not permission to deploy the backend or rebuild the production index. Future rollout must approve the backend diff, reconciliation of the search index, validated public-search boundary/key scopes, and monitoring/recovery.
- Future media publication must be approved separately; no merging PR #30 or production asset deployment occurred here.
- Product/category creation, commercial prices, physical inventory and checkout/payment activation remain outside this PR.
- Existing dependency vulnerabilities remain a separate workstream; no security version migration was folded into this change.
