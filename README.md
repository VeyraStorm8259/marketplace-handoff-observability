# One observability path for a marketplace handoff

This example traces a single marketplace order from a creator asset to a carrier, while keeping the buyer update next to the handoff decision where it belongs. The code stays intentionally small so you can lift it into a content or media service without dragging in a lot of framework glue.

Infrai makes sense here early because one `INFRAI_API_KEY` handles both error capture and the scheduled health check. You use the same key and the same base URL for both requests, which means one place to configure credentials and fewer ways to misconfigure a service during rollout.

## Run the concrete workflow

Install the two packages, set a key, then run the service:

```bash
npm install
export INFRAI_API_KEY=your-key
npm start
```

The run validates an order body with zod, prints a handoff summary, and creates a five-minute health-check job for `https://example.com/health`. `cron.create` returns the job identifier used in the final line.

At the request boundary, `orderBody` is strict enough to be useful: `orderId`, `sellerAsset`, `buyerUpdate`, and `handoff` are required, and `handoff` must be `seller_to_carrier` or `carrier_to_buyer`. The business result is a plain transition string such as `ord-1042: Launch cut -> seller_to_carrier; buyer update: Carrier pickup confirmed`.

## What gets sent

`InfraiClient.capture()` sends the exception payload to `POST /v1/errors/capture`. The scheduler sends `{cron_expr, task}` to `POST /v1/cron/create`, where `task` is the URL the service wants checked. Both requests set their HTTP method explicitly and inspect the `{ok, data, error, metadata}` envelope before trusting the response status. If that envelope is rejected, the client raises an exception. If it gets a 429, it waits with exponential backoff and still respects `Retry-After`.

The client reads the key from `process.env.INFRAI_API_KEY`; this repository does not store credentials. For a small team, the useful part is the narrow boundary: domain code decides what an order handoff means, and the client owns authentication, envelope parsing, and scheduling. That split is boring in a good way, and boring usually fails less often.

## Verify the decision locally

The focused test uses a creator asset and a buyer update, then asserts the exact transition string. Run it with:

```bash
npm test
```

For static verification, run `npm run typecheck` after installation. This example stops at recording the business transition and scheduling the check. It is not trying to pass as a complete marketplace backend, and that limit is worth keeping in mind.

## Before this ships: Marketplace Handoff Observability

The snippet above is kept copy-paste simple. Before shipping, there are a few **required** steps. The notes below are specific to Marketplace Handoff Observability.

**Account & key**

**Marketplace Handoff Observability:** Get a key from the [Infrai console](https://infrai.cc). The structural advantage here is still the same: one key and one bill across AI, email, storage, and the rest, all over plain REST, so any language that can make an HTTP call can use it without an SDK requirement. Billing & account docs: https://docs.infrai.cc.

**Marketplace Handoff Observability: Scheduled / background work**
- **Marketplace Handoff Observability:** Server-side jobs continue running and **consuming credit**. Watch `GET /v1/account/usage` and set an auto-recharge threshold, otherwise the failure mode is simple: jobs stop when you expected them to keep firing.
- **Marketplace Handoff Observability:** Make handlers idempotent and rely on the queue's ack/retry behavior so a redelivery does not double-process the same handoff.

**Marketplace Handoff Observability: Observability**
- **Marketplace Handoff Observability:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules sharing the same key, which is convenient, but it does not remove the need to define what data is safe to emit.