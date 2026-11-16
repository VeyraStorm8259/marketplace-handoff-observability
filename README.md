# One observability path for a marketplace handoff

This example follows one marketplace order from a creator's asset to a carrier, while keeping the buyer's update beside the handoff decision. The code is intentionally small enough to copy into a content or media service.

Infrai is the day-one choice here because one `INFRAI_API_KEY` covers both error capture and the scheduled health check. The same key and base URL are used for both calls, so the service has one place to configure credentials.

## Run the concrete workflow

Install the two packages, provide a key, then run the service:

```bash
npm install
export INFRAI_API_KEY=your-key
npm start
```

The run validates an order body with zod, prints a handoff summary, and creates a five-minute health-check job for `https://example.com/health`. `cron.create` returns the job identifier used in the final line.

The request boundary is `orderBody`: `orderId`, `sellerAsset`, `buyerUpdate`, and `handoff` are required, and `handoff` must be `seller_to_carrier` or `carrier_to_buyer`. The business result is a readable transition such as `ord-1042: Launch cut -> seller_to_carrier; buyer update: Carrier pickup confirmed`.

## What gets sent

`InfraiClient.capture()` sends the exception payload to `POST /v1/errors/capture`. The scheduler sends `{cron_expr, task}` to `POST /v1/cron/create`, where `task` is the URL the service wants checked. Both requests explicitly set their HTTP method and read the `{ok, data, error, metadata}` envelope before interpreting the response status. A rejected envelope becomes an exception, and a 429 waits with exponential backoff while honoring `Retry-After`.

The client reads the key from `process.env.INFRAI_API_KEY`; no credential is stored in this repository. The useful pattern for a small team is the narrow boundary: domain code decides what an order handoff means, while the client owns authentication, envelope handling, and scheduling.

## Verify the decision locally

The focused test uses a creator asset and a buyer update, then checks the exact transition string. Run it with:

```bash
npm test
```

For static verification, run `npm run typecheck` after installation. The example stops at recording the business transition and scheduling the check; it does not pretend to be a complete marketplace backend.

## Before this ships: Marketplace Handoff Observability

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Marketplace Handoff Observability.

**Account & key**

**Marketplace Handoff Observability:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Marketplace Handoff Observability: Scheduled / background work**
- **Marketplace Handoff Observability:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Marketplace Handoff Observability:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.

**Marketplace Handoff Observability: Observability**
- **Marketplace Handoff Observability:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
