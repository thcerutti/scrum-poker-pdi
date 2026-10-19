import { NextResponse, type NextRequest } from "next/server";
import { isCardValue, type CardValue } from "@/lib/deck";
import { store } from "@/lib/store";
import type { Participant, RoomState } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Quem não manda heartbeat há esse tempo sai da mesa. Abas em segundo plano
 *  podem ter os timers limitados a 1 por minuto, por isso a folga. */
const STALE_AFTER_MS = 150_000;
const MAX_NAME_LENGTH = 30;

const isPid = (pid: unknown): pid is string =>
  typeof pid === "string" && /^[\w-]{1,64}$/.test(pid);

const isRound = (round: unknown): round is number =>
  typeof round === "number" && Number.isInteger(round) && round >= 0;

async function readState(pid: string | null): Promise<RoomState> {
  const fields = await store.getAll();
  const round = Number(fields.round ?? 0);
  const revealed = Number(fields.revealed ?? -1) === round;
  const now = Date.now();

  const participants: Participant[] = [];
  const stale: string[] = [];
  let myVote: CardValue | null = null;

  for (const [key, raw] of Object.entries(fields)) {
    if (!key.startsWith("p:")) continue;
    const id = key.slice(2);
    const { name, lastSeen } = JSON.parse(raw) as { name: string; lastSeen: number };
    if (now - lastSeen > STALE_AFTER_MS) {
      stale.push(key, `v:${id}`);
      continue;
    }

    const [voteRound, value] = (fields[`v:${id}`] ?? "").split(":");
    const vote = Number(voteRound) === round && isCardValue(value) ? value : null;
    if (id === pid) myVote = vote;

    participants.push({ id, name, voted: vote !== null, vote: revealed ? vote : null });
  }

  if (stale.length > 0) await store.del(stale);

  participants.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return { round, revealed, participants, myVote };
}

export async function GET(request: NextRequest) {
  const pid = request.nextUrl.searchParams.get("pid");
  return NextResponse.json(await readState(isPid(pid) ? pid : null));
}

export async function POST(request: NextRequest) {
  // sendBeacon (usado ao fechar a aba) envia o corpo como text/plain.
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return badRequest("Corpo da requisição inválido.");
  }
  const { action, pid } = body;
  if (!isPid(pid)) return badRequest("Identificador inválido.");

  switch (action) {
    case "join": {
      const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME_LENGTH) : "";
      if (!name) return badRequest("Informe um nome.");
      await store.set({ [`p:${pid}`]: JSON.stringify({ name, lastSeen: Date.now() }) });
      break;
    }

    case "leave":
      await store.del([`p:${pid}`, `v:${pid}`]);
      break;

    case "vote": {
      const { round, value } = body;
      if (!isRound(round) || (value !== null && !isCardValue(value))) {
        return badRequest("Voto inválido.");
      }
      const current = await readState(pid);
      if (current.round !== round || current.revealed) {
        return NextResponse.json(
          { error: "A votação já foi revelada ou reiniciada.", state: current },
          { status: 409 },
        );
      }
      if (value === null) await store.del([`v:${pid}`]);
      else await store.set({ [`v:${pid}`]: `${round}:${value}` });
      break;
    }

    case "reveal": {
      // Gravar a rodada (e não um booleano) faz um "revelar" atrasado de uma
      // rodada antiga não afetar a rodada nova.
      if (!isRound(body.round)) return badRequest("Rodada inválida.");
      await store.set({ revealed: String(body.round) });
      break;
    }

    case "clear":
      await store.incrRound();
      break;

    default:
      return badRequest("Ação desconhecida.");
  }

  return NextResponse.json(await readState(pid));
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
