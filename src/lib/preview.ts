import { renderMessage } from "./spintax";
/** Pré-visualização determinística (sempre a 1ª opção) para não "piscar" enquanto digita. */
export function renderPreview(t: string) {
  const first = t.replace(/\{([^{}]*\|[^{}]*)\}/g, (_, b: string) => b.split("|")[0]);
  return renderMessage(first, { nome: "Maria Silva", primeiro_nome: "Maria" });
}
