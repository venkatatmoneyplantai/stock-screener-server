# TODO

This file tracks what this project still needs to ship, written in plain
language and grouped by the order things naturally need to happen in — not
by what's technically fastest to build.

The overall flow: **decide the rules → get the stock data → run the rules
and keep only the ones that pass → save the results → make it run on its
own → show the results.**

Status markers: `[]` not started, `[A]` active/in progress, `[x]` done.

## Backlog

[x] Decide the rules — what counts as a "good stock"
[x] Get the data needed to check the rules
[x] Only keep the stocks that actually pass, not just score everyone
[] Save the results somewhere
[] Make the whole thing run on its own (daily, or on demand)
[x] Build a screen to see the results
[x] Deploy server + database for real (Vercel + Supabase)
[] Ship the requested shortlist/analysis enhancements below

## Phases

### Phase 1 — Decide the rules — done

What counts as a "good pick," and exactly how we measure it, is settled.

| Item | Notes |
| --- | --- |
| [x] Rules are now individually adjustable | Each rule (e.g. moving average, growth %, market cap floor) has its own settings that can be changed without touching how the checking works |
| [x] Decided what makes a stock a "pass" overall | A stock only counts as a pass if it meets every single rule — no partial score |
| [x] Decided how we compare "growth vs. last year" | Same quarter last year, plus a new check that adds up this year's growth so far and compares it to last year's full-year growth |
| [x] Chart-shape check dropped from V1 | Not part of the first version — technical + fundamentals only |
| [] Wire the "must pass everything" rule into the actual output | The decision is made; the code still needs to actually filter down to only the stocks that pass — this is really Phase 3's job |

### Phase 2 — Get the data — done

Before we can check anything, we need real numbers to check. Both price
data and company results are now real.

| Item | Notes |
| --- | --- |
| [x] Figured out exactly where the price data comes from | NSE's official daily file, confirmed working, two different formats depending on how far back we go |
| [x] Built the tool that downloads and stores price history | Downloads to a temp folder first, then loads into the database — currently running manually to backfill 2026 |
| [x] Storing every stock, not a hand-picked list | The full exchange, so nothing gets missed later if the rules change |
| [x] Point the actual rule-checking at this real price data | The 6 price/chart rules now run against real stored NSE data, verified working |
| [x] Screen the real, full list of stocks (~2,975) instead of 3 hardcoded ones | Built from the price data we already have — no separate fetch needed |
| [x] Get each stock's size (market cap) | NSE publishes this separately from the price file, twice a year. Built a runnable tool for it (`npm run pull:market-cap`), verified real values (e.g. Reliance ~₹19.7 lakh Cr), wired into screening — the market-cap rule now correctly passes/fails per real company size |
| [x] Company results (profit, EPS, etc.) — real data source built and verified | NSE's own filings turned out to be blocked (bot-protected page, no bulk index). Using indianapi.in instead, scoped narrowly — one call per symbol, only ever against an already-narrowed list, never the full universe. Verified against real HFCL data (Q4 FY26 revenue matched the actual reported ₹1,824 Cr). See `_docs/DECISIONS.md` |
| [x] Storage tables for company results | 7 tables, one per data type (quarterly results, annual results, balance sheet, cash flow, ratios, shareholding ×2), raw per-metric JSONB, insert-and-keep |
| [x] Pull script that actually stores data | `npm run pull:fundamentals` — pulls quarter_results for every round-1 passer and writes real rows. Run once so far: 125 of 125 succeeded, verified real data in the table (e.g. ADANIENT, 13 quarters of real Sales/EPS) |
| [x] Make the rule-checking read from storage instead of calling the live API | New `StoredFundamentalsAdapter` reads `quarter_results` directly — the live API is only ever called by the pull script now, never by a request |
| [] Fill a data gap: Dec 2–19, 2025 is missing | Every other pulled month has ~19-23 trading days; that stretch only has the 6 days from early testing. Re-run the backfill script for that range when convenient — already-downloaded days are skipped automatically |

### Phase 3 — Keep only the ones that pass — done

The old full-screen endpoint (scores everyone) still exists, but the
actual filtering behavior is done via two dedicated endpoints.

| Item | Notes |
| --- | --- |
| [x] Round 1 — technical-only pass list | `GET /screening/round-one` — 125 of ~3,122 real stocks pass every technical rule, sorted by market cap |
| [x] Round 2 — technical + fundamentals combined pass list | `GET /screening/round-two` — round-1 passers whose stored fundamentals clear at least 2 of 3 fundamental rules (other-income distortion rule removed; not an all-must-pass gate). Currently 38 of 125. Reads only from storage, never the live API |

### Phase 4 — Save the results — not urgent

Nice to have so we're not re-checking everything from scratch every time,
and so we keep a record of what passed and when — but not a blocker for
anything else right now.

| Item | Notes |
| --- | --- |
| Decide what to save and set up somewhere to save it | Database is already connected, just not used yet |

### Phase 5 — Run it automatically — not urgent

Nice to have so the whole process runs without someone doing it by hand
each time — but not a blocker for anything else right now.

| Item | Notes |
| --- | --- |
| Run it automatically on a schedule | e.g. once a day |
| Allow running it on demand | e.g. a button on the dashboard |

### Phase 6 — Show the results — done

A simple screen to see the stocks that passed. Built as a fully separate
project, `stock-screener-client` — see that repo's own `_docs/`.

| Item | Notes |
| --- | --- |
| [x] Build the dashboard | Separate Vite/React app, three tabs (Round 2, Round 1, Stock Lookup), verified against real data |

### Phase 7 — Deploy for real — done

Split across three platforms on purpose: server on Vercel, database on
Supabase, client on Cloudflare Pages — each independently redeployable.

| Item | Notes |
| --- | --- |
| [x] Migrate database to Supabase | Schema + data (2024–present, ~1.25M bhavcopy rows; dropped 2021–2023 to fit the free tier's 500 MB cap) |
| [x] Deploy server to Vercel | `https://stock-screener-server.vercel.app` — serverless, see `_docs/DECISIONS.md` for the adapter approach |
| [x] Fix three real deployment bugs | tsconfig rootDir regression, Vercel auto-detecting a phantom function, `serverless-http` being built for AWS Lambda instead of Vercel's actual request signature — see `_docs/DECISIONS.md` |
| [x] Fix a real performance bug the migration exposed | `screenRoundOne()` was firing one DB query per symbol (~3,122 concurrent) — fine against local Postgres, but timed out completely against a real network hop to Supabase. Replaced with one bulk query + a market-cap pre-filter + fixed an unbounded full-table scan in `getSymbols()`. Round 1 now runs in ~6–11s cold, ~6s warm, against production data |
| [x] Fix a local-dev regression introduced by the Supabase changes | DB config was reading env vars before `.env` had loaded — `npm run start:dev` was silently trying to connect to the wrong port. Fixed, verified working again |
| [] Deploy client to Cloudflare Pages | In progress — see `stock-screener-client/_docs/TODO.md` |
| [] Tighten `ALLOWED_CORS_ORIGIN` from `*` to the real Cloudflare domain | Once the client has a live URL |

### Phase 8 — Requested enhancements (from user feedback)

One round of feedback after seeing the first working dashboard. Full list
with client-side notes is in `stock-screener-client/_docs/TODO.md` — this is
just the server-side half of each.

| # | Item | Notes |
| --- | --- | --- |
| 2 | Rank Round 1 by strength (closest to 52-week high first) | Currently sorted by market cap. Need to expose a real numeric "% of 52-week high" field per stock (not just buried in a text `detail` string) so it can be sorted on properly |
| 3 | EPS for the last 4 years AND last 8 quarters, for every Round 2 stock | Quarterly EPS already exists (~13 quarters stored per stock via `quarter_results`). Annual EPS (4 years) is new — the `yoy_results` table already exists but isn't populated or used by anything yet; this would finally give it a purpose |
| 6 | Sector name per stock (NSE publishes this) | New data source needed — Bhavcopy doesn't carry sector. Need to find where NSE publishes it, pull and store it, then expose on both round endpoints |
| 7 | Configurable min/max market cap instead of the fixed ₹990 Cr floor | Round 1/2 endpoints need to accept market-cap bounds as query params, falling back to the ruleset's current default (990) if not given. Keeps the ruleset's own default intact for anyone not passing custom bounds |

Not yet broken into an implementation order — this is the raw list as given.

## Already done

| Item |
| --- |
| Basic project setup |
| All the rules are decided and written, with adjustable settings |
| Real price/volume history is being pulled and stored in the database (still backfilling more history) |
| The real, full stock list (~2,975 symbols) is what actually gets screened now |
| The 6 price/chart rules run on real data, verified |
| Company size (market cap) is now real too — runnable on its own (`npm run pull:market-cap`) |
| Company results (EPS, profit, etc.) — real data pulled and stored for all 125 round-1 stocks (`npm run pull:fundamentals`), and the rules now read it from storage |
| Round 1 and round 2 both work end to end on real data — 125 pass round 1, 38 clear round 2's 2-of-3 fundamentals gate |
| Database is connected and actually storing real data |
| Health check |
| API documentation |
| Dashboard client built and verified against real data (`stock-screener-client`) |
| Server deployed to Vercel, database migrated to Supabase — both live |
