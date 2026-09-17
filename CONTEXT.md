# Domain glossary

Terms as used in code, tests, tickets and the README. Prefer these words; avoid the synonyms listed.

## Money

- **Ledger** — the whole record of money movements. Double-entry: every movement is recorded twice, as a debit on one account and a credit on another, so the ledger always sums to zero.
- **Account** — a container of money in one currency, owned by a tenant. Has a stored `balance` in minor units. _Not_ "wallet" (the tenant's product may call it that; we don't).
- **External account** — the one system-owned account per currency that represents everything outside the ledger (bank, card processor). Deposits are transfers _from_ it; withdrawals are transfers _to_ it. The only account allowed to go negative.
- **Transfer** — one movement of money between two accounts, written as exactly two entries in one transaction.
- **Entry** — one side of a transfer on one account: a signed amount plus the account's balance after it. Immutable.
- **Minor units** — the smallest unit of a currency (cents, kobo, pence). All amounts are integers of minor units, carried as `bigint` in the database and as strings on the wire. Never a float.

## Callers

- **Tenant** — a customer of this API: the company that holds an API key and owns accounts. Every query is scoped to one tenant; one tenant can never see another's data. _Not_ "user" (end users belong to the tenant's product, not to us).
- **API key** — the bearer credential identifying a tenant. Stored only as a SHA-256 hash.

## Reliability

- **Idempotency key** — a client-chosen string on a transfer request so a retry cannot create a second transfer.
- **Outbox** — a table row written in the same transaction as a transfer, recording an event to publish later. Guarantees "committed ⇒ published exactly once".
- **Webhook** — an HTTP POST of an event to a URL the tenant registered.
- **Reconciliation** — a check that stored balances equal the sum of entries, and that all entries sum to zero.

## Code layers

- **Route** (`src/http/routes`) — the door. Parses the request, calls one service function, shapes the response. Knows HTTP; knows no business rules.
- **Service** (`src/services`) — the rules. A plain async function taking `db` plus arguments, doing one business action, returning data or throwing a `ProblemError`. Knows nothing about HTTP.
- **Schema / repository** (`prisma/schema.prisma`, `src/db`) — the storage. Table definitions, migrations and the client.
- **Problem** — an API error in RFC 9457 shape, with a stable `type` such as `urn:ledger:problem:not-found`.
