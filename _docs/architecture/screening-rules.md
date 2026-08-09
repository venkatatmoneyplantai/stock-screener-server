# Screening Rules

The domain rules this service evaluates against every symbol. Implemented
as pure functions in `src/screening/rules/` (`technical-rules.ts`,
`fundamental-rules.ts`), composed by `screening.service.ts`. Configurable
thresholds mentioned below are implemented as typed rule objects — see
`_docs/architecture/ports-and-adapters.md` and `rule-types.ts` /
`screening-ruleset.ts`.

**V1 scope is technical + fundamental rules only.** Chart-pattern detection
(VCP) is explicitly out of scope for V1 — see `_docs/DECISIONS.md`. The
code for it (`chart-pattern-rules.ts`, `indicators/vcp-detector.util.ts`)
still exists but is not called by `screening.service.ts`.

**Round 1 (technical) is a strict pass/fail gate** — a symbol only counts as
a pass if it meets every rule below. **Round 2 (fundamental) is not** — its
6 rules split into two independent 3-rule "buckets" (EPS, Operating
Profit), and a symbol passes if either bucket clears its own 2-of-3. See
`_docs/DECISIONS.md` and `_docs/architecture/rounds.md` for the full round
breakdown, including what happens when a bucket rule can't be evaluated.

## 1. Technical Rules (Round 1 — all 6 must pass)

1. **Price above key MAs** — Close > DMA 50 AND Close > DMA 200
2. **Market Cap floor** — MCap >= 990 Cr
3. **Above 52wk low** — Close >= 1.5x of 52 week low
4. **Near 52wk high** — Close >= 0.75x of 52 week high
5. **Liquidity (turnover)** — Close * 20DMA Volume >= 200,000,000 (20 crore)
6. **200DMA trending up** — 200DMA today > 200DMA from 8 weeks ago

## 2. Fundamental Rules (Round 2 — either bucket needs 2 of its 3 to pass)

Two buckets, identical 3-rule shape, different metric. A symbol passes
round 2 if **Bucket A OR Bucket B** clears its own 2-of-3 — the buckets
are independent, not summed together.

### Bucket A — EPS

1. **YoY EPS Growth** — EPS should have increased by at least 25% year-over-year.
   - Configurable threshold (default: 25%)
2. **Quarterly EPS YoY comparison** — Compare Qx EPS vs the same quarter in the last FY (e.g. Q1 FY25 vs Q1 FY24).
3. **Cumulative growth pace vs. last fiscal year** — While the current fiscal year is still in progress, sum the YoY growth % of each quarter completed so far this FY, and compare that running total against last full fiscal year's overall EPS growth %. If the running total is already at or above last year's full-year number, the stock is "on pace" to beat last year.
   - Example: last FY's overall EPS growth was 20%. This FY, Q1 grew 12% YoY and Q2 grew 7% YoY — running total 19%, already close to/on pace to clear last year's 20%.
   - Needs at least one full prior fiscal year plus the fiscal year before that (to compute last year's own growth %), plus however many quarters are complete in the current FY.

### Bucket B — Operating Profit

Exact same 3-rule shape as Bucket A, applied to Operating Profit instead
of EPS. Operating Profit is already present in the same `quarter_results`
data EPS comes from, so no new data pull is needed for this bucket.

1. **YoY Operating Profit Growth** — ≥ 25% (configurable, same default as the EPS bucket).
2. **Quarterly Operating Profit YoY comparison** — same shape as the EPS version, against Operating Profit.
3. **Cumulative growth pace vs. last fiscal year** — same shape as the EPS version, against Operating Profit.

### Missing data

If a bucket rule can't be evaluated (insufficient quarterly/fiscal-year
history), it's **excluded from that bucket's own count** rather than
counted as a failure — the bucket's threshold generalizes "2 of 3" to
`ceil(available * 2/3)` of whatever rules actually had enough data. A
bucket with zero available rules never passes.

**Removed:** an "Other income distortion check" (a prior would-be rule 4)
used to fall back to Operating Profit growth when Other Income swung ≥3x
between compared periods. Removed from round 2 entirely — superseded by
Bucket B being a first-class, always-evaluated Operating Profit check
rather than a conditional fallback. See `_docs/DECISIONS.md`.

## 3. Chart Patterns — deferred, not part of V1

1. **VCP (Volatility Contraction Pattern)** — look for a series of progressively tighter price contractions on the chart.
   - Current implementation (`indicators/vcp-detector.util.ts`) is a
     first-pass heuristic, not yet validated against real chart data, and is
     not wired into the V1 screening flow — see `_docs/DECISIONS.md`.

## 4. Data Sources — Decided

- **Technicals** — NSE Bhavcopy (official daily bulk CSV). Parsing it ourselves is fine. Compute DMA/52wk hi-lo/turnover from the history.
- **Market cap** — NSE's own market-cap report, a *separate* page from the Bhavcopy price file (`nseindia.com/regulations/listing-compliance/nse-market-capitalisation-all-companies`), republished twice a year. This page works fine via plain HTTP — not blocked, unlike the fundamentals page below. Pulled by `npm run pull:market-cap`, stored in `market_cap_snapshots`.
- **Fundamentals** — indianapi.in (`stock.indianapi.in`), used only against an already-narrowed candidate list (e.g. round-1 passers), never the full universe. See `_docs/DECISIONS.md` for why.
  - **Endpoint:** `GET https://stock.indianapi.in/historical_stats?stock_name=<SYMBOL>&stats=<TYPE>`, header `X-Api-Key: <INDIAN_API_KEY>`. `stats` is required — there is no "give me everything" call. Each of the 7 valid `<TYPE>` values is a **separate request**: `quarter_results`, `yoy_results`, `balancesheet`, `cashflow`, `ratios`, `shareholding_pattern_quarterly`, `shareholding_pattern_yearly`. Only `quarter_results` is currently used by our rules (Sales, Expenses, Operating Profit, Other Income, Profit before tax, Net Profit, EPS in Rs). See `IndianApiAdapter` for what each type returns and its dedicated method.
  - **Storage:** one table per stats type (`quarter_results`, `yoy_results`, `balance_sheets`, `cash_flows`, `ratios`, `shareholding_patterns_quarterly`, `shareholding_patterns_yearly`) — one column per metric, holding the raw `{ "Mon YYYY": value }` series as JSONB, parsed at read time rather than decomposed at write time. Insert-and-keep (not upsert), so repeated pulls accumulate history instead of overwriting — see each entity in `src/fundamentals-data/entities/`.
  - **Period conversion:** `"Mon YYYY"` is converted to our `Qn FYyy` convention assuming an Apr–Mar Indian fiscal year (e.g. `"Jun 2023"` → `Q1 FY24`, `"Mar 2024"` → `Q4 FY24`). See `IndianApiAdapter.monthYearToFiscalPeriod`.
  - **Originally planned source (superseded):** NSE's own XBRL filings — confirmed real field tags and two parsing gotchas (no direct "Operating Profit" tag; `contextRef` period IDs not reliable from dates alone) during earlier research, but blocked in practice: the corporate-filings page that lists each filing's XBRL link is bot-protected. This is a *different* NSE page from the market-cap one above, which is not blocked. Kept here in case NSE-direct access becomes viable later.
- **Screener.in** — explicitly avoided as a long-term source; will fail/break over time (scraping, ToS risk, no official API). Not part of the plan.

## Open questions

None remaining for V1's rule definitions — see `_docs/DECISIONS.md` for the
resolved decisions. Rule-tuning work (e.g. validating the VCP detector once
it's back in scope) is tracked in `_docs/TODO.md`.
