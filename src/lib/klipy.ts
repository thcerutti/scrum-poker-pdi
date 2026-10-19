import type { AgreementLevel } from "./deck";
import type { RevealGif } from "./types";

/**
 * Os termos do KLIPY exigem que a busca saia do navegador do usuário (não de um
 * servidor nosso), por isso a chave vai para o bundle (ver next.config.ts). Sem
 * chave, os GIFs ficam desligados.
 */
const API_KEY = process.env.KLYPY_KEY;

const QUERIES: Record<AgreementLevel, string[]> = {
  consensus: ["celebration", "high five", "nailed it", "party", "victory dance"],
  minor: ["almost", "close enough", "so close", "thinking"],
  divergent: ["confused", "what", "debate", "shocked", "plot twist"],
  single: ["lonely", "waiting", "anybody"],
  coffee: ["coffee break", "coffee time"],
  empty: ["crickets", "empty room"],
};

/** Sorteia uma página entre as primeiras e usa o primeiro resultado dela, para
 *  variar o GIF sem reordenar nem filtrar o que o KLIPY devolveu. */
const MAX_PAGE = 8;

interface KlipyFile {
  url: string;
  width: number;
  height: number;
}

interface KlipyItem {
  type: string;
  title?: string;
  file?: Partial<Record<"hd" | "md" | "sm" | "xs", Partial<Record<"gif" | "webp", KlipyFile>>>>;
}

const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];

async function search(q: string, page: number, customerId: string): Promise<KlipyItem[]> {
  const params = new URLSearchParams({
    q,
    page: String(page),
    per_page: "1",
    customer_id: customerId,
    locale: "br",
    content_filter: "high",
    format_filter: "webp,gif",
  });
  const res = await fetch(`https://api.klipy.com/api/v1/${API_KEY}/gifs/search?${params}`);
  if (!res.ok) throw new Error(`KLIPY respondeu ${res.status}`);
  const json = await res.json();
  return json?.data?.data ?? [];
}

export async function fetchRevealGif(level: AgreementLevel, customerId: string): Promise<RevealGif | null> {
  if (!API_KEY) return null;

  const q = pick(QUERIES[level]);
  let items = await search(q, 1 + Math.floor(Math.random() * MAX_PAGE), customerId);
  if (!items.some((i) => i.type === "gif")) items = await search(q, 1, customerId);

  const item = items.find((i) => i.type === "gif");
  const file = item?.file?.md?.webp ?? item?.file?.md?.gif ?? item?.file?.sm?.webp ?? item?.file?.sm?.gif;
  if (!file) return null;

  return { url: file.url, width: file.width, height: file.height, title: item?.title ?? q };
}
