import "server-only";
import { Redis } from "@upstash/redis";

/**
 * A sala inteira mora em um único hash, para que cada leitura custe um comando:
 *   round         -> número da rodada atual
 *   revealed      -> número da rodada que foi revelada (revelada se == round)
 *   p:{id}        -> nome do participante
 *   s:{id}        -> último sinal de vida (epoch em ms)
 *   v:{id}        -> "{round}:{valor}" (votos de rodadas antigas são ignorados)
 *   gif:{round}   -> JSON do GIF da rodada
 *
 * Toda regra que depende do estado atual precisa ser atômica: com vários clientes
 * em várias instâncias, ler e depois escrever perde corridas. Por isso as escritas
 * condicionais são scripts Lua, e `getAll` nunca escreve.
 */
export interface RoomStore {
  getAll(): Promise<Record<string, string>>;
  /** Senta na mesa. Se ela estava vazia com a rodada revelada, começa uma rodada nova. */
  join(id: string, name: string, now: number, activeSince: number): Promise<void>;
  /** Atualiza o sinal de vida de quem ainda está na mesa; `false` se a pessoa não está. */
  touch(id: string, lastSeen: number): Promise<boolean>;
  leave(id: string): Promise<void>;
  /** `value` nulo retira o voto. `false` se a rodada mudou ou já foi revelada. */
  vote(id: string, round: number, value: string | null): Promise<boolean>;
  /** `false` se `round` não é a rodada atual. */
  reveal(round: number): Promise<boolean>;
  /** Fica o primeiro GIF de uma rodada revelada; `false` nos demais casos. */
  setGif(round: number, gif: string): Promise<boolean>;
  /** Inicia a rodada seguinte, se `round` ainda é a atual; recolhe quem sumiu da mesa. */
  clear(round: number, activeSince: number): Promise<boolean>;
}

const ROOM_KEY = "scrum-poker:room:default";
/** A sala some sozinha depois de um dia sem uso. */
const ROOM_TTL_SECONDS = 60 * 60 * 24;

const CURRENT_ROUND = `local round = redis.call('HGET', KEYS[1], 'round') or '0'`;
const KEEP_ALIVE = `redis.call('EXPIRE', KEYS[1], ${ROOM_TTL_SECONDS})`;

export const SCRIPTS = {
  join: `${CURRENT_ROUND}
local fields = redis.call('HGETALL', KEYS[1])
local occupied = false
for i = 1, #fields, 2 do
  if string.sub(fields[i], 1, 2) == 's:' and tonumber(fields[i + 1]) >= tonumber(ARGV[4]) then occupied = true end
end
if not occupied and redis.call('HGET', KEYS[1], 'revealed') == round then
  redis.call('HINCRBY', KEYS[1], 'round', 1)
end
redis.call('HSET', KEYS[1], 'p:' .. ARGV[1], ARGV[2], 's:' .. ARGV[1], ARGV[3])
${KEEP_ALIVE}
return 1`,

  touch: `if redis.call('HEXISTS', KEYS[1], 'p:' .. ARGV[1]) == 0 then return 0 end
redis.call('HSET', KEYS[1], 's:' .. ARGV[1], ARGV[2])
${KEEP_ALIVE}
return 1`,

  vote: `${CURRENT_ROUND}
if round ~= ARGV[2] or redis.call('HGET', KEYS[1], 'revealed') == round then return 0 end
if ARGV[3] == '' then
  redis.call('HDEL', KEYS[1], 'v:' .. ARGV[1])
else
  redis.call('HSET', KEYS[1], 'v:' .. ARGV[1], round .. ':' .. ARGV[3])
end
${KEEP_ALIVE}
return 1`,

  reveal: `${CURRENT_ROUND}
if round ~= ARGV[1] then return 0 end
redis.call('HSET', KEYS[1], 'revealed', round)
${KEEP_ALIVE}
return 1`,

  setGif: `${CURRENT_ROUND}
if round ~= ARGV[1] or redis.call('HGET', KEYS[1], 'revealed') ~= round then return 0 end
return redis.call('HSETNX', KEYS[1], 'gif:' .. round, ARGV[2])`,

  clear: `${CURRENT_ROUND}
if round ~= ARGV[1] then return 0 end
redis.call('HINCRBY', KEYS[1], 'round', 1)
local fields = redis.call('HGETALL', KEYS[1])
for i = 1, #fields, 2 do
  local field = fields[i]
  if string.sub(field, 1, 2) == 'v:' or string.sub(field, 1, 4) == 'gif:' then
    redis.call('HDEL', KEYS[1], field)
  elseif string.sub(field, 1, 2) == 's:' and tonumber(fields[i + 1]) < tonumber(ARGV[2]) then
    redis.call('HDEL', KEYS[1], field, 'p:' .. string.sub(field, 3))
  end
end
${KEEP_ALIVE}
return 1`,
} as const;

class RedisStore implements RoomStore {
  constructor(private redis: Redis) {}

  private async run(script: keyof typeof SCRIPTS, ...args: string[]) {
    return (await this.redis.eval(SCRIPTS[script], [ROOM_KEY], args)) === 1;
  }

  async getAll() {
    // Com automaticDeserialization: false, o hgetall devolve a lista crua
    // [campo, valor, campo, valor...] em vez de um objeto.
    const flat = (await this.redis.hgetall(ROOM_KEY)) as unknown as string[] | null;
    const fields: Record<string, string> = {};
    for (let i = 0; flat && i < flat.length; i += 2) fields[flat[i]] = flat[i + 1];
    return fields;
  }

  async join(id: string, name: string, now: number, activeSince: number) {
    await this.run("join", id, name, String(now), String(activeSince));
  }

  touch(id: string, lastSeen: number) {
    return this.run("touch", id, String(lastSeen));
  }

  async leave(id: string) {
    await this.redis.hdel(ROOM_KEY, `p:${id}`, `s:${id}`, `v:${id}`);
  }

  vote(id: string, round: number, value: string | null) {
    return this.run("vote", id, String(round), value ?? "");
  }

  reveal(round: number) {
    return this.run("reveal", String(round));
  }

  setGif(round: number, gif: string) {
    return this.run("setGif", String(round), gif);
  }

  clear(round: number, activeSince: number) {
    return this.run("clear", String(round), String(activeSince));
  }
}

/** Só funciona com um único processo (next dev). Na Vercel é obrigatório usar Redis. */
class MemoryStore implements RoomStore {
  private data = new Map<string, string>();

  private get round() {
    return this.data.get("round") ?? "0";
  }

  private get revealed() {
    return this.data.get("revealed") === this.round;
  }

  async getAll() {
    return Object.fromEntries(this.data);
  }

  async join(id: string, name: string, now: number, activeSince: number) {
    const occupied = [...this.data].some(([k, v]) => k.startsWith("s:") && Number(v) >= activeSince);
    if (!occupied && this.revealed) this.data.set("round", String(Number(this.round) + 1));
    this.data.set(`p:${id}`, name);
    this.data.set(`s:${id}`, String(now));
  }

  async touch(id: string, lastSeen: number) {
    if (!this.data.has(`p:${id}`)) return false;
    this.data.set(`s:${id}`, String(lastSeen));
    return true;
  }

  async leave(id: string) {
    for (const prefix of ["p", "s", "v"]) this.data.delete(`${prefix}:${id}`);
  }

  async vote(id: string, round: number, value: string | null) {
    if (this.round !== String(round) || this.revealed) return false;
    if (value === null) this.data.delete(`v:${id}`);
    else this.data.set(`v:${id}`, `${round}:${value}`);
    return true;
  }

  async reveal(round: number) {
    if (this.round !== String(round)) return false;
    this.data.set("revealed", this.round);
    return true;
  }

  async setGif(round: number, gif: string) {
    const field = `gif:${round}`;
    if (this.round !== String(round) || !this.revealed || this.data.has(field)) return false;
    this.data.set(field, gif);
    return true;
  }

  async clear(round: number, activeSince: number) {
    if (this.round !== String(round)) return false;
    this.data.set("round", String(round + 1));
    for (const [field, value] of [...this.data]) {
      if (field.startsWith("v:") || field.startsWith("gif:")) this.data.delete(field);
      else if (field.startsWith("s:") && Number(value) < activeSince) {
        this.data.delete(field);
        this.data.delete(`p:${field.slice(2)}`);
      }
    }
    return true;
  }
}

export function createRedisStore(url: string, token: string): RoomStore {
  return new RedisStore(new Redis({ url, token, automaticDeserialization: false }));
}

export function createMemoryStore(): RoomStore {
  return new MemoryStore();
}

function createStore(): RoomStore {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) return createRedisStore(url, token);
  // Cada instância teria a própria sala: melhor falhar de forma visível do que
  // parecer funcionar e perder votos e participantes ao acaso.
  if (process.env.VERCEL) throw new Error("[scrum-poker] Redis não configurado.");
  return createMemoryStore();
}

const globalForStore = globalThis as unknown as { scrumPokerStore?: RoomStore };

export function getStore(): RoomStore {
  return (globalForStore.scrumPokerStore ??= createStore());
}
