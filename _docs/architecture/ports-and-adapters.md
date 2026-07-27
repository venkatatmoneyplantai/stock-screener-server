# Ports & Adapters

Why this codebase is shaped the way it is, and the conventions that shape
follows. For the current build/runtime state see `_docs/current-status.md`;
for the decision to defer a resolver layer (and what would change that) see
`_docs/DECISIONS.md`.

## Why ports and adapters

Every capability backed by an external or swappable data source (market
data, fundamentals data, the symbol universe) is defined as a **port** —
a plain TypeScript interface describing what the rest of the app needs,
independent of where the data actually comes from. Each real data source
gets its own **adapter** implementing that port. This means switching or
adding a data provider is a matter of writing a new adapter class and
flipping a config flag — nothing that consumes the port has to change.

Not everything gets this treatment. Pure computation (`indicators/`) and
orchestration (`screening/`) have no external provider to swap, so they
stay as plain services/functions with no port/adapter split.

## Layering

```
Controller → Service → Adapter
```

one layer simpler than a full resolver-based setup — see
`_docs/DECISIONS.md` for why a dynamic per-request routing/fallback layer
(Resolver) was deliberately left out at this stage, and what would justify
adding one later.

- **Controller** — thin. HTTP concerns only (routing, DTOs, status codes),
  delegates immediately to a service.
- **Service** (one per feature) — a thin facade implementing the feature's
  port, delegating to whichever adapter was selected at boot.
- **Adapter** — a concrete integration with exactly one provider. All
  provider-specific logic (parsing, HTTP calls, error handling) lives here.
  Every port also has a `Dummy*Adapter` for local dev/testing.

`screening.service.ts` sits above all three feature services — it's the
composition point that injects `MarketDataPort`, `FundamentalsPort`, and
`UniversePort` by token, combines them with `indicators/` and
`screening/rules/`, and produces the ranked output.

## Current features

| Feature | Port | Real adapter(s) | Status |
| --- | --- | --- | --- |
| `market-data` | `MarketDataPort` — daily OHLCV history per symbol | `NseBhavcopyAdapter` | Real, reads `daily_bhavcopy_records`. Default provider. |
| `universe` | `UniversePort` — symbol list + market cap | `NseSymbolListAdapter` | Real, derives symbols from `daily_bhavcopy_records`, joins market cap from `market_cap_snapshots`. Default provider. |
| `fundamentals-data` | `FundamentalsPort` — quarterly financials per symbol | `NseXbrlAdapter` (stub, blocked — see DECISIONS.md), `IndianApiAdapter` (real, calls the live API directly — not yet reading from its own storage tables) | Provider still set to `dummy` by default; flipping to `indian-api` would call the live API across the *full* universe on every `/screening/results` request, which isn't safe yet — see current-status.md |

`market-data` and `universe` no longer use their `Dummy*Adapter` by
default. `fundamentals-data` still does, deliberately.

## Entities (persisted data)

Features that persist data have their own `entities/` folder, one TypeORM
entity class per table, registered in both `src/database/typeorm.config.ts`
(the app) and `scripts/data-source.ts` (standalone scripts). Full inventory
and what each table's data source is: `_docs/project-overview.md` §
Data sources at a glance.

Two storage shapes are in use so far:
- **Fully parsed, one row per real-world record** — `daily_bhavcopy_records`
  (one row per symbol per trading day), `market_cap_snapshots` (one row per
  symbol per reporting period).
- **Raw-per-metric, parsed at read time** — the 7 fundamentals tables
  (`quarter_results`, etc.): one row per symbol per pull, one JSONB column
  per metric holding indianapi.in's `{ "Mon YYYY": value }` series as-is.
  Insert-and-keep, not upsert, so repeated pulls accumulate history instead
  of overwriting — see any entity under `src/fundamentals-data/entities/`
  for the reasoning.

## Wiring

DI token constants live in `src/common/constants/provider-tokens.ts`. Each
feature's `*.module.ts` registers its adapters as providers, then binds an
internal adapter-selection token to one of them via a `useFactory` that
reads a `<FEATURE>_PROVIDER` env var through `ConfigService` — chosen once
at boot, not per request. The feature's public DI token
(`MARKET_DATA_SERVICE`, etc.) is bound to the feature's `Service` class via
`useExisting`. Everything outside a feature's own folder injects by that
public token, typed against the port interface — never a concrete adapter.

## Naming conventions

| Pattern | Example |
| --- | --- |
| `interfaces/<feature>-port.interface.ts` → `interface <Feature>Port` | `market-data-port.interface.ts` → `MarketDataPort` |
| `adapters/<provider>-<feature>.adapter.ts` → `class <Provider><Feature>Adapter` | `nse-bhavcopy.adapter.ts` → `NseBhavcopyAdapter` |
| `adapters/dummy-<feature>.adapter.ts` → `class Dummy<Feature>Adapter` | `dummy-market-data.adapter.ts` → `DummyMarketDataAdapter` |
| `<feature>.service.ts` → `class <Feature>Service` | `market-data.service.ts` → `MarketDataService` |
| `<feature>.module.ts` | wires adapters + service + DI token for the feature |
