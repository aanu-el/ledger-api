# Ledger API — Spec

## Problem Statement

A developer integrating a product that moves money between users (a marketplace, a game economy, a savings app) needs a service that holds account balances and moves money between accounts **without ever losing or inventing a cent** — even when the same account is hit by many simultaneous requests, when a client retries a request it isn't sure went through, or when a downstream webhook receiver is down for an hour.

Existing simple "balance column + update" implementations get this wrong: concurrent transfers oversell balances, retried requests double-charge, and there is no way to prove after the fact that the books add up.

## Solution

`ledger-api` is a small, self-contained HTTP service implementing a **double-entry ledger**:

- Every movement of money is a **transfer** that writes exactly two **entries** (a debit and a credit) in one database transaction, so the ledger always sums to zero.
- Money enters and leaves the system through a system-owned **external account** per currency, so deposits and withdrawals use the same code path as peer-to-peer transfers.
- Transfers are safe under concurrency (row locks acquired in deterministic order, database-enforced non-negative balances) and safe under retries (mandatory idempotency keys).
- Completed transfers are published to the account owner's **webhook** via a transactional outbox and a background worker with retries and dead-lettering.
- A scheduled **reconciliation** job continuously proves the invariants hold and records the result.

The service ships with a Docker Compose environment, an integration test suite against a real Postgres, CI, and a live deployment. The README documents the architecture and the tradeoffs behind each decision, because the primary audience is an engineer reading the code.

## User Stories

### Accounts

1. As an API consumer, I want to create an account in a given currency, so that I can hold a balance for one of my users.
2. As an API consumer, I want to fetch a single account by ID and see its current balance, currency, and timestamps, so that I can display it to my user.
3. As an API consumer, I want to list my accounts with cursor pagination, so that I can page through them predictably as the list grows.
4. As an API consumer, I want to see only accounts I own, so that another tenant's accounts are never visible to me.
5. As an API consumer, I want a newly created account to start at zero balance, so that money can only arrive through recorded transfers.
6. As an API consumer, I want to reference the system external account for my currency by a stable identifier, so that I can deposit and withdraw without looking up an ID.

### Entries / statements

7. As an API consumer, I want to list the entries for an account in reverse-chronological order with cursor pagination, so that I can render a statement.
8. As an API consumer, I want each entry to show the signed amount, the transfer it belongs to, and the account's running balance after that entry, so that my user can follow how the balance changed.
9. As an API consumer, I want entries to be immutable, so that history can never be rewritten.

### Transfers

10. As an API consumer, I want to transfer an amount from one account to another, so that money moves between my users.
11. As an API consumer, I want to deposit money into an account by transferring from the external account, so that funds can enter the system.
12. As an API consumer, I want to withdraw money from an account by transferring to the external account, so that funds can leave the system.
13. As an API consumer, I want a transfer to be rejected if the source account has insufficient funds, so that balances never go negative.
14. As an API consumer, I want a transfer to be rejected if the two accounts have different currencies, so that I never accidentally move 100 cents of one currency into another.
15. As an API consumer, I want a transfer to be rejected if the source and destination are the same account, so that no-op entries are never created.
16. As an API consumer, I want a transfer to be rejected if the amount is zero or negative, so that the direction of money is always explicit.
17. As an API consumer, I want a transfer to be rejected if I don't own the source account, so that nobody can move money out of my users' accounts.
18. As an API consumer, I want to be able to transfer _into_ an account I don't own, so that cross-tenant payments are possible.
19. As an API consumer, I want to attach a free-text description and an optional metadata object to a transfer, so that I can correlate it with my own records.
20. As an API consumer, I want to fetch a transfer by ID and see its status, both entries, and timestamps, so that I can confirm what happened.
21. As an API consumer, I want to list my transfers with cursor pagination and optional filtering by account, so that I can audit activity.
22. As an API consumer, I want many concurrent transfers touching the same accounts to all either succeed or fail cleanly with the final balances exactly matching the sum of successful transfers, so that I can trust the ledger under load.
23. As an API consumer, I want concurrent transfers in opposite directions between the same two accounts to never deadlock, so that the API stays responsive.

### Idempotency

24. As an API consumer, I want to supply an `Idempotency-Key` header when creating a transfer, so that a retried request never creates a second transfer.
25. As an API consumer, I want a transfer request without an idempotency key to be rejected, so that I can't accidentally build an unsafe client.
26. As an API consumer, I want a retried request with the same key and same body to return the original response (same status code and body), so that my retry logic is trivial.
27. As an API consumer, I want a request with the same key but a different body to be rejected with a clear error, so that a key-reuse bug in my client is surfaced instead of silently returning a stale result.
28. As an API consumer, I want a request that arrives while the original with the same key is still in flight to be rejected with a conflict error, so that I know to retry shortly.
29. As an API consumer, I want idempotency keys to be scoped to my API key, so that another tenant reusing the same string cannot collide with mine.
30. As an API consumer, I want idempotency keys to expire after 24 hours, so that storage stays bounded and I can safely reuse keys after that.

