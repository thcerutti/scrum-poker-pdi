import "server-only";
import { Redis } from "@upstash/redis";

/**
 * A sala inteira mora em um único hash, para que cada leitura custe um comando:
 *   round        -> número da rodada atual
 *   revealed     -> número da rodada que foi revelada (revelada se == round)
 *   p:{id}       -> JSON { name, lastSeen }
 *   v:{id}       -> "{round}:{valor}" (votos de rodadas antigas são ignorados)
 * Limpar a votação é só incrementar `round`, o que é atômico.
 */
export interface RoomStore {
  getAll(): Promise<Record<string, string>>;
  set(fields: Record<string, string>): Promise<void>;
  del(fields: string[]): Promise<void>;
  incrRound(): Promise<number>;
}

const ROOM_KEY = "scrum-poker:room:default";
/** A sala some sozinha depois de um dia sem uso. */
const ROOM_TTL_SECONDS = 60 * 60 * 24;

class RedisStore implements RoomStore {
  constructor(private redis: Redis) {}

  async getAll() {
    return (await this.redis.hgetall<Record<string, string>>(ROOM_KEY)) ?? {};
  }

  async set(fields: Record<string, string>) {
    await this.redis.multi().hset(ROOM_KEY, fields).expire(ROOM_KEY, ROOM_TTL_SECONDS).exec();
  }

  async del(fields: string[]) {
    if (fields.length > 0) await this.redis.hdel(ROOM_KEY, ...fields);
  }

  async incrRound() {
    return this.redis.hincrby(ROOM_KEY, "round", 1);
  }
}

/** Só funciona com um único processo (next dev). Na Vercel é obrigatório usar Redis. */
class MemoryStore implements RoomStore {
  private data = new Map<string, string>();

  async getAll() {
    return Object.fromEntries(this.data);
  }

  async set(fields: Record<string, string>) {
    for (const [k, v] of Object.entries(fields)) this.data.set(k, v);
  }

  async del(fields: string[]) {
    for (const k of fields) this.data.delete(k);
  }

  async incrRound() {
    const next = Number(this.data.get("round") ?? 0) + 1;
    this.data.set("round", String(next));
    return next;
  }
}

function createStore(): RoomStore {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) {
    return new RedisStore(new Redis({ url, token, automaticDeserialization: false }));
  }
  if (process.env.VERCEL) {
    console.warn(
      "[scrum-poker] Redis não configurado: usando memória, o estado não será compartilhado entre instâncias.",
    );
  }
  return new MemoryStore();
}

const globalForStore = globalThis as unknown as { scrumPokerStore?: RoomStore };

export const store = (globalForStore.scrumPokerStore ??= createStore());
