"use client";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import clsx from "clsx";
import { Plus, Mic, Send, Smile, Zap, X, Trash2, Square, Paperclip, PenLine } from "lucide-react";
import { fetcher } from "@/lib/client";

const EMOJIS = "😀 😁 😂 🤣 😊 😍 😘 😎 🤔 😅 😉 🙏 👍 👎 👏 🙌 👋 💪 🔥 ✅ ❌ ⚠️ 🚀 🎉 💰 📅 📞 📍 ❤️ 💙 😢 😡 🤝 👀 ⏰ 🛵 🏍️ 🚗 🔒".split(" ");

function pickRecorderMime() {
  const opts = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/mp4", "audio/webm"];
  return opts.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

export function Composer({ disabled, onSend }: { disabled?: boolean; onSend: (p: { text?: string; file?: File; voice?: boolean; sign?: boolean }) => Promise<void> }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [sign, setSign] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const cancelRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const { data: replies } = useSWR<{ id: string; shortcut: string; body: string }[]>("/api/quick-replies", fetcher);

  useEffect(() => { try { setSign(localStorage.getItem("zd_sign") === "1"); } catch {} }, []);
  useEffect(() => { if (!recording) return; const t = setInterval(() => setSeconds((s) => s + 1), 1000); return () => clearInterval(t); }, [recording]);
  useEffect(() => { const ta = taRef.current; if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 160) + "px"; } }, [text]);

  const slash = text.startsWith("/") && !text.includes(" ") ? text.slice(1).toLowerCase() : null;
  const suggestions = slash !== null ? (replies ?? []).filter((r) => r.shortcut.toLowerCase().startsWith(slash)).slice(0, 6) : [];

  async function submit() {
    if (sending || (!text.trim() && !file)) return;
    setSending(true);
    try {
      await onSend({ text, file: file ?? undefined, sign });
      setText(""); setFile(null);
    } finally { setSending(false); taRef.current?.focus(); }
  }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickRecorderMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = []; cancelRef.current = false;
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false); setSeconds(0);
        if (cancelRef.current || !chunks.current.length) return;
        const type = rec.mimeType || "audio/webm";
        const ext = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
        const f = new File(chunks.current, `audio.${ext}`, { type });
        setSending(true);
        try { await onSend({ file: f, voice: true }); } finally { setSending(false); }
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch {
      alert("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
    }
  }

  if (recording) {
    return (
      <div className="flex items-center gap-3 border-t border-gray-100 bg-white px-4 py-3">
        <button onClick={() => { cancelRef.current = true; recRef.current?.stop(); }} className="rounded-full p-2 text-gray-500 hover:bg-gray-100" title="Descartar"><Trash2 size={18} /></button>
        <span className="flex items-center gap-2 text-sm text-red-600"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" /> Gravando {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</span>
        <div className="flex-1" />
        <button onClick={() => recRef.current?.stop()} className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700" title="Enviar áudio"><Send size={17} /></button>
      </div>
    );
  }

  return (
    <div className="relative border-t border-gray-100 bg-white px-3 py-2.5">
      {suggestions.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 mb-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {suggestions.map((r) => (
            <button key={r.id} onClick={() => setText(r.body)} className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-50">
              <span className="font-medium text-brand-600">/{r.shortcut}</span> <span className="text-gray-500">{r.body.slice(0, 80)}</span>
            </button>
          ))}
        </div>
      )}
      {showEmoji && (
        <div className="absolute bottom-full right-3 mb-1 grid w-72 grid-cols-8 gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
          {EMOJIS.map((e) => <button key={e} onClick={() => { setText((t) => t + e); setShowEmoji(false); taRef.current?.focus(); }} className="rounded p-1 text-lg hover:bg-gray-100">{e}</button>)}
        </div>
      )}
      {file && (
        <div className="mb-2 flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm">
          <Paperclip size={15} className="text-gray-500" /> <span className="truncate">{file.name}</span>
          <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</span>
          <button onClick={() => setFile(null)} className="ml-auto text-gray-400 hover:text-gray-600"><X size={15} /></button>
        </div>
      )}
      <div className="flex items-end gap-1.5">
        <input ref={fileInput} type="file" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        <button onClick={() => fileInput.current?.click()} title="Anexar arquivo" className="rounded-full p-2 text-gray-500 hover:bg-gray-100"><Plus size={20} /></button>
        <button onClick={() => setText("/")} title="Respostas rápidas (digite /)" className="rounded-full p-2 text-gray-500 hover:bg-gray-100"><Zap size={18} /></button>
        <button onClick={() => { const v = !sign; setSign(v); try { localStorage.setItem("zd_sign", v ? "1" : "0"); } catch {} }} title={sign ? "Assinatura ativada (seu nome vai no topo da mensagem)" : "Assinar mensagens com meu nome"}
          className={clsx("rounded-full p-2 hover:bg-gray-100", sign ? "text-brand-600" : "text-gray-500")}><PenLine size={18} /></button>
        <div className="flex flex-1 items-end rounded-xl border border-gray-200 px-3 py-1.5 focus-within:border-brand-500">
          <textarea ref={taRef} rows={1} value={text} disabled={disabled} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            onPaste={(e) => { const f = e.clipboardData.files?.[0]; if (f) { e.preventDefault(); setFile(f); } }}
            placeholder={file ? "Legenda (opcional)..." : "Mensagem..."} className="max-h-40 flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-gray-400" />
          <button onClick={() => setShowEmoji((v) => !v)} className="ml-1 pb-0.5 text-gray-500 hover:text-gray-700"><Smile size={20} /></button>
        </div>
        {text.trim() || file ? (
          <button onClick={submit} disabled={sending} className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60" title="Enviar"><Send size={17} /></button>
        ) : (
          <button onClick={startRec} disabled={sending} className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100" title="Gravar áudio">{sending ? <Square size={16} /> : <Mic size={20} />}</button>
        )}
      </div>
    </div>
  );
}
