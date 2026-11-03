import { NextResponse, type NextRequest } from "next/server";
import { isPid, publicId } from "@/lib/participant";
import { generateRoomCode } from "@/lib/room-code";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Colisão é improvável (32^6 códigos), mas sala de outro time não pode ser reaproveitada. */
const MAX_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const pid = (body as { pid?: unknown } | null)?.pid;
  if (!isPid(pid)) return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });

  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const code = generateRoomCode();
      if (await getStore().create(code, publicId(pid), Date.now())) return NextResponse.json({ code }, { status: 201 });
    }
    throw new Error("[scrum-poker] Não foi possível gerar um código de sala livre.");
  } catch (error) {
    console.error("[scrum-poker]", error);
    return NextResponse.json({ error: "Não foi possível criar a sala. Tente de novo." }, { status: 503 });
  }
}
