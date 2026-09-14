# ledger-api

A double-entry ledger HTTP API: concurrency-safe transfers, mandatory idempotency keys, a transactional outbox for webhooks, and continuous reconciliation. TypeScript, Express, Postgres (Drizzle), pg-boss.

> Work in progress. The full design is in [SPEC.md](./SPEC.md); the architecture writeup lands with the final ticket.

## Quick start

```sh
docker compose up --build      # postgres → migrate → api on :3000
curl -s localhost:3000/health  # {"status":"ok","checks":{"db":"ok"}}
```

## Development

Requires Node 22+, pnpm 10, and Docker (tests run against a real Postgres via Testcontainers).

```sh
pnpm install
cp .env.example .env
docker compose up -d postgres  # local database on :5432
pnpm migrate                   # apply ./drizzle migrations
pnpm dev                       # API with reload on :3000

pnpm test                      # integration suite (starts its own Postgres)
pnpm lint && pnpm typecheck
pnpm migrate:generate          # diff src/db/schema.ts → new migration
```
