import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Cada sala mora em um único hash, para que cada leitura custe um comando:
 *   createdAt     -> quando a sala foi criada; sem este campo, a sala não existe
 *   admin         -> id público de quem pode revelar e limpar (no início, quem criou)
 *   seq           -> contador da ordem de entrada na sala
 *   round         -> número da rodada atual
 *   revealed      -> número da rodada que foi revelada (revelada se == round)
 *   p:{id}        -> nome do participante
 *   s:{id}        -> último sinal de vida (epoch em ms)
 *   j:{id}        -> ordem de entrada; quem volta depois de sair da mesa recebe outra
 *   v:{id}        -> "{round}:{valor}" (votos de rodadas antigas são ignorados)
 *   gif:{round}   -> JSON do GIF da rodada
 *
 * Toda regra que depende do estado atual precisa ser atômica: com vários clientes
 * em várias instâncias, ler e depois escrever perde corridas. Por isso as escritas
 * condicionais são scripts Lua, e `getAll` nunca escreve. Nenhum deles recria
 * uma sala que expirou: quem ainda estiver nela recebe RoomNotFoundError.
 */
export class RoomNotFoundError extends Error {}

/** Revelar e limpar são exclusivos do admin da sala. */
export class NotRoomAdminError extends Error {}

export interface RoomStore {
  getAll(): Promise<Record<string, string>>;
  /** Senta na mesa. Se ela estava vazia com a rodada revelada, começa uma rodada nova. */
  join(id: string, name: string, now: number, activeSince: number): Promise<void>;
  /** Atualiza o sinal de vida de quem está na mesa; `false` se a pessoa já saiu e precisa entrar de novo. */
  touch(id: string, lastSeen: number, activeSince: number): Promise<boolean>;
  leave(id: string, activeSince: number): Promise<void>;
  /** `value` nulo retira o voto. `false` se a rodada mudou ou já foi revelada. */
  vote(id: string, round: number, value: string | null): Promise<boolean>;
  /** `false` se `round` não é a rodada atual. */
  reveal(id: string, round: number, activeSince: number): Promise<boolean>;
  /** Fica o primeiro GIF de uma rodada revelada; `false` nos demais casos. */
  setGif(round: number, gif: string): Promise<boolean>;
  /** Inicia a rodada seguinte, se `round` ainda é a atual; recolhe quem sumiu da mesa. */
  clear(id: string, round: number, activeSince: number): Promise<boolean>;
}

export interface RoomDirectory {
  /** `false` se o código já está em uso. */
  create(code: string, admin: string, now: number): Promise<boolean>;
  room(code: string): RoomStore;
}

/** A sala some sozinha depois de um dia sem uso. */
const ROOM_TTL_SECONDS = 60 * 60 * 24;
const ROOM_MISSING = -1;
const NOT_ADMIN = -2;

/**
 * Com o admin fora da mesa, o cargo passa para quem entrou primeiro entre os presentes
 * e não volta quando ele retorna. Se não há ninguém presente, nada muda. Precisa dar o
 * mesmo resultado que `currentAdmin`, usada para mostrar o admin sem escrever na leitura.
 */
const PROMOTE = `local function promote(activeSince)
  local admin = redis.call('HGET', KEYS[1], 'admin')
  local seen = admin and redis.call('HGET', KEYS[1], 's:' .. admin)
  if seen and tonumber(seen) >= activeSince then return end
  local fields = redis.call('HGETALL', KEYS[1])
  local values = {}
  for i = 1, #fields, 2 do values[fields[i]] = fields[i + 1] end
  local nextAdmin, firstEntry
  for field, entry in pairs(values) do
    if string.sub(field, 1, 2) == 'j:' then
      local id = string.sub(field, 3)
      local order = tonumber(entry)
      if tonumber(values['s:' .. id] or '0') >= activeSince and (not firstEntry or order < firstEntry) then
        nextAdmin, firstEntry = id, order
      end
    end
  end
  if nextAdmin then redis.call('HSET', KEYS[1], 'admin', nextAdmin) end
end`;

const REQUIRE_ROOM = `if redis.call('HEXISTS', KEYS[1], 'createdAt') == 0 then return ${ROOM_MISSING} end`;
const CURRENT_ROUND = `${REQUIRE_ROOM}
local round = redis.call('HGET', KEYS[1], 'round') or '0'`;
const KEEP_ALIVE = `redis.call('EXPIRE', KEYS[1], ${ROOM_TTL_SECONDS})`;

