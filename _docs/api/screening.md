# Screening API

## `GET /screening/results`

Runs every rule in `_docs/architecture/screening-rules.md` against every
symbol in the current universe, and returns them sorted by score (highest
first). See `src/screening/screening.controller.ts` /
`screening.service.ts`.

No query parameters yet — it always screens the full universe. Filtering
and pagination are not implemented.

### Response `200`

```json
{
  "success": true,
  "data": [
    {
      "symbol": "HFCL",
      "companyName": "HFCL Limited",
      "marketCapCr": 15000,
      "technicalRules": [
        {
          "rule": "Close above DMA50 and DMA200",
          "passed": true,
          "detail": "close=341.9, dma50=308.0, dma200=176.8"
        },
        {
          "rule": "Close * 20DMA volume >= 200000000",
          "passed": false,
          "detail": "turnover=34190210.99"
        }
      ],
      "fundamentalRules": [
        {
          "rule": "YoY EPS growth >= 25%",
          "passed": false,
          "detail": "current=Q4 FY25 eps=4.75, yearAgo=Q4 FY24 eps=3.87, growth=22.7%"
        }
      ],
      "chartPatternRules": [
        { "rule": "VCP (Volatility Contraction Pattern)", "passed": false }
      ],
      "passedCount": 7,
      "totalCount": 10,
      "score": 0.7
    }
  ]
}
```

`score` is `passedCount / totalCount` — a placeholder ranking method, not a
deliberate scoring design. See `_docs/DECISIONS.md`.

## `GET /screening/round-one`

"Round 1" — the technical (price/volume) rules only, evaluated as a strict
pass/fail gate. Returns only the symbols that pass every single technical
rule, sorted by market cap (highest first) — not the full universe, and no
score. Fundamentals ("round 2") aren't touched by this endpoint at all —
see `GET /screening/round-two` below.

### Response `200`

```json
{
  "success": true,
  "data": [
    {
      "symbol": "ADANIENT",
      "companyName": "ADANI ENTERPRISES LIMITED",
      "marketCapCr": 279045,
      "technicalRules": [
        {
          "rule": "Close above DMA50 and DMA200",
          "passed": true,
          "detail": "close=2450.0, dma50=2310.5, dma200=2100.2"
        },
        { "rule": "Market cap >= 990 Cr", "passed": true, "detail": "marketCapCr=279045" }
      ]
    }
  ]
}
```

Verified against the real universe: 125 of ~3,122 symbols currently pass
every technical rule.

## `GET /screening/round-two`

"Round 2" — takes the round-1 passers and evaluates the fundamental rules
against each one, using STORED data from `quarter_results` (populated by
`npm run pull:fundamentals`) — never a live API call. Unlike round 1, this
is **not** an all-must-pass gate: a symbol only needs to clear **at least 2
of its 3** fundamental rules. Sorted by market cap. If a symbol you expect
is missing, run the pull script first — it only covers whichever symbols
passed round 1 at the time it was last run.

### Response `200`

```json
{
  "success": true,
  "data": [
    {
      "symbol": "SOLARINDS",
      "companyName": "SOLAR INDUSTRIES (I) LTD",
      "marketCapCr": 127241,
      "technicalRules": [
        { "rule": "Close above DMA50 and DMA200", "passed": true, "detail": "..." }
      ],
      "fundamentalRules": [
        {
          "rule": "YoY EPS growth >= 25%",
          "passed": true,
          "detail": "current=Q1 FY27 eps=..., yearAgo=Q1 FY26 eps=..., growth=..."
        }
      ]
    }
  ]
}
```

Verified against the real universe: 38 of the 125 round-1 passers clear at
least 2 of the 3 fundamental rules.

Full interactive docs (all fields, try-it-out) are at `/api-docs` when the
server is running.
