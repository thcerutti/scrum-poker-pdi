import { NextResponse, type NextRequest } from "next/server";
import { isCardValue, type CardValue } from "@/lib/deck";
import { isPid, publicId } from "@/lib/participant";
import { isRoomCode } from "@/lib/room-code";
import { currentAdmin, getStore, NotRoomAdminError, RoomNotFoundError, type RoomStore } from "@/lib/store";
import type { Participant, RevealGif, RoomState } from "@/lib/types";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ code: string }>;
}

/** Quem não manda heartbeat há esse tempo sai da mesa. Abas em segundo plano
 *  podem ter os timers limitados a 1 por minuto, por isso a folga. */
const STALE_AFTER_MS = 150_000;
/** Ao fechar a aba a pessoa só some depois desse tempo: precisa ser maior que o
 *  heartbeat, para que recarregar ou fechar uma aba duplicada não a tire da mesa. */
const AWAY_GRACE_MS = 20_000;
const MAX_NAME_LENGTH = 30;

const isRound = (round: unknown): round is number =>
  typeof round === "number" && Number.isSafeInteger(round) && round >= 0;

const isDimension = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && n > 0 && n <= 4000;

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

async function readState(room: RoomStore, pid: string | null): Promise<RoomState> {
  const fields = await room.getAll();
  if (!fields.createdAt) throw new RoomNotFoundError();

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

  return { round, revealed, participants, adminId: currentAdmin(fields, since), selfId, seated, myVote, gif };
}

async function handle({ params }: RouteContext, run: (room: RoomStore) => Promise<NextResponse>) {
  try {
    const { code } = await params;
    if (!isRoomCode(code)) throw new RoomNotFoundError();
    return await run(getStore().room(code));
  } catch (error) {
    if (error instanceof RoomNotFoundError) {
      return NextResponse.json({ error: "Sala não encontrada." }, { status: 404 });
    }
    if (error instanceof NotRoomAdminError) {
      return NextResponse.json({ error: "Só o admin da sala pode revelar ou limpar a votação." }, { status: 403 });
    }
    console.error("[scrum-poker]", error);
    return NextResponse.json(
      { error: "A sala está indisponível no momento. Tente de novo em instantes." },
      { status: 503 },
    );
  }
}

export function GET(request: NextRequest, context: RouteContext) {
  const pid = request.headers.get("x-participant");
  return handle(context, async (room) => NextResponse.json(await readState(room, isPid(pid) ? pid : null)));
}

export function POST(request: NextRequest, context: RouteContext) {
  return handle(context, async (room) => {
    // sendBeacon (usado ao fechar a aba) envia o corpo como text/plain.
    let body: unknown;
    try {
      body = JSON.parse(await request.text());
    } catch {
      return badRequest("Corpo da requisição inválido.");
    }
    if (typeof body !== "object" || body === null) return badRequest("Corpo da requisição inválido.");
    return act(room, body as Record<string, unknown>);
  });
}

async function act(store: RoomStore, body: Record<string, unknown>) {
  const { action, pid } = body;
  if (!isPid(pid)) return badRequest("Identificador inválido.");
  const id = publicId(pid);

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
      return NextResponse.json({ seated: await store.touch(id, Date.now(), activeSince()) });

    // Aba fechada ou recarregada: se não voltar sinal logo, a pessoa sai da mesa.
    case "away":
      await store.touch(id, Date.now() - STALE_AFTER_MS + AWAY_GRACE_MS, activeSince());
      return new NextResponse(null, { status: 204 });

    case "leave":
      await store.leave(id, activeSince());
      break;

    case "vote": {
      const { round, value } = body;
      if (!isRound(round) || (value !== null && !isCardValue(value))) {
        return badRequest("Voto inválido.");
      }
      if (!(await store.vote(id, round, value))) return conflict(store, pid);
      break;
    }

    case "reveal": {
      if (!isRound(body.round)) return badRequest("Rodada inválida.");
      if (!(await store.reveal(id, body.round, activeSince()))) return conflict(store, pid);
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
      if (!(await store.clear(id, body.round, activeSince()))) return conflict(store, pid);
      break;
    }

    default:
      return badRequest("Ação desconhecida.");
  }

  return NextResponse.json(await readState(store, pid));
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

async function conflict(room: RoomStore, pid: string) {
  return NextResponse.json(
    { error: "A votação já foi revelada ou reiniciada.", state: await readState(room, pid) },
    { status: 409 },
  );
}
