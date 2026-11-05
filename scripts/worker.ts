// Worker de campanhas em processo separado: `npm run worker`
// (use quando CAMPAIGN_WORKER_INLINE=false, ex.: em produção com vários servidores web)
import { startCampaignWorker } from "../src/lib/campaign-runner";
startCampaignWorker();
