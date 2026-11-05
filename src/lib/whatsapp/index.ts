import type { Connection } from "@prisma/client";
import { CloudApiProvider } from "./cloud";
import { EvolutionProvider } from "./evolution";
import type { WhatsAppProvider } from "./types";

export function getProvider(conn: Pick<Connection, "provider" | "instanceName">): WhatsAppProvider {
  switch (conn.provider) {
    case "CLOUD_API":
      return new CloudApiProvider(conn.instanceName);
    case "EVOLUTION":
    default:
      return new EvolutionProvider(conn.instanceName);
  }
}

export async function downloadInboundMedia(conn: Pick<Connection, "provider" | "instanceName">, ref: any) {
  if (!ref) return null;
  if (conn.provider === "CLOUD_API" && ref.mediaId) return new CloudApiProvider(conn.instanceName).downloadMedia(ref.mediaId);
  if (conn.provider === "EVOLUTION" && ref.messageId) return new EvolutionProvider(conn.instanceName).downloadMedia(ref.messageId);
  return null;
}

export * from "./types";
