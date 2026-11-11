import { handoffSummary } from "./marketplace_observability.ts";

const summary = handoffSummary({
  orderId: "ord-test",
  sellerAsset: { assetId: "asset-1", title: "Creator thumbnail" },
  buyerUpdate: "Ready for pickup",
  handoff: "seller_to_carrier"
});

if (summary !== "ord-test: Creator thumbnail -> seller_to_carrier; buyer update: Ready for pickup") {
  throw new Error(`Unexpected handoff summary: ${summary}`);
}
console.log("handoff decision test passed");
