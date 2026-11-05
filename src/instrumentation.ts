export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.CAMPAIGN_WORKER_INLINE === "true") {
    const { startCampaignWorker } = await import("./lib/campaign-runner");
    startCampaignWorker();
  }
}
