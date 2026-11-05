import clsx from "clsx";

const PALETTE = [
  ["bg-rose-100", "text-rose-500"], ["bg-pink-100", "text-pink-500"], ["bg-lime-100", "text-lime-600"],
  ["bg-sky-100", "text-sky-600"], ["bg-amber-100", "text-amber-600"], ["bg-violet-100", "text-violet-600"],
  ["bg-emerald-100", "text-emerald-600"], ["bg-orange-100", "text-orange-600"],
];

export function colorFor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function Avatar({ name, src, size = 40, badge = false, className }: { name: string; src?: string | null; size?: number; badge?: boolean; className?: string }) {
  const [bg, fg] = colorFor(name);
  return (
    <div className={clsx("relative shrink-0", className)} style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full rounded-full object-cover" />
      ) : (
        <div className={clsx("flex h-full w-full items-center justify-center rounded-full font-medium uppercase", bg, fg)} style={{ fontSize: size * 0.42 }}>
          {name.trim().charAt(0) || "?"}
        </div>
      )}
      {badge && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-[15px] w-[15px] items-center justify-center rounded-full border-2 border-white bg-emerald-500">
          <svg viewBox="0 0 24 24" className="h-2 w-2 fill-white"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Z" /></svg>
        </span>
      )}
    </div>
  );
}
