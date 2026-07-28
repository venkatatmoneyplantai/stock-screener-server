# Current Status

This file tracks what state the project is actually in right now —
implementation, architecture, and runtime — not what's planned. For planned
work see `_docs/TODO.md`; for why things are the way they are, see
`_docs/DECISIONS.md`.

## Phase

| Area | Status |
| --- | --- |
| Project scaffold | Done |
| Ports/adapters for market data, fundamentals, universe | Done |
| Screening rules (technical + fundamental) | Done, individually adjustable |
| Database wiring | Done, actively storing real data |
| Health check | Done |
| API docs (Swagger) | Done |
| Real market data (Bhavcopy) | Done — real prices, real universe list |
| Real market cap | Done — own pull tool, semi-annual NSE source |
| Real fundamentals (indianapi.in) | Done — pull script populates storage, rules read from storage, never the live API |
| Round 1 (technical-only pass list) | Done — real endpoint, real data |
| Round 2 (technical + fundamentals combined pass list) | Done — real endpoint, reads only from storage |
| Dashboard client (`stock-screener-client`) | Done, verified against real data — see that repo's own `_docs/` |
| Deployment — server (Vercel) | Done — live at `https://stock-screener-server.vercel.app` |
| Deployment — database (Supabase) | Done — migrated, ~1.25M rows (2024–present) |
| Deployment — client (Cloudflare Pages) | In progress |
| Persistence of screening results | Not started, not urgent |
| Scheduling / run-on-demand | Not started, not urgent |

## Current implemented state

- NestJS API boots cleanly and serves:
  - `GET /<prefix>/screening/results` — full universe, all rules, ranked by score.
  - `GET /<prefix>/screening/round-one` — technical rules only, strict pass/fail. Currently 125 of ~3,122 real symbols pass, sorted by market cap.
  - `GET /<prefix>/screening/round-two` — round-1 passers whose STORED fundamentals clear at least 2 of 3 fundamental rules (not a strict all-must-pass gate — see `_docs/architecture/rounds.md`). Currently 38 of 125. Never calls the live API — reads `quarter_results` only.
  - `GET /<prefix>/health` — service + database connectivity check.
  - Swagger UI with tagged, described, exampled endpoints.