const SCRIPTS = {
  create: `if redis.call('HSETNX', KEYS[1], 'createdAt', ARGV[1]) == 0 then return 0 end
redis.call('HSET', KEYS[1], 'admin', ARGV[2])
${KEEP_ALIVE}
return 1`,

  join: `${PROMOTE}
${CURRENT_ROUND}
promote(tonumber(ARGV[4]))
local fields = redis.call('HGETALL', KEYS[1])
local occupied = false
for i = 1, #fields, 2 do
  if string.sub(fields[i], 1, 2) == 's:' and tonumber(fields[i + 1]) >= tonumber(ARGV[4]) then occupied = true end
end
if not occupied and redis.call('HGET', KEYS[1], 'revealed') == round then
  redis.call('HINCRBY', KEYS[1], 'round', 1)
end
local seen = redis.call('HGET', KEYS[1], 's:' .. ARGV[1])
redis.call('HSET', KEYS[1], 'p:' .. ARGV[1], ARGV[2], 's:' .. ARGV[1], ARGV[3])
if not seen or tonumber(seen) < tonumber(ARGV[4]) then
  redis.call('HSET', KEYS[1], 'j:' .. ARGV[1], redis.call('HINCRBY', KEYS[1], 'seq', 1))
end
promote(tonumber(ARGV[4]))
${KEEP_ALIVE}
return 1`,

  touch: `${PROMOTE}
${REQUIRE_ROOM}
local seen = redis.call('HGET', KEYS[1], 's:' .. ARGV[1])
if not seen or tonumber(seen) < tonumber(ARGV[3]) then return 0 end
redis.call('HSET', KEYS[1], 's:' .. ARGV[1], ARGV[2])
promote(tonumber(ARGV[3]))
${KEEP_ALIVE}
return 1`,

  leave: `${PROMOTE}
${REQUIRE_ROOM}
local id = ARGV[1]
redis.call('HDEL', KEYS[1], 'p:' .. id, 's:' .. id, 'v:' .. id, 'j:' .. id)
promote(tonumber(ARGV[2]))
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

  reveal: `${PROMOTE}
${CURRENT_ROUND}
promote(tonumber(ARGV[3]))
if redis.call('HGET', KEYS[1], 'admin') ~= ARGV[2] then return ${NOT_ADMIN} end
if round ~= ARGV[1] then return 0 end
redis.call('HSET', KEYS[1], 'revealed', round)
${KEEP_ALIVE}
return 1`,

  setGif: `${CURRENT_ROUND}
if round ~= ARGV[1] or redis.call('HGET', KEYS[1], 'revealed') ~= round then return 0 end
return redis.call('HSETNX', KEYS[1], 'gif:' .. round, ARGV[2])`,

  clear: `${PROMOTE}
${CURRENT_ROUND}
promote(tonumber(ARGV[2]))
if redis.call('HGET', KEYS[1], 'admin') ~= ARGV[3] then return ${NOT_ADMIN} end
if round ~= ARGV[1] then return 0 end
redis.call('HINCRBY', KEYS[1], 'round', 1)
local fields = redis.call('HGETALL', KEYS[1])
for i = 1, #fields, 2 do
  local field = fields[i]
  if string.sub(field, 1, 2) == 'v:' or string.sub(field, 1, 4) == 'gif:' then
    redis.call('HDEL', KEYS[1], field)
  elseif string.sub(field, 1, 2) == 's:' and tonumber(fields[i + 1]) < tonumber(ARGV[2]) then
    redis.call('HDEL', KEYS[1], field, 'p:' .. string.sub(field, 3), 'j:' .. string.sub(field, 3))
  end
end
${KEEP_ALIVE}
return 1`,
} as const;

async function runScript(redis: Redis, key: string, script: keyof typeof SCRIPTS, args: string[]) {
  const result = await redis.eval(SCRIPTS[script], [key], args);
  if (result === ROOM_MISSING) throw new RoomNotFoundError();
  if (result === NOT_ADMIN) throw new NotRoomAdminError();
  return result === 1;
}

const roomKey = (code: string) => `scrum-poker:room:${code}`;

class RedisRoom implements RoomStore {
  constructor(
    private redis: Redis,
    private key: string,
  ) {}

  private run(script: keyof typeof SCRIPTS, ...args: string[]) {
    return runScript(this.redis, this.key, script, args);
  }

  async getAll() {
    // Com automaticDeserialization: false, o hgetall devolve a lista crua
    // [campo, valor, campo, valor...] em vez de um objeto.
    const flat = (await this.redis.hgetall(this.key)) as unknown as string[] | null;
    const fields: Record<string, string> = {};
    for (let i = 0; flat && i < flat.length; i += 2) fields[flat[i]] = flat[i + 1];
    return fields;
  }

  async join(id: string, name: string, now: number, activeSince: number) {
    await this.run("join", id, name, String(now), String(activeSince));
  }

  touch(id: string, lastSeen: number, activeSince: number) {
    return this.run("touch", id, String(lastSeen), String(activeSince));
  }

  async leave(id: string, activeSince: number) {
    await this.run("leave", id, String(activeSince));
  }

  vote(id: string, round: number, value: string | null) {
    return this.run("vote", id, String(round), value ?? "");
  }

  reveal(id: string, round: number, activeSince: number) {
    return this.run("reveal", String(round), id, String(activeSince));
  }

  setGif(round: number, gif: string) {
    return this.run("setGif", String(round), gif);
  }

  clear(id: string, round: number, activeSince: number) {
    return this.run("clear", String(round), String(activeSince), id);
  }
}

class RedisDirectory implements RoomDirectory {
  constructor(private redis: Redis) {}

  create(code: string, admin: string, now: number) {
    return runScript(this.redis, roomKey(code), "create", [String(now), admin]);
  }

  room(code: string) {
    return new RedisRoom(this.redis, roomKey(code));
  }
}

class MemoryRoom implements RoomStore {
  data = new Map<string, string>();

  private requireRoom() {
    if (!this.data.has("createdAt")) throw new RoomNotFoundError();
  }

  private requireAdmin(id: string, activeSince: number) {
    this.requireRoom();
    this.promote(activeSince);
    if (this.data.get("admin") !== id) throw new NotRoomAdminError();
  }

  private promote(activeSince: number) {
    const admin = currentAdmin(Object.fromEntries(this.data), activeSince);
    if (admin) this.data.set("admin", admin);
  }

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
    this.requireRoom();
    this.promote(activeSince);
    const occupied = [...this.data].some(([k, v]) => k.startsWith("s:") && Number(v) >= activeSince);
    if (!occupied && this.revealed) this.data.set("round", String(Number(this.round) + 1));
    const wasPresent = Number(this.data.get(`s:${id}`) ?? 0) >= activeSince;
    this.data.set(`p:${id}`, name);
    this.data.set(`s:${id}`, String(now));
    if (!wasPresent) {
      const entry = String(Number(this.data.get("seq") ?? 0) + 1);
      this.data.set("seq", entry);
      this.data.set(`j:${id}`, entry);
    }
    this.promote(activeSince);
  }

  async touch(id: string, lastSeen: number, activeSince: number) {
    this.requireRoom();
    if (Number(this.data.get(`s:${id}`) ?? 0) < activeSince) return false;
    this.data.set(`s:${id}`, String(lastSeen));
    this.promote(activeSince);
    return true;
  }

  async leave(id: string, activeSince: number) {
    this.requireRoom();
    for (const prefix of ["p", "s", "v", "j"]) this.data.delete(`${prefix}:${id}`);
    this.promote(activeSince);
  }

  async vote(id: string, round: number, value: string | null) {
    this.requireRoom();
    if (this.round !== String(round) || this.revealed) return false;
    if (value === null) this.data.delete(`v:${id}`);
    else this.data.set(`v:${id}`, `${round}:${value}`);
    return true;
  }

  async reveal(id: string, round: number, activeSince: number) {
    this.requireAdmin(id, activeSince);
    if (this.round !== String(round)) return false;
    this.data.set("revealed", this.round);
    return true;
  }

  async setGif(round: number, gif: string) {
    this.requireRoom();
    const field = `gif:${round}`;
    if (this.round !== String(round) || !this.revealed || this.data.has(field)) return false;
    this.data.set(field, gif);
    return true;
  }

  async clear(id: string, round: number, activeSince: number) {
    this.requireAdmin(id, activeSince);
    if (this.round !== String(round)) return false;
    this.data.set("round", String(round + 1));
    for (const [field, value] of [...this.data]) {
      if (field.startsWith("v:") || field.startsWith("gif:")) this.data.delete(field);
      else if (field.startsWith("s:") && Number(value) < activeSince) {
        this.data.delete(field);
        this.data.delete(`p:${field.slice(2)}`);
        this.data.delete(`j:${field.slice(2)}`);
      }
    }
    return true;
  }
}

/** Só funciona com um único processo (next dev). Na Vercel é obrigatório usar Redis. */
class MemoryDirectory implements RoomDirectory {
  private rooms = new Map<string, MemoryRoom>();

  async create(code: string, admin: string, now: number) {
    const room = this.room(code);
    if (room.data.has("createdAt")) return false;
    room.data.set("createdAt", String(now));
    room.data.set("admin", admin);
    return true;
  }

  room(code: string) {
    const room = this.rooms.get(code) ?? new MemoryRoom();
    this.rooms.set(code, room);
    return room;
  }
}

/** Admin em vigor: o registrado, se presente, senão quem entrou primeiro entre os presentes. */
export function currentAdmin(fields: Record<string, string>, activeSince: number): string | null {
  const isPresent = (id: string) => Number(fields[`s:${id}`] ?? 0) >= activeSince;
  const { admin } = fields;
  if (admin && isPresent(admin)) return admin;

  const present = Object.keys(fields)
    .filter((key) => key.startsWith("j:") && isPresent(key.slice(2)))
    .sort((a, b) => Number(fields[a]) - Number(fields[b]));
  return present[0]?.slice(2) ?? admin ?? null;
}

export function createRedisStore(url: string, token: string): RoomDirectory {
  return new RedisDirectory(new Redis({ url, token, automaticDeserialization: false }));
}

export function createMemoryStore(): RoomDirectory {
  return new MemoryDirectory();
}

function createStore(): RoomDirectory {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) return createRedisStore(url, token);
  // Cada instância teria a própria sala: melhor falhar de forma visível do que
  // parecer funcionar e perder votos e participantes ao acaso.
  if (process.env.VERCEL) throw new Error("[scrum-poker] Redis não configurado.");
  return createMemoryStore();
}

const globalForStore = globalThis as unknown as { scrumPokerStore?: RoomDirectory };

export function getStore(): RoomDirectory {
  return (globalForStore.scrumPokerStore ??= createStore());
}
