/** Resolve spintax "{Oi|Olá|E aí}" e variáveis "{{nome}}". */
export function renderMessage(template: string, vars: Record<string, string | undefined | null>) {
  let out = template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k.toLowerCase()] ?? "");
  // resolve do mais interno para fora
  const re = /\{([^{}]*\|[^{}]*)\}/;
  let guard = 0;
  while (re.test(out) && guard++ < 100) {
    out = out.replace(re, (_, body: string) => {
      const opts = body.split("|");
      return opts[Math.floor(Math.random() * opts.length)];
    });
  }
  return out.replace(/[ \t]+\n/g, "\n").trim();
}
