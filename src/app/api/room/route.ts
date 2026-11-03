import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isCardValue, type CardValue } from "@/lib/deck";
import { getStore } from "@/lib/store";
import type { Participant, RevealGif, RoomState } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Quem não manda heartbeat há esse tempo sai da mesa. Abas em segundo plano
 *  podem ter os timers limitados a 1 por minuto, por isso a folga. */
const STALE_AFTER_MS = 150_000;
/** Ao fechar a aba a pessoa só some depois desse tempo: precisa ser maior que o
 *  heartbeat, para que recarregar ou fechar uma aba duplicada não a tire da mesa. */
const AWAY_GRACE_MS = 20_000;
const MAX_NAME_LENGTH = 30;

const isPid = (pid: unknown): pid is string =>
  typeof pid === "string" && /^[\w-]{1,64}$/.test(pid);

const isRound = (round: unknown): round is number =>
  typeof round === "number" && Number.isSafeInteger(round) && round >= 0;

const isDimension = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && n > 0 && n <= 4000;

/** O `pid` é o segredo de cada navegador e nunca sai do servidor: a mesa só vê
 *  este id derivado, que não permite agir em nome da pessoa. */
const publicId = (pid: string) => createHash("sha256").update(pid).digest("hex").slice(0, 16);

const activeSince = () => Date.now() - STALE_AFTER_MS;

/** Só aceita mídia servida pelo próprio KLIPY. */
function parseGif(gif: unknown): RevealGif | null {
  if (typeof gif !== "object" || gif === null) return null;
  const { url, width, height, title } = gif as Record<string, unknown>;
  if (typeof url !== "string" || url.length > 2000) return null;
  if (!/^https:\/\/static\d*\.klipy\.com\//.test(url)) return null;
  if (!isDimension(width) || !isDimension(height)) return null;
  return { url, width, height, title: typeof title === "string" ? title.slice(0, 200) : "" };
}

async function readState(pid: string | null): Promise<RoomState> {
  const fields = await getStore().getAll();
  const round = Number(fields.round ?? 0);
  const revealed = fields.revealed === String(round);
  const since = activeSince();
  const selfId = pid ? publicId(pid) : null;

  const participants: Participant[] = [];
  let myVote: CardValue | null = null;
  let seated = false;

  for (const [key, name] of Object.entries(fields)) {
    if (!key.startsWith("p:")) continue;
    const id = key.slice(2);
    // Quem sumiu só deixa de aparecer: o voto continua lá se a pessoa voltar na mesma rodada.
    if (Number(fields[`s:${id}`] ?? 0) < since) continue;

    const [voteRound, value] = (fields[`v:${id}`] ?? "").split(":");
    const vote = Number(voteRound) === round && isCardValue(value) ? value : null;
    if (id === selfId) {
      myVote = vote;
      seated = true;
    }

    participants.push({ id, name, voted: vote !== null, vote: revealed ? vote : null });
  }

  participants.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const rawGif = revealed ? fields[`gif:${round}`] : undefined;
  const gif = rawGif ? (JSON.parse(rawGif) as RevealGif) : null;

  return { round, revealed, participants, selfId, seated, myVote, gif };
}

async function handle(run: () => Promise<NextResponse>) {
  try {
    return await run();
  } catch (error) {
    console.error("[scrum-poker]", error);
    return NextResponse.json(
      { error: "A sala está indisponível no momento. Tente de novo em instantes." },
      { status: 503 },
    );
  }
}

export function GET(request: NextRequest) {
  const pid = request.headers.get("x-participant");
  return handle(async () => NextResponse.json(await readState(isPid(pid) ? pid : null)));
}

export function POST(request: NextRequest) {
  return handle(async () => {
    // sendBeacon (usado ao fechar a aba) envia o corpo como text/plain.
    let body: unknown;
    try {
      body = JSON.parse(await request.text());
    } catch {
      return badRequest("Corpo da requisição inválido.");
    }
    if (typeof body !== "object" || body === null) return badRequest("Corpo da requisição inválido.");
    return act(body as Record<string, unknown>);
  });
}

async function act(body: Record<string, unknown>) {
  const { action, pid } = body;
  if (!isPid(pid)) return badRequest("Identificador inválido.");
  const id = publicId(pid);
  const store = getStore();

  switch (action) {
    case "join": {
      const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME_LENGTH) : "";
      if (!name) return badRequest("Informe um nome.");
      await store.join(id, name, Date.now(), activeSince());
      break;
    }

    // Não devolve a sala: um estado lido antes de um voto, chegando depois dele,
    // desfaria o voto na tela. Quem atualiza a tela é o polling.
    case "heartbeat":
      return NextResponse.json({ seated: await store.touch(id, Date.now()) });

    // Aba fechada ou recarregada: se não voltar sinal logo, a pessoa sai da mesa.
    case "away":
      await store.touch(id, Date.now() - STALE_AFTER_MS + AWAY_GRACE_MS);
      return new NextResponse(null, { status: 204 });

    case "leave":
      await store.leave(id);
      break;

    case "vote": {
      const { round, value } = body;
      if (!isRound(round) || (value !== null && !isCardValue(value))) {
        return badRequest("Voto inválido.");
      }
      if (!(await store.vote(id, round, value))) return conflict(pid);
      break;
    }

    case "reveal": {
      if (!isRound(body.round)) return badRequest("Rodada inválida.");
      if (!(await store.reveal(body.round))) return conflict(pid);
      break;
    }

    case "gif": {
      const gif = parseGif(body.gif);
      if (!isRound(body.round) || !gif) return badRequest("GIF inválido.");
      await store.setGif(body.round, JSON.stringify(gif));
      break;
    }

    case "clear": {
      if (!isRound(body.round)) return badRequest("Rodada inválida.");
      if (!(await store.clear(body.round, activeSince()))) return conflict(pid);
      break;
    }

    default:
      return badRequest("Ação desconhecida.");
  }

  return NextResponse.json(await readState(pid));
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

async function conflict(pid: string) {
  return NextResponse.json(
    { error: "A votação já foi revelada ou reiniciada.", state: await readState(pid) },
    { status: 409 },
  );
}
