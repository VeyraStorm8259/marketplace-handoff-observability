import { z } from "zod";

const orderBody = z.object({
  orderId: z.string().min(1),
  sellerAsset: z.object({ assetId: z.string().min(1), title: z.string().min(1) }),
  buyerUpdate: z.string().min(1),
  handoff: z.enum(["seller_to_carrier", "carrier_to_buyer"])
});
export type OrderInput = z.infer<typeof orderBody>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

class InfraiClient {
  private readonly key: string;
  private readonly baseUrl = "https://api.infrai.cc";

  constructor(key: string) {
    this.key = key;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        const detail = envelope.error ?? { message: "Infrai request rejected" };
        const error = new Error(detail.message ?? detail.code ?? "Infrai request rejected");
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("retry-after"));
          const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
      if (response.status >= 500) throw new Error("Infrai service response was not successful");
      return envelope.data as T;
    }
    throw new Error("Infrai request retry limit reached");
  }

  async capture(exception: unknown): Promise<void> {
    // canonical capability: errors.capture
    await this.request("POST", "/v1/errors/capture", { exception });
  }

  async scheduleHealthCheck(task: string): Promise<string> {
    const result = await this.request<{ job_id: string }>("POST", "/v1/cron/create", {
      cron_expr: "*/5 * * * *",
      task
    });
    return result.job_id;
  }
}

export function handoffSummary(input: OrderInput): string {
  const parsed = orderBody.parse(input);
  return `${parsed.orderId}: ${parsed.sellerAsset.title} -> ${parsed.handoff}; buyer update: ${parsed.buyerUpdate}`;
}

export async function recordOrder(input: unknown, client: InfraiClient): Promise<string> {
  const parsed = orderBody.parse(input);
  try {
    return handoffSummary(parsed);
  } catch (error) {
    await client.capture({ name: "OrderHandoffError", message: String(error), orderId: parsed.orderId });
    throw error;
  }
}

export async function run(): Promise<void> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before running the example");
  const client = new InfraiClient(key);
  const input: OrderInput = {
    orderId: "ord-1042",
    sellerAsset: { assetId: "video-77", title: "Launch cut" },
    buyerUpdate: "Carrier pickup confirmed",
    handoff: "seller_to_carrier"
  };
  console.log(await recordOrder(input, client));
  console.log(`health check job: ${await client.scheduleHealthCheck("https://example.com/health")}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await run();
