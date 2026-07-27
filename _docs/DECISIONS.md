# Decisions

This is the canonical decision log. It tracks architecture and product
choices that aren't obvious from reading the code — what was decided, what's
still open, and what was deliberately deferred. If another doc says "still
need to decide X," X should have a row here.

Status values: `Open`, `Deferred`, `Decided`.

## Architecture decisions

| Decision | Status | Notes |
| --- | --- | --- |
| Ports/adapters (hexagonal) architecture | Decided | One port + adapter(s) per swappable-provider capability; see `_docs/architecture/ports-and-adapters.md` |
| Resolver layer (dynamic per-request provider routing + fallback) | Deferred | Not needed while each feature has a single real provider; add only if a feature gains a second live provider and needs automatic fallback |
| Provider selection mechanism | Decided | Static, env-flag-driven, chosen once at boot via a module-level factory — not per-request |
| Database | Decided | PostgreSQL, local dev via Docker Compose, accessed through TypeORM |
| Persistence schema / entities | Decided, per data type | Bhavcopy and market cap: fully parsed, one row per real-world record. Fundamentals (indianapi.in): raw-per-metric — one JSONB column per metric holding the API's period series as-is, parsed at read time, insert-and-keep (not upsert) so pulls can be reconciled over time. See `_docs/architecture/ports-and-adapters.md` § Entities |
| API documentation | Decided | Swagger/OpenAPI, mandatory example payloads on every shipped endpoint |

## Data-source decisions

| Decision | Status | Notes |
| --- | --- | --- |
| Primary market data (price/volume) source | Decided | Official daily bulk exchange file, parsed in-house |
| Primary fundamentals (quarterly results) source | Superseded | Original plan was NSE's own XBRL filings, parsed in-house. Blocked in practice — the corporate-filings page that lists each filing's XBRL link is bot-protected (nseindia.com, not the file-archive subdomain), and there's no bulk index like Bhavcopy has. Superseded by the row below |
| Third-party data API (indianapi.in) | Decided — used, scoped narrowly | Reversed from an earlier "not used, full stop" decision. Now the actual fundamentals source, but only ever called against an already-narrowed candidate list (e.g. round-1 passers), never the full universe — free tier is 500 requests/month and `/historical_stats?stats=quarter_results` is one request per symbol, so a ~125-symbol round-1 list fits comfortably; a ~3,000-symbol full scan would not. API key lives in `.env` as `INDIAN_API_KEY`, never committed |
| Community/scraped data sources | Decided (rejected) | Excluded as unreliable long-term — no official API, prone to breaking |

## Product / rule decisions

| Decision | Status | Notes |
| --- | --- | --- |
| EPS growth threshold (fundamental rule) | Decided | Configurable, default value set in the rule implementation |
| Market cap floor (technical rule) | Decided | Configurable, default value set in the rule implementation |
| Other-income distortion rule | Decided — removed | Was fundamental rule #3. Removed from round 2 entirely, not just the gate — the rule no longer runs. Class kept in `rule-types.ts` in case it's reinstated |
| YoY period definition for fundamental rules | Decided | Quarter-vs-quarter comparisons use the same quarter one year prior. In addition, a rule compares this fiscal year's cumulative quarterly growth so far (sum of each completed quarter's YoY growth %) against last fiscal year's full-year growth % — a running "on pace to beat last year" check. See `_docs/architecture/screening-rules.md` |
| Screening result ranking/scoring methodology | Decided, differs per round | Round 1: strict pass/fail gate, every technical rule must pass. Round 2: **not** strict — a symbol passes if it clears at least 2 of its 3 fundamental rules (`MIN_FUNDAMENTAL_RULES_TO_PASS` in `screening.service.ts`). The full `/screening/results` endpoint uses neither — it's a simple passed/total score, not a gate |
| VCP (chart pattern) detection method | Deferred — out of scope for V1 | V1 is technical + fundamental rules only. Chart-pattern detection is not part of the V1 pass/fail gate; revisit post-V1 |
