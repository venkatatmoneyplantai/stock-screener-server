# Screening Rounds

How the rules are grouped into rounds, what each round checks, and where
the numbers actually live. For the domain reasoning behind each rule (why
25%, why 3x, etc.) see `_docs/architecture/screening-rules.md`. For how
rules are codified as configurable classes, see `ScreeningRuleset` in
`src/screening/rules/screening-ruleset.ts`.

The round split itself — which rules belong to round 1 vs round 2 — is
**not configurable**. It's fixed in `ScreeningService.screenRoundOne()` /
`screenRoundTwo()`. What *is* configurable is every rule's own thresholds,
via `ScreeningRuleset`.

**Round 1 is a strict pass/fail gate** — a symbol only appears if it clears
**every** technical rule. **Round 2 is not** — its 6 fundamental rules are
split into two independent "buckets" of 3 (EPS, Operating Profit), each
needing 2-of-3 to pass on its own; a symbol appears if **either** bucket
passes. See _docs/DECISIONS.md for why the two rounds use different gate
styles, and the bucket note below for why round 2 has two of them.

## Round 1 — technical

`GET /screening/round-one`. Runs against the full universe. Uses price
history only (`daily_bhavcopy_records`) plus market cap
(`market_cap_snapshots`) — no fundamentals data touched.

| # | Rule | Current value |
| --- | --- | --- |
| 1 | Close above key moving averages | DMA50 **and** DMA200 |
| 2 | Market cap floor | ≥ 990 Cr |
| 3 | Above 52-week low | Close ≥ 1.5× the 52-week low |
| 4 | Near 52-week high | Close ≥ 0.75× the 52-week high |
| 5 | Liquidity / turnover | Close × 20-day avg volume ≥ ₹200,000,000 (20 Cr) |
| 6 | 200-day average trending up | DMA200 today > DMA200 from 8 weeks ago |

## Round 2 — fundamental

`GET /screening/round-two`. Runs only against round-1 passers. Uses
stored fundamentals (`quarter_results`, populated by
`npm run pull:fundamentals`) — never a live API call.

Two buckets, same 3-rule shape, different metric. **A symbol passes round
2 if either bucket clears its own 2-of-3** — the buckets are evaluated
independently and combined with OR, not summed together.

### Bucket A — EPS

| # | Rule | Current value |
| --- | --- | --- |
| 1 | YoY EPS growth | ≥ 25% |
| 2 | Quarterly EPS YoY comparison | This quarter's EPS > the same quarter last year |
| 3 | Cumulative growth pace vs. last FY | Sum of this FY's completed quarters' YoY growth % ≥ last full FY's overall EPS growth % |

### Bucket B — Operating Profit

Exact same 3-rule shape as Bucket A, applied to Operating Profit instead
of EPS (already present in stored `quarter_results` data, no new pull
needed).

| # | Rule | Current value |
| --- | --- | --- |
| 1 | YoY Operating Profit growth | ≥ 25% |
| 2 | Quarterly Operating Profit YoY comparison | This quarter's Operating Profit > the same quarter last year |
| 3 | Cumulative growth pace vs. last FY | Sum of this FY's completed quarters' YoY OP growth % ≥ last full FY's overall OP growth % |

### If a bucket rule can't be evaluated (insufficient data)

That rule is **excluded from its bucket's own count**, not counted as a
failure — "rely on whatever data we have," per an explicit product
decision. The pass threshold generalizes "2 of 3" to however many rules in
the bucket actually had enough data: pass if `passed >= ceil(available *
2/3)`, and a bucket with zero available rules never passes (no evidence
either way). In practice this only matters for very early-listed stocks —
Operating Profit is already in the same API response as EPS, so it's
rarely absent when EPS isn't.

## Not in either round

- **VCP (chart pattern)** — code exists (`indicators/vcp-detector.util.ts`,
  `chart-pattern-rules.ts`) but is not wired into `screenRoundOne` or
  `screenRoundTwo`. Explicitly out of scope for V1 — see `_docs/DECISIONS.md`.
- **Other-income distortion check** — was fundamental rule #3, removed
  from round 2 entirely (not just the gate change — the rule itself no
  longer runs). The class (`OtherIncomeDistortionRule`) still exists in
  `rule-types.ts` in case it's reinstated later, but nothing evaluates it.

## Where the numbers actually live

Every threshold above is a constructor argument on a rule class in
`src/screening/rules/rule-types.ts`, instantiated with today's real values
in `src/screening/rules/screening-ruleset.ts`. To change a number (e.g.
25% → 30%), edit the `ScreeningRuleset` constructor — no changes needed to
the round logic or the evaluation functions, which read the values off the
ruleset rather than hardcoding them.

The round 2 bucket-pass math (2-of-3, generalizing to available rules when
data's missing) lives in `evaluateGrowthBucket()` in
`src/screening/rules/fundamental-rules.ts` — it's shared code, not
duplicated per bucket, since both buckets are the same 3-rule shape
evaluated against a different metric selector (EPS vs Operating Profit).
