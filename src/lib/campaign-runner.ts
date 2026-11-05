import type { Campaign } from "@prisma/client";
import { prisma } from "./db";
import { findOrCreateConversation, sendMessage } from "./messaging";
import { renderMessage } from "./spintax";
import { readMedia } from "./storage";

const FAR_FUTURE = new Date("2999-01-01T00:00:00Z");
const rand = (min: number, max: number) => Math.floor(min + Math.random() * (Math.max(max, min) - min + 1));

function inWindow(c: Campaign, now = new Date()) {
  const h = now.getHours();
  if (c.windowStart === c.windowEnd) return true;
  return c.windowStart < c.windowEnd ? h >= c.windowStart && h < c.windowEnd : h >= c.windowStart || h < c.windowEnd;
}

function nextWindowStart(c: Campaign, now = new Date()) {
  const d = new Date(now);
  d.setMinutes(0, 0, 0);
  d.setHours(c.windowStart);
  if (d <= now) d.setDate(d.getDate() + 1);
  return d;
}

/** Processa no máximo um envio por campanha elegível. Seguro para rodar em mais de um processo. */
export async function campaignTick() {
  const now = new Date();
  const due = await prisma.campaign.findMany({
    where: {
      status: "RUNNING",
      OR: [{ nextSendAt: null }, { nextSendAt: { lte: now } }],
      AND: [{ OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }] }],
    },
  });

  for (const c of due) {
    // trava otimista: só um processo pega a vez desta campanha
    const claimed = await prisma.campaign.updateMany({
      where: { id: c.id, status: "RUNNING", nextSendAt: c.nextSendAt },
      data: { nextSendAt: FAR_FUTURE },
    });
    if (claimed.count === 0) continue;

    let next = new Date(Date.now() + rand(c.minDelaySec, c.maxDelaySec) * 1000);
    try {
      if (!inWindow(c)) {
        next = nextWindowStart(c);
        continue;
      }
      const r = await prisma.campaignRecipient.findFirst({
        where: { campaignId: c.id, status: "PENDING" },
        include: { contact: true },
        orderBy: { id: "asc" },
      });
      if (!r) {
        await prisma.campaign.update({ where: { id: c.id }, data: { status: "DONE", finishedAt: new Date(), nextSendAt: null } });
        continue;
      }
      if (r.contact.optOut) {
        await prisma.campaignRecipient.update({ where: { id: r.id }, data: { status: "SKIPPED", error: "Contato pediu para não receber" } });
        next = new Date(); // pula sem esperar
        continue;
      }
      const nome = r.contact.name || r.contact.pushName || "";
      const text = renderMessage(c.message, { nome, primeiro_nome: nome.split(" ")[0] });
      try {
        const { conversation } = await findOrCreateConversation(r.contactId, c.connectionId, "CLOSED");
        const file = c.mediaPath
          ? { data: await readMedia(c.mediaPath), mime: c.mediaMime ?? "application/octet-stream", fileName: c.mediaFileName ?? undefined }
          : undefined;
        const msg = await sendMessage({
          conversationId: conversation.id,
          text,
          file,
          source: "campaign",
          userId: c.createdById,
          template: c.templateName ? { name: c.templateName, lang: c.templateLang ?? "pt_BR" } : undefined,
        });
        await prisma.campaignRecipient.update({ where: { id: r.id }, data: { status: "SENT", sentAt: new Date(), externalId: msg.externalId } });
      } catch (e) {
        await prisma.campaignRecipient.update({ where: { id: r.id }, data: { status: "FAILED", error: e instanceof Error ? e.message : String(e) } });
      }
      const sent = await prisma.campaignRecipient.count({ where: { campaignId: c.id, status: { in: ["SENT", "FAILED"] } } });
      if (c.batchSize > 0 && sent > 0 && sent % c.batchSize === 0) {
        next = new Date(Date.now() + c.batchPauseSec * 1000);
      }
    } catch (e) {
      console.error("[campanhas] erro", c.id, e);
    } finally {
      await prisma.campaign.updateMany({ where: { id: c.id, nextSendAt: FAR_FUTURE }, data: { nextSendAt: next } });
    }
  }
}

let started = false;
export function startCampaignWorker(intervalMs = 3000) {
  if (started) return;
  started = true;
  let busy = false;
  console.log("[campanhas] worker iniciado");
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try { await campaignTick(); } catch (e) { console.error("[campanhas]", e); } finally { busy = false; }
  }, intervalMs);
}