### Webhooks

31. As an API consumer, I want to register a webhook URL for my API key, so that I'm notified when transfers involving my accounts complete.
32. As an API consumer, I want to receive a `transfer.completed` event containing the transfer ID, accounts, amount, and currency, so that I can update my own system.
33. As an API consumer, I want each event to carry a unique event ID, so that I can de-duplicate deliveries on my side.
34. As an API consumer, I want events to be signed with a shared secret, so that I can verify they came from the ledger.
35. As an API consumer, I want failed deliveries retried with exponential backoff, so that a brief outage on my side doesn't lose events.
36. As an API consumer, I want deliveries that keep failing to be dead-lettered after a bounded number of attempts and visible via the API, so that I can investigate and replay them.
37. As an API consumer, I want an event to be published only if the transfer actually committed, and every committed transfer to eventually produce an event, so that my system and the ledger never drift.

### Reconciliation

38. As an operator, I want a scheduled job to verify that every account's stored balance equals the sum of its entries, so that a balance bug is detected rather than silently trusted.
39. As an operator, I want the same job to verify that the sum of all entries across the ledger is zero, so that money creation or destruction is detected.
40. As an operator, I want each reconciliation run recorded with its outcome and any discrepancies found, so that there is an audit trail.
41. As an operator, I want to trigger a reconciliation run on demand through an internal endpoint, so that I can check the books after an incident.

### Authentication

42. As an API consumer, I want to authenticate with a bearer API key, so that integration is a single header.
43. As an API consumer, I want requests without a valid key to be rejected with 401, so that the API is never anonymously writable.
44. As an operator, I want API keys stored hashed, so that a database leak doesn't leak credentials.
45. As an operator, I want a CLI/script to issue a new API key, so that onboarding a tenant doesn't require touching the database.

### API ergonomics

46. As an API consumer, I want all errors returned in a consistent `application/problem+json` shape with a stable machine-readable `type`, so that my client can branch on them.
47. As an API consumer, I want validation errors to list every invalid field, so that I can fix a bad request in one round trip.
48. As an API consumer, I want every response to carry a request ID header that also appears in server logs, so that I can report a problem precisely.
49. As an API consumer, I want an OpenAPI document served by the API, so that I can generate a client.

### Operations

50. As an operator, I want a health endpoint that reports database and queue connectivity, so that a load balancer can route around a sick instance.
51. As an operator, I want structured JSON logs with request IDs, so that I can search and correlate them.
52. As an operator, I want the API and the worker to be separate entrypoints in one image, so that I can scale them independently.
53. As an operator, I want graceful shutdown on SIGTERM that finishes in-flight requests and jobs, so that deploys don't drop work.
54. As an operator, I want database migrations to run as an explicit step, so that schema changes are deliberate and reviewable.

### Developer experience (the reviewer)

55. As a reviewing engineer, I want to clone the repo and run one Compose command to get a working API, so that I can try it in under five minutes.
56. As a reviewing engineer, I want to run the full test suite with one command and no manual database setup, so that I can trust the tests are real.
57. As a reviewing engineer, I want a README that explains the data model, the concurrency strategy, the idempotency semantics, the outbox pattern, and why each alternative was rejected, so that I can evaluate the author's judgment, not just their code.
58. As a reviewing engineer, I want CI to run the same test suite on every push, so that the green badge means something.
59. As a reviewing engineer, I want a live deployment I can call, so that I can see it running.

## Implementation Decisions

### Stack

- TypeScript on Node 22, pnpm.
- Express for HTTP, with an explicit three-layer structure: HTTP layer (routing, validation, auth, error mapping) → application services (use cases, transactions, invariants) → data access (Prisma client). Domain rules live in services, never in route handlers.
- Zod for request/response validation; the same schemas generate the OpenAPI document.
- Prisma 7 over Postgres (with the `pg` driver adapter so the pool is application-owned) and Prisma Migrate. Raw SQL (`$queryRaw`) is used where locking semantics must be explicit; constraints Prisma's schema language cannot express (`CHECK`, partial unique indexes) are written into the migration SQL by hand.
- pg-boss for background jobs (Postgres-backed, `SKIP LOCKED`). The queue is accessed through a small internal `JobQueue` interface so a BullMQ adapter can be added later without touching services.
- pino for structured logging.
- Vitest, supertest, Testcontainers for tests.
- Docker Compose (api, worker, postgres) for local; GitHub Actions for CI; Render (web service + worker) with Neon Postgres for deploy.

### Domain model

