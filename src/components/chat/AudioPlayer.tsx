"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import clsx from "clsx";

const SPEEDS = [1, 1.5, 2];

export function AudioPlayer({ src, outgoing, trailing }: { src: string; outgoing: boolean; trailing?: React.ReactNode }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [speed, setSpeed] = useState(0);
  const bars = useMemo(() => Array.from({ length: 28 }, (_, i) => 30 + Math.abs(Math.sin(i * 1.7 + src.length)) * 70), [src]);

  useEffect(() => { if (ref.current) ref.current.playbackRate = SPEEDS[speed]; }, [speed]);
  const fmt = (s: number) => (Number.isFinite(s) ? `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "00:00");

  return (
    <div className={clsx("flex w-[300px] items-center gap-2 rounded-lg px-2.5 py-2", outgoing ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-700")}>
      <audio ref={ref} src={src} preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => { const a = e.currentTarget; setCurrent(a.currentTime); setProgress(a.duration ? a.currentTime / a.duration : 0); }}
        onEnded={() => { setPlaying(false); setProgress(0); setCurrent(0); }} />
      <button onClick={() => { const a = ref.current!; if (playing) { a.pause(); setPlaying(false); } else { a.play(); setPlaying(true); } }}
        className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", outgoing ? "bg-white/25" : "bg-white")}>
        {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
      </button>
      <div className="flex h-6 flex-1 cursor-pointer items-center gap-[2px]"
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const a = ref.current!; if (a.duration) a.currentTime = ((e.clientX - r.left) / r.width) * a.duration; }}>
        {bars.map((h, i) => (
          <span key={i} className={clsx("w-[3px] rounded-full", i / bars.length <= progress ? (outgoing ? "bg-white" : "bg-brand-600") : outgoing ? "bg-white/45" : "bg-gray-400/60")} style={{ height: `${h}%` }} />
        ))}
      </div>
      <span className="text-xs tabular-nums">{fmt(playing || current ? current : duration)}</span>
      <button onClick={() => setSpeed((s) => (s + 1) % SPEEDS.length)} className={clsx("rounded-full px-1.5 py-0.5 text-[11px] font-semibold", outgoing ? "bg-white/25" : "bg-white")}>{SPEEDS[speed]}x</button>
      {trailing}
    </div>
  );
}
