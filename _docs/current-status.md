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
| Persistence of screening results | Not started, not urgent |
| Scheduling / run-on-demand | Not started, not urgent |
| Dashboard / client | Not started |

## Current implemented state

- NestJS API boots cleanly and serves:
  - `GET /<prefix>/screening/results` — full universe, all rules, ranked by score.
  - `GET /<prefix>/screening/round-one` — technical rules only, strict pass/fail. Currently 125 of ~3,122 real symbols pass, sorted by market cap.
  - `GET /<prefix>/screening/round-two` — round-1 passers whose STORED fundamentals also clear every fundamental rule. Currently 22 of 125 pass both. Never calls the live API — reads `quarter_results` only.
  - `GET /<prefix>/health` — service + database connectivity check.
  - Swagger UI with tagged, described, exampled endpoints.
- `market-data` — real: `NseBhavcopyAdapter` reads `daily_bhavcopy_records`, populated by `npm run backfill:bhavcopy` (NSE's daily Bhavcopy file, ~5 years pulled so far, one known gap Dec 2–19 2025).
- `universe` — real: `NseSymbolListAdapter` derives the symbol list from `daily_bhavcopy_records` itself (no separate fetch), and joins in market cap from `market_cap_snapshots`.
- `market cap` — real: `market_cap_snapshots`, populated by `npm run pull:market-cap` (NSE's own market-cap report, a different page from Bhavcopy, republished twice a year).
- `fundamentals-data` — real, two adapters with distinct jobs:
  - `IndianApiAdapter` — calls indianapi.in live. Used ONLY by `scripts/pull-fundamentals.ts`, never by a request handler.
  - `StoredFundamentalsAdapter` — reads `quarter_results` (never the network). This is what `screenRoundTwo()` actually uses.
  - 7 raw storage tables exist (`quarter_results`, `yoy_results`, `balance_sheets`, `cash_flows`, `ratios`, `shareholding_patterns_quarterly`, `shareholding_patterns_yearly` — one JSONB column per metric, insert-and-keep). Only `quarter_results` is populated so far (the other 6 stats types aren't used by any rule yet).
  - `FUNDAMENTALS_DATA_PROVIDER` is left at `dummy` in `.env` — that setting controls the full `/screening/results` endpoint only, which still iterates the *entire* universe and would be unsafe to point at any real fundamentals source (live or stored) without also narrowing it first. Round 2 bypasses this setting entirely by injecting `StoredFundamentalsAdapter` directly.
- `indicators/` has working implementations of DMA, 52-week high/low, turnover, and a first-pass VCP heuristic (VCP not wired into V1 screening — see DECISIONS.md).
- `screening/rules/` implements all technical and fundamental rules as typed, configurable rule objects (`ScreeningRuleset`).

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
  host port. 9 tables exist; `quarter_results` has 125 real rows (one per
  round-1 passer as of the last `npm run pull:fundamentals` run).
- Swagger is enabled by default in local dev (`SWAGGER_ENABLED=true`).

## What is complete

- Full technical + fundamental screening pipeline, end to end, on real
  data: real prices, real universe (~3,122 symbols), real market cap, all
  6 technical + 4 fundamental rules, two dedicated pass-list endpoints
  (`round-one`, `round-two`) — verified live, both rule sets confirmed
  with no leaks.

## What remains

- Fill the Dec 2–19, 2025 price data gap (not urgent).
- Decide whether to persist screening results themselves, and whether to
  automate the pull scripts / screening runs (both explicitly deferred,
  not urgent).
- Build the client/dashboard that consumes this API.