- **Tenant**: the owner of an API key. Owns accounts and a webhook configuration. Identified by the API key's tenant ID.
- **Account**: `id`, `tenant_id` (null for system accounts), `currency` (ISO 4217 code), `balance` (bigint minor units), `kind` (`user` | `external`), timestamps. `CHECK (kind = 'external' OR balance >= 0)`. One `external` account per currency, created by migration/seed.
- **Transfer**: `id`, `from_account_id`, `to_account_id`, `amount` (bigint > 0), `currency`, `status` (`completed` | `failed`), `description`, `metadata` (jsonb), `idempotency_key`, `tenant_id`, timestamps. `CHECK (from_account_id <> to_account_id)`, `CHECK (amount > 0)`.
- **Entry**: `id`, `transfer_id`, `account_id`, `amount` (signed bigint), `balance_after` (bigint), `created_at`. Immutable; no update or delete path exists. Exactly two per transfer.
- **IdempotencyRecord**: `(tenant_id, key)` primary key, `request_hash`, `status` (`in_progress` | `completed`), `response_status`, `response_body`, `expires_at`.
- **OutboxEvent**: `id`, `tenant_id`, `type`, `payload`, `created_at`, `published_at`. Written in the transfer's transaction.
- **WebhookEndpoint**: `tenant_id` primary key, `url`, `secret`.
- **WebhookDelivery**: `id`, `event_id`, `attempt`, `status` (`pending` | `delivered` | `failed` | `dead`), `last_error`, `next_attempt_at`.
- **ReconciliationRun**: `id`, `started_at`, `finished_at`, `status` (`ok` | `discrepancy`), `discrepancies` (jsonb).

Money is always integer minor units. The API accepts and returns amounts as strings to avoid JavaScript number precision issues on large values.

### Transfer algorithm

Inside one `READ COMMITTED` transaction:

1. Load both accounts with `SELECT … FOR UPDATE`, ordered by account ID ascending, regardless of transfer direction. This makes lock acquisition order deterministic and rules out lock-ordering deadlocks.
2. Validate: both exist, same currency, source is owned by the caller (unless source is `external`), source balance ≥ amount (unless source is `external`).
3. Insert the transfer, two entries (with `balance_after`), update both balances.
4. Insert the outbox event.
5. Commit.

The `CHECK (balance >= 0)` constraint is a backstop; the service is expected to reject insufficient funds before hitting it, and a constraint violation is treated as a bug and logged at error level.

Rejected alternatives (documented in README): `SERIALIZABLE` with retry loops (correct but less legible, and retries complicate idempotency); optimistic versioning (more round trips, no better guarantees here); derived-only balances (no lock target, O(n) reads).

### Idempotency

- `Idempotency-Key` is required on `POST /transfers`; missing key → 400 problem `idempotency-key-required`.
- Scope is `(tenant_id, key)`.
- On request: insert record as `in_progress` with the request body hash. If insert conflicts:
  - existing record `completed` with same hash → replay stored status + body, plus header `Idempotent-Replayed: true`.
  - existing record with different hash → 422 problem `idempotency-key-reused`.
  - existing record `in_progress` → 409 problem `idempotency-key-in-flight`.
- On completion (success or domain failure), record is updated to `completed` with the response.
- Records expire after 24 hours; a scheduled job deletes expired records.

### Outbox and webhook delivery

- The worker polls unpublished outbox events, enqueues one `deliver-webhook` job per event per tenant that has a webhook endpoint, and marks the event published. Enqueue and mark happen in one transaction with pg-boss's transactional insert.
- The `deliver-webhook` job POSTs the event JSON with an `X-Ledger-Signature` HMAC-SHA256 header (secret from the endpoint), timeout 5s. 2xx → `delivered`. Anything else → retry with exponential backoff (base 1s, factor 4, max 5 attempts). After the last failure → `dead`.
- Dead deliveries are listable via `GET /webhook-deliveries?status=dead` and replayable via `POST /webhook-deliveries/:id/replay`.

### Reconciliation

- pg-boss cron job, default every 15 minutes, plus `POST /internal/reconcile` (API-key auth, any tenant may trigger; it reconciles the whole ledger and returns the run).
- Checks: for every account, `balance = COALESCE(SUM(entries.amount), 0)`; globally `SUM(entries.amount) = 0`.
- Writes a `ReconciliationRun` row; on discrepancy, logs at error level.

### API contract

Base path `/v1`. Bearer auth on everything except `/health` and `/openapi.json`.

