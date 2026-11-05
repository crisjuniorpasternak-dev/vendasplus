export type Tag = { id: string; name: string; color: string };
export type ContactLite = { id: string; name: string | null; pushName: string | null; phone: string; avatarUrl?: string | null; tags: { tag: Tag }[] };
export type ConversationItem = {
  id: string; number: number; status: "OPEN" | "PENDING" | "CLOSED"; unreadCount: number; lastMessageAt: string;
  lastMessagePreview: string | null; lastMessageDirection: "IN" | "OUT" | null;
  contact: ContactLite; connection: { id: string; name: string }; assignedTo: { id: string; name: string } | null;
};
export type Message = {
  id: string; direction: "IN" | "OUT"; type: string; body: string | null; mediaPath: string | null; mediaMime: string | null;
  fileName: string | null; status: string; error: string | null; source: string; deleted: boolean; createdAt: string;
  sender: { id: string; name: string } | null;
};
export type HistoryEvent = { id: string; type: string; description: string; createdAt: string; user?: { name: string } | null };
export type Stage = { id: string; name: string; order: number; color: string };
export type Deal = { id: string; number: number; title: string; value: string; status: "OPEN" | "WON" | "LOST"; product: string | null; createdAt: string; stage: Stage; stageId: string; owner: { id: string; name: string } | null };
export type ContactFull = ContactLite & {
  email: string | null; site: string | null; document: string | null; birthDate: string | null; notes: string | null;
  street: string | null; number: string | null; district: string | null; city: string | null; state: string | null; zipCode: string | null;
  customFields: Record<string, string> | null; optOut: boolean;
  lists: { list: { id: string; name: string } }[]; deals: Deal[]; history: HistoryEvent[];
};
export type ConversationDetail = Omit<ConversationItem, "contact"> & {
  contact: ContactFull; connection: { id: string; name: string; provider: string; status: string };
};
