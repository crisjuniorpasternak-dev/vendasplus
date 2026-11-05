"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { MessagesSquare } from "lucide-react";
import { ConversationList } from "./ConversationList";
import { ChatWindow } from "./ChatWindow";
import { ContactPanel } from "./ContactPanel";

export function ChatWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const selected = params.get("c");
  const [panelOpen, setPanelOpen] = useState(true);
  const select = (id: string | null) => router.replace(id ? `/chat?c=${id}` : "/chat", { scroll: false });

  return (
    <div className="flex min-w-0 flex-1">
      <ConversationList selectedId={selected} onSelect={select} />
      {selected ? (
        <>
          <ChatWindow key={selected} conversationId={selected} panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((v) => !v)} />
          {panelOpen && <ContactPanel conversationId={selected} />}
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-gray-50/60 text-gray-400">
          <MessagesSquare size={48} strokeWidth={1.2} />
          <p className="text-sm">Selecione uma conversa para começar o atendimento</p>
        </div>
      )}
    </div>
  );
}
