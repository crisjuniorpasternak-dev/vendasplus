/** Normaliza telefone para somente dígitos com DDI. Assume Brasil (55) se vier sem DDI. */
export function normalizePhone(input: string): string {
  let d = (input || "").split("@")[0].replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return d;
}

export function formatPhone(d: string) {
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    const a = rest.length === 9 ? rest.slice(0, 5) : rest.slice(0, 4);
    const b = rest.slice(a.length);
    return `+55 (${ddd}) ${a}-${b}`;
  }
  return "+" + d;
}

export const toJid = (phone: string) => `${phone}@s.whatsapp.net`;