- `POST /accounts` `{currency}` → 201 account
- `GET /accounts/:id` → account (404 if not owned)
- `GET /accounts?cursor&limit` → page of accounts
- `GET /accounts/:id/entries?cursor&limit` → page of entries
- `POST /transfers` `{from_account_id, to_account_id, amount, description?, metadata?}` with `Idempotency-Key` → 201 transfer (or 4xx problem)
- `GET /transfers/:id` → transfer with entries
- `GET /transfers?account_id?&cursor&limit` → page of transfers
- `PUT /webhook` `{url}` → endpoint with generated secret (secret shown once)
- `GET /webhook-deliveries?status?&cursor&limit`
- `POST /webhook-deliveries/:id/replay`
- `POST /internal/reconcile` → reconciliation run
- `GET /health` → `{status, checks: {db, queue}}`
- `GET /openapi.json`

`external` may be passed in place of an account ID in transfers and resolves to the external account for the other account's currency.

Cursor pagination: opaque base64 cursor over `(created_at, id)`; responses are `{data: [...], next_cursor: string|null}`.

Errors: RFC 9457 `application/problem+json` with `type` (URN-style stable identifier), `title`, `status`, `detail`, optional `errors[]` for validation, and `request_id`.

### Process layout

Two entrypoints — `api` and `worker` — built from one Dockerfile. Compose runs `postgres`, `migrate` (one-shot), `api`, `worker`. Render runs a web service and a background worker against Neon.

## Testing Decisions

### What makes a good test here

A good test exercises the service the way a client or operator would — over HTTP with a real Postgres — and asserts on observable outcomes: response status and body, subsequent reads, and database invariants. Tests never reach into services or repositories directly, never mock the database, and never assert on internal call counts. Concurrency tests assert on the _invariant_ (final balances equal the sum of successful transfers; no negative balances; entries sum to zero) rather than on which specific requests won.

### Seams

**Primary seam: the HTTP boundary with a real database.** Tests boot the Express app in-process against a Testcontainers Postgres (migrated once per suite, truncated between tests) and drive it with supertest. This covers accounts, transfers, idempotency, auth, pagination, error shapes, and the concurrency tests (fire N parallel requests via `Promise.all`).

**Secondary seam: the worker's job handlers with the same real database.** The outbox publisher and `deliver-webhook` handler are invoked directly by the test with a real pg-boss instance on the same container, and the webhook target is an in-test HTTP server that records requests and can be told to fail. This covers delivery, retries, dead-lettering, replay, and the "every committed transfer produces exactly one event" guarantee. Reconciliation is tested through the primary seam via `POST /internal/reconcile`, after deliberately corrupting a balance with raw SQL.

Two seams rather than one because the worker is a genuinely separate process; anything below these two (service or repository unit tests) is not planned.

### Coverage plan

- Accounts: create, get, list with pagination, tenant isolation.
- Transfers: happy path (peer, deposit, withdrawal), every rejection case, `balance_after` correctness, entries immutable.
- Concurrency: 50 parallel transfers draining one account with total > balance — exactly the affordable subset succeeds, balance is never negative; 50 parallel transfers in both directions between two accounts — no deadlock, final balances correct.
- Idempotency: replay, hash mismatch, in-flight conflict, tenant scoping, expiry.
- Webhooks: signature, retry with backoff, dead-letter after max attempts, replay, no event for failed transfers.
- Reconciliation: clean run, detected discrepancy, run recorded.
- Health: reports db/queue status.

### Prior art

None in this repo (greenfield). The author's earlier `blogging_api` used Jest + supertest against an in-memory MongoDB; this project deliberately upgrades that to a real Postgres via Testcontainers so the locking and constraint behaviour under test is the production behaviour.

## Out of Scope

- Holds / authorizations / two-phase transfers.
- Multi-currency transfers and FX.
- Account closure, freezing, or limits.
- Interest, fees, or scheduled/recurring transfers.
- User signup, passwords, sessions, RBAC — API keys only, issued by script.
- Admin UI or any frontend (may be added later as a separate layer).
- BullMQ adapter (planned follow-up; the `JobQueue` interface exists to allow it).
- Metrics/tracing beyond structured logs and a health endpoint.
- Rate limiting and caching.
- Multi-region or HA concerns.

## Further Notes

- Timebox is 1–2 days. Priority order if time runs short: transfer + concurrency + idempotency + tests → outbox/webhooks → reconciliation → deploy → OpenAPI. The README tradeoffs section is never cut.
- The README should include: an architecture diagram, the data model, a worked example of a deposit/transfer/withdrawal showing the entries, the concurrency explanation with the lock-ordering argument, the idempotency state table, the outbox rationale, and a "what I'd do differently at scale" section (partitioning entries, moving to BullMQ, read replicas for statements).
- Render's free tier spins down on inactivity; the README notes the first request may be slow.
- A separate `portfolio-roadmap.md` (outside this repo) tracks follow-up projects: a Nest.js service, a BullMQ queue adapter, and projects targeting caching/rate limiting, auth/RBAC/multi-tenancy, observability, event-driven architecture, and resilient third-party integration.