- `market-data` — real: `NseBhavcopyAdapter` reads `daily_bhavcopy_records`, populated by `npm run backfill:bhavcopy` (NSE's daily Bhavcopy file). Local Postgres has the full history back to 2021; Supabase (production) has 2024–present only, trimmed to fit the free tier's 500 MB cap.
- `universe` — real: `NseSymbolListAdapter` derives the symbol list from `daily_bhavcopy_records` itself (no separate fetch), scoped to the last 45 days of activity (see Performance notes below), and joins in market cap from `market_cap_snapshots`.
- `market cap` — real: `market_cap_snapshots`, populated by `npm run pull:market-cap` (NSE's own market-cap report, a different page from Bhavcopy, republished twice a year).
- `fundamentals-data` — real, two adapters with distinct jobs:
  - `IndianApiAdapter` — calls indianapi.in live. Used ONLY by `scripts/pull-fundamentals.ts`, never by a request handler.
  - `StoredFundamentalsAdapter` — reads `quarter_results` (never the network). This is what `screenRoundTwo()` actually uses.
  - 7 raw storage tables exist (`quarter_results`, `yoy_results`, `balance_sheets`, `cash_flows`, `ratios`, `shareholding_patterns_quarterly`, `shareholding_patterns_yearly` — one JSONB column per metric, insert-and-keep). Only `quarter_results` is populated so far.
- `indicators/` has working implementations of DMA, 52-week high/low, turnover, and a first-pass VCP heuristic (VCP not wired into V1 screening — see DECISIONS.md).
- `screening/rules/` implements all technical and fundamental rules as typed, configurable rule objects (`ScreeningRuleset`). Fundamental rules are 3 (EPS YoY growth, quarterly EPS YoY, cumulative growth pace), passing 2-of-3 — not a strict AND gate.

## Deployment

Split across three platforms on purpose — see the client's
`_docs/project-overview.md` for the full rationale:

- **Server** — Vercel, as a serverless function (`api/index.ts`, built via
  `vercel.json`'s explicit `builds`/`routes`, not zero-config auto-detection
  — that auto-detected a phantom second function from `src/main.ts` and had
  to be turned off deliberately).
- **Database** — Supabase Postgres. `DATABASE_URL` env var (session or
  transaction pooler connection string) takes over from the local
  `DB_HOST`/`DB_PORT`/etc vars when set — see `src/database/typeorm.config.ts`.
  `synchronize` is always off when `DATABASE_URL` is set or `NODE_ENV=production`;
  schema changes there need a manual migration (see `scripts/data-source.ts`
  or a direct `psql`/SQL command).
- **Client** — Cloudflare Pages (in progress), pointed at the Vercel URL via
  `VITE_API_BASE`.

Three real bugs surfaced getting this working, all fixed:

1. `tsconfig.build.json` didn't exclude `api/`/`scripts/`, which widened
   `tsc`'s inferred rootDir and broke `dist/main.js` output.
2. Vercel's zero-config Node detection auto-built `src/main.ts` as its own
   function alongside the real one (it has no default export — every
   request to `/` got a 500). Fixed with explicit `builds`/`routes` in
   `vercel.json`.
3. The original `api/index.ts` wrapped the app with `serverless-http`,
   which targets AWS Lambda's `(event, context)` signature, not Vercel's
   real `(req, res)` objects — nothing ever wrote to the actual response,
   so every request hung until the platform killed it. Fixed by handing
   Vercel the Express instance directly (`app.getHttpAdapter().getInstance()`
   is already a valid `(req, res)` handler on its own).

### Performance — a real bug the Supabase migration exposed

`screenRoundOne()` used to fetch bars with one query per symbol (`Promise.all`
over ~3,122 symbols). Fine against local Postgres (near-zero latency); against
Supabase this piled up into 20+ seconds and blew straight past Vercel's
function duration limit — no response at all, not even an error page. Fixed
with three changes, each verified independently by isolating raw `psql` →
`pg` driver → TypeORM query → TypeORM queryBuilder outside the app entirely:

- One bulk query (`getDailyHistoryForSymbols`) instead of one per symbol,
  selecting only the 6 columns actually used instead of full entity
  hydration.
- Pre-filter symbols by market cap *before* fetching bars — market cap needs
  no price history and is a strict-AND rule, so ~1,503 of 3,122 symbols never
  need their bars fetched at all.
- `getSymbols()` had an unbounded `DISTINCT ON` scanning the *entire*
  `daily_bhavcopy_records` table (1.25M rows) just to read off each symbol's
  latest company name — 39.7 seconds in isolation on Supabase's free-tier
  compute. Scoped to the last 45 days (any symbol still trading appears
  within days, not years) — dropped to 0.8 seconds.

Result: Round 1 now runs in ~6–11s cold (first request after Vercel's
function has been idle — mostly connection-establishment time to Supabase),
~6s warm. `vercel.json`'s `maxDuration` is set to 30s to cover the cold case
with headroom.

### Local dev — a regression from the above, since fixed

The `DATABASE_URL` support added for Supabase originally read `process.env`
at module top level in `typeorm.config.ts` — evaluated the moment the file
is imported, which is *before* `@nestjs/config` has actually loaded `.env`.
Local dev was silently falling back to `localhost:5432` (nothing there)
instead of the real `DB_PORT=5441`, breaking `npm run start:dev` entirely.
Fixed by moving the computation inside the `registerAs` factory function,
which only runs after `.env` is loaded. Verified working again: clean boot,
health/round-one (125)/round-two (38) all correct.

## Current architecture state

Ports/adapters pattern, static config-driven provider selection (no
resolver/fallback layer) for the general case — round 2 is a deliberate
exception, injecting `StoredFundamentalsAdapter` by class rather than
through the swappable port token, specifically so it can never be
accidentally pointed at a live-calling adapter. See
`_docs/DECISIONS.md` for the general reasoning and
`_docs/architecture/ports-and-adapters.md` § Entities for the storage
convention.

## Active provider / config / runtime state

- Provider selection (`.env`): `MARKET_DATA_PROVIDER=nse-bhavcopy`,
  `UNIVERSE_PROVIDER=nse-symbol-list`, `FUNDAMENTALS_DATA_PROVIDER=dummy`
  (deliberately — see above; irrelevant to round 2, which doesn't use this switch).
- `INDIAN_API_KEY` is set in `.env` (never committed; `.env.example` has an
  empty placeholder).
- Local Postgres runs via `docker compose up -d`, exposed on a non-default
  host port (`5441`). 10 tables exist locally (9 original + the new
  `trade_date` index doesn't add a table, just an index); `quarter_results`
  has 125 real rows (one per round-1 passer as of the last
  `npm run pull:fundamentals` run).
- Production (Supabase) has the same schema, `daily_bhavcopy_records`
  trimmed to 2024-01-01 onward (~1.25M rows, ~362 MB) to fit the free tier.
- Swagger is enabled by default in local dev (`SWAGGER_ENABLED=true`).

## What is complete

- Full technical + fundamental screening pipeline, end to end, on real
  data: real prices, real universe (~3,122 symbols), real market cap, all
  6 technical + 3 fundamental rules, two dedicated pass-list endpoints
  (`round-one`, `round-two`) — verified live, both rule sets confirmed
  with no leaks.
- Dashboard client built and verified against real data.
- Server + database deployed and live (Vercel + Supabase), verified with
  real request timings against production data.

## What remains

- Finish deploying the client to Cloudflare Pages, then tighten
  `ALLOWED_CORS_ORIGIN` from `*` to the real Cloudflare domain.
- Fill the Dec 2–19, 2025 price data gap in local Postgres (not urgent —
  production/Supabase only has 2024+ anyway).
- Decide whether to persist screening results themselves, and whether to
  automate the pull scripts / screening runs (both explicitly deferred,
  not urgent).
- A round of requested enhancements from user feedback — see
  `_docs/TODO.md` § Phase 8 and `stock-screener-client/_docs/TODO.md`
  § Phase 3 for the full list (parameter visibility, strength-based
  ranking, EPS history, sector, sortable columns, configurable market-cap
  bounds).
