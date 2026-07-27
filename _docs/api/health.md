# Health API

## `GET /health`

Service + database connectivity check. See `src/health/`.

### Response `200` — all systems operational

```json
{
  "status": "ok",
  "timestamp": "2026-07-24T10:00:00.000Z",
  "checks": { "database": { "status": "ok" } }
}
```

### Response `503` — one or more systems down

```json
{
  "status": "degraded",
  "timestamp": "2026-07-24T10:00:00.000Z",
  "checks": { "database": { "status": "error", "message": "Connection refused" } }
}
```

Add further dependency checks (cache, external providers, etc.) the same
way, folded into the `checks` object — see `HealthService.check()`.
