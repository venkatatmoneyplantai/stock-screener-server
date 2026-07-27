# Project Overview

This is the orientation doc — read this first to understand what the project
is, how it's built, and how to work in it.

## What is this project?

A backend service that screens NSE/BSE-listed stocks against a configurable
set of technical, fundamental, and chart-pattern rules, and exposes the
ranked results over an HTTP API for a dashboard to consume. It does not
place trades, provide investment advice, or hold user accounts — it's a
data-processing and ranking service.

The screening rules themselves (what counts as a pass, thresholds,
configurable multiples) are defined outside this codebase and implemented
here as pure functions — see `src/screening/rules/`.

## Tech stack

- **Runtime:** Node.js, TypeScript
- **Framework:** NestJS
- **Database:** PostgreSQL, run locally via Docker Compose, accessed through
  TypeORM
- **API docs:** Swagger / OpenAPI, mounted at `/api-docs` when enabled
- **Validation:** class-validator / class-transformer

## Folder structure

```
src/
├── main.ts                 # bootstrap: pipes, filters, interceptors, Swagger, CORS
├── app.module.ts            # root module — imports DatabaseModule + orchestrator modules
├── config/                  # namespaced, typed app config (registerAs)
├── database/                # TypeORM connection module + config
├── common/                  # cross-cutting: DI tokens, DTOs, filters, interceptors
├── <feature>/                # one folder per swappable-provider capability, e.g. market-data/
│   ├── interfaces/            # the port (interface)
│   ├── adapters/               # concrete provider implementations + a dummy adapter
│   ├── entities/                # TypeORM entities for data this feature persists (if any)
│   ├── <feature>.module.ts     # wiring: binds an adapter to the feature's DI token
│   └── <feature>.service.ts    # thin facade implementing the port
├── indicators/               # pure computation, not a port (nothing external to swap)
├── screening/                 # composes the feature ports + indicators into the ranked output
│   ├── rules/                   # rule evaluation functions
│   ├── dto/
│   ├── screening.controller.ts
│   ├── screening.module.ts
│   └── screening.service.ts
└── health/                    # liveness + database connectivity check

scripts/                       # one-off/backfill jobs, run manually (npm run <script>)
```

## Data sources at a glance

| Data | Source | Pulled by | Stored in |
| --- | --- | --- | --- |
| Price/volume (technicals) | NSE Bhavcopy (daily file) | `npm run backfill:bhavcopy` | `daily_bhavcopy_records` |
| Market cap | NSE's own market-cap report (separate page, semi-annual) | `npm run pull:market-cap` | `market_cap_snapshots` |
| Fundamentals (EPS, P&L; 6 more stat types stored but not yet used) | indianapi.in — only ever against a narrowed candidate list (round-1 passers), never the full universe | `npm run pull:fundamentals` (writes), `StoredFundamentalsAdapter` (reads — actual rule-checking never calls the live API) | `quarter_results`, `yoy_results`, `balance_sheets`, `cash_flows`, `ratios`, `shareholding_patterns_quarterly`, `shareholding_patterns_yearly` |

Full detail, including exact endpoints and why each source was chosen (or ruled out), is in `_docs/architecture/screening-rules.md` § Data Sources and `_docs/DECISIONS.md`.

## Screening rounds

Screening runs as two sequential pass/fail gates, not one combined score:

- `GET /screening/round-one` — technical rules, against the full universe.
- `GET /screening/round-two` — fundamental rules, against round-1 passers only, reading stored data.

Full rule list, current thresholds, and where to change them:
`_docs/architecture/rounds.md`.

For the full architectural rationale (why ports/adapters, why the resolver
layer is deferred here, naming conventions), see
`_docs/architecture/ports-and-adapters.md` and `_docs/DECISIONS.md`. For the
domain rules this service evaluates, see
`_docs/architecture/screening-rules.md` and `_docs/architecture/rounds.md`.
For endpoint reference, see `_docs/api/`.

## How to build / run

```bash
npm install
cp .env.example .env          # first time only
docker compose up -d           # starts local Postgres
npm run start:dev              # boots the API with hot reload
```

- API: `http://localhost:<PORT>/<API_PREFIX>/...` (defaults: `3000`, `api/v1`)
- Health check: `GET /<API_PREFIX>/health` — reports service + database status
- Swagger UI: `http://localhost:<PORT>/api-docs` (when `SWAGGER_ENABLED=true`)

To type-check without building: `npx tsc --noEmit`.

## Coding conventions

- **Ports and adapters.** Any capability backed by an external/swappable
  data provider gets a port (`interfaces/<feature>-port.interface.ts`,
  a plain TS `interface` named `<Feature>Port`) and one adapter class per
  provider (`adapters/<provider>-<feature>.adapter.ts`, class
  `<Provider><Feature>Adapter implements <Feature>Port`). Every port also
  gets a `Dummy<Feature>Adapter` for local dev/testing.
- **DI by token, typed against the port.** Token constants live in
  `common/constants/provider-tokens.ts`. Consumers inject
  `@Inject(TOKEN)` typed as the port interface — never import a concrete
  adapter outside its own feature folder.
- **Static, config-driven provider selection.** Each feature module picks
  one adapter at boot via a `useFactory` that switches on an env flag
  (e.g. `MARKET_DATA_PROVIDER=dummy`). No dynamic per-request provider
  routing/fallback layer at this stage (see `_docs/DECISIONS.md`).
- **Thin controllers.** Controllers only handle HTTP concerns — routing,
  request/response DTOs, status codes — and delegate immediately to a
  service. No business logic in a controller.
- **Namespaced, typed config.** Config is read via `@nestjs/config`'s
  `registerAs`, consumed as `configService.get('namespace.key')` — not
  scattered raw `process.env` reads.
- **Swagger on everything shipped.** Every controller has `@ApiTags`, every
  route has `@ApiOperation` and at least one `@ApiResponse` with a
  realistic example, every DTO field has `@ApiProperty`/`@ApiPropertyOptional`
  with an example value.

## Key architecture

Request flow for the main endpoint: `Controller → Service → Adapter`, per
feature (`market-data`, `fundamentals-data`, `universe`), composed together
by `screening.service.ts`, which pulls from all three ports plus the
`indicators/` utilities and the `screening/rules/` functions to produce a
ranked list.

This is intentionally the simpler end of a ports-and-adapters architecture —
no resolver/fallback layer yet, one adapter chosen per feature at boot via
config. See `_docs/DECISIONS.md` for why, and what would trigger adding a
resolver layer later.
