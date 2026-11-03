// @ts-expect-error módulo de teste em JS puro
import { startFakeUpstash } from "../../../../test/fake-upstash.mjs";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryStore, createRedisStore, type RoomStore } from "@/lib/store";
import { GET, POST } from "./route";

type Fake = { url: string; close: () => void };

const URL_ = "http://localhost/api/room";
const STALE_MS = 150_000;
const GRACE_MS = 20_000;

const post = async (body: unknown, raw = false) => {
  const res = await POST(new NextRequest(URL_, { method: "POST", body: raw ? (body as string) : JSON.stringify(body) }));
  return { status: res.status, json: res.status === 204 ? null : await res.json() };
};
const get = async (pid?: string) => {
  const res = await GET(new NextRequest(URL_, { headers: pid ? { "x-participant": pid } : {} }));
  return res.json();
};
const join = (pid: string, name = pid) => post({ action: "join", pid, name });
const vote = (pid: string, round: number, value: string | null) => post({ action: "vote", pid, round, value });
const clear = (pid: string, round: number) => post({ action: "clear", pid, round });
const reveal = (pid: string, round: number) => post({ action: "reveal", pid, round });
const gif = (url: string) => ({ url, width: 100, height: 100, title: "t" });

let fake: Fake | undefined;

/** As regras valem igual para o Redis (scripts Lua) e para a memória usada no dev. */
describe.each([
  ["Redis", () => startFakeUpstash().then((f: Fake) => ((fake = f), createRedisStore(f.url, "t")))],
  ["memória", async () => createMemoryStore()],
])("sala com %s", (_label, makeStore: () => Promise<RoomStore>) => {
  const round = 0;
  const id = (name: string) => name;

  // Sala nova a cada teste: alguns adiantam o relógio, o que contaminaria os seguintes.
  beforeEach(async () => {
    vi.useRealTimers();
    (globalThis as { scrumPokerStore?: RoomStore }).scrumPokerStore = await makeStore();
  });

  afterEach(() => fake?.close());

  describe("T02 ciclo completo", () => {
    it("entrar, votar, revelar e limpar refletem na leitura", async () => {
      const [ana, bia] = [id("ana"), id("bia")];
      await join(ana);
      await join(bia);
      await vote(ana, round, "5");

      let state = await get(bia);
      expect(state.participants.map((p: { name: string }) => p.name)).toEqual(expect.arrayContaining([ana, bia]));
      expect(state.participants.find((p: { name: string }) => p.name === ana)).toMatchObject({ voted: true, vote: null });
      expect(state.seated).toBe(true);

      await reveal(ana, round);
      state = await get(bia);
      expect(state.revealed).toBe(true);
      expect(state.participants.find((p: { name: string }) => p.name === ana).vote).toBe("5");

      await clear(ana, round);
      state = await get(ana);
      expect(state).toMatchObject({ round: round + 1, revealed: false, myVote: null, gif: null });
    });
  });

  describe("concorrência da rodada", () => {
    it("T05 Limpar com rodada antiga não apaga os votos da rodada nova", async () => {
      const ana = id("ana");
      await join(ana);
      await clear(ana, round);
      await vote(ana, round + 1, "5");

      const late = await clear(id("carlos"), round);

      expect(late.status).toBe(409);
      expect(late.json.state).toMatchObject({ round: round + 1 });
      expect((await get(ana)).myVote).toBe("5");
    });

    it("T06 vários Limpar simultâneos avançam uma rodada só", async () => {
      const results = await Promise.all(Array.from({ length: 5 }, (_, i) => clear(id(`p${i}`), round)));
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      expect((await get()).round).toBe(round + 1);
    });

    it("T08 Revelar com rodada antiga não desfaz a revelação atual", async () => {
      const ana = id("ana");
      await join(ana);
      await reveal(ana, round);

      await clear(ana, round);
      await reveal(ana, round + 1);

      const stale = await reveal(id("bia"), round);

      expect(stale.status).toBe(409);
      expect((await get()).revealed).toBe(true);
    });

    it("T09 voto depois de revelar ou de limpar é recusado com o estado atual", async () => {
      const ana = id("ana");
      await join(ana);
      await reveal(ana, round);
      expect((await vote(ana, round, "5")).status).toBe(409);

      await clear(ana, round);
      const stale = await vote(ana, round, "5");
      expect(stale.status).toBe(409);
      expect(stale.json.state.round).toBe(round + 1);
    });

    it("T09 voto em corrida com Limpar nunca fica válido na rodada errada", async () => {
      const ana = id("ana");
      await join(ana);
      await Promise.all([vote(ana, round, "5"), clear(ana, round)]);
      expect((await get(ana)).myVote).toBeNull();
    });

    it("T10 revelações simultâneas ficam com um só GIF, o primeiro", async () => {
      const ana = id("ana");
      await join(ana);
      await reveal(ana, round);

      const first = "https://static.klipy.com/1.webp";
      await post({ action: "gif", pid: ana, round, gif: gif(first) });
      await Promise.all(
        ["2", "3", "4"].map((n) =>
          post({ action: "gif", pid: ana, round, gif: gif(`https://static.klipy.com/${n}.webp`) }),
        ),
      );

      expect((await get()).gif.url).toBe(first);
    });

    it("T10 GIF de rodada antiga ou não revelada é ignorado", async () => {
      const ana = id("ana");
      await join(ana);
      await post({ action: "gif", pid: ana, round, gif: gif("https://static.klipy.com/1.webp") });
      await reveal(ana, round);
      expect((await get()).gif).toBeNull();
    });
  });

  describe("presença", () => {
    it("T14/T15 fechar a aba e voltar mantém o voto", async () => {
      const ana = id("ana");
      await join(ana);
      await vote(ana, round, "8");

      await post({ action: "away", pid: ana });
      await join(ana);

      expect(await get(ana)).toMatchObject({ myVote: "8", seated: true });
    });

    it("T15 quem fechou a aba continua na mesa durante a tolerância e sai depois", async () => {
      const ana = id("ana");
      await join(ana);
      await post({ action: "away", pid: ana });
      expect((await get(ana)).seated).toBe(true);

      vi.useFakeTimers({ now: Date.now() + GRACE_MS + 1000, toFake: ["Date"] });
      expect((await get(ana)).seated).toBe(false);
    });

    it("T15 o heartbeat de outra aba desfaz o aviso de saída", async () => {
      const ana = id("ana");
      await join(ana);
      await post({ action: "away", pid: ana });
      await post({ action: "heartbeat", pid: ana });

      vi.useFakeTimers({ now: Date.now() + GRACE_MS + 1000, toFake: ["Date"] });
      expect((await get(ana)).seated).toBe(true);
    });

    it("T16 heartbeat atrasado depois de Sair não recoloca a pessoa", async () => {
      const ana = id("ana");
      await join(ana);
      await post({ action: "leave", pid: ana });

      const late = await post({ action: "heartbeat", pid: ana });

      expect(late.json).toEqual({ seated: false });
      expect((await get(ana)).seated).toBe(false);
    });

    it("T16 Sair apaga o voto", async () => {
      const ana = id("ana");
      await join(ana);
      await vote(ana, round, "5");
      await post({ action: "leave", pid: ana });
      await join(ana);
      expect((await get(ana)).myVote).toBeNull();
    });

    it("T19 quem some mais de 150 s sai da mesa e recupera o voto ao voltar", async () => {
      const ana = id("ana");
      await join(ana);
      await vote(ana, round, "13");

      vi.useFakeTimers({ now: Date.now() + STALE_MS + 1000, toFake: ["Date"] });
      expect((await get(ana)).seated).toBe(false);
      await join(ana);

      expect(await get(ana)).toMatchObject({ seated: true, myVote: "13" });
    });

    it("T23 mesa vazia com rodada revelada começa rodada nova para quem entra", async () => {
      const ana = id("ana");
      await join(ana);
      await reveal(ana, round);
      await post({ action: "leave", pid: ana });

      const state = (await join(id("bia"))).json;

      expect(state).toMatchObject({ round: round + 1, revealed: false });
    });

    it("T23 recarregar sozinho com a rodada revelada não apaga o resultado", async () => {
      const ana = id("ana");
      await join(ana);
      await vote(ana, round, "5");
      await reveal(ana, round);

      await post({ action: "away", pid: ana });
      const state = (await join(ana)).json;

      expect(state).toMatchObject({ round, revealed: true, myVote: "5" });
    });
  });

  describe("segurança", () => {
    it("T30 o id público não revela nem permite ler o voto", async () => {
      const ana = id("ana");
      await join(ana);
      await vote(ana, round, "21");

      const room = await get();
      const seat = room.participants.find((p: { name: string }) => p.name === ana);

      expect(seat.id).not.toBe(ana);
      expect(JSON.stringify(room)).not.toContain(`"id":"${ana}"`);
      expect((await get(seat.id)).myVote).toBeNull();
      expect((await get(ana)).selfId).toBe(seat.id);
    });

    it("T31 o id público não permite agir pela pessoa", async () => {
      const ana = id("ana");
      await join(ana);
      await vote(ana, round, "21");
      const seat = (await get()).participants.find((p: { name: string }) => p.name === ana);

      await post({ action: "leave", pid: seat.id });

      expect(await get(ana)).toMatchObject({ seated: true, myVote: "21" });
    });
  });

  describe("T28 entradas inválidas", () => {
    it.each([
      ["corpo não JSON", "isso não é json", true],
      ["corpo null", "null", true],
      ["corpo numérico", "42", true],
      ["sem pid", { action: "join", name: "x" }, false],
      ["pid inválido", { action: "join", pid: "a b", name: "x" }, false],
      ["ação desconhecida", { action: "x", pid: "a" }, false],
      ["nome vazio", { action: "join", pid: "a", name: "   " }, false],
      ["nome não texto", { action: "join", pid: "a", name: 1 }, false],
      ["carta inválida", { action: "vote", pid: "a", round: 0, value: "4" }, false],
      ["rodada negativa", { action: "vote", pid: "a", round: -1, value: "5" }, false],
      ["rodada fracionária", { action: "reveal", pid: "a", round: 1.5 }, false],
      ["clear sem rodada", { action: "clear", pid: "a" }, false],
      ["GIF de outro domínio", { action: "gif", pid: "a", round: 0, gif: gif("https://evil.com/a.gif") }, false],
    ])("%s responde 400", async (_name, body, raw) => {
      expect((await post(body, raw)).status).toBe(400);
    });

    it("corta nomes longos em 30 caracteres", async () => {
      const pid = id("longo");
      const { json } = await post({ action: "join", pid, name: `${pid}${"x".repeat(60)}` });
      const self = json.participants.find((p: { id: string }) => p.id === json.selfId);
      expect(self.name).toHaveLength(30);
    });
  });
});

describe("T27 Redis indisponível", () => {
  it("responde 503 em JSON com mensagem em português", async () => {
    const server = await startFakeUpstash();
    (globalThis as { scrumPokerStore?: RoomStore }).scrumPokerStore = createRedisStore(server.url, "t");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await fetch(`${server.url}/__down`);

    const res = await GET(new NextRequest(URL_));
    const write = await post({ action: "join", pid: "ana", name: "Ana" });

    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/indisponível/);
    expect(write.status).toBe(503);
    error.mockRestore();
    server.close();
  });
});

describe("T01 produção sem Redis", () => {
  it("falha de forma visível em vez de usar memória", async () => {
    (globalThis as { scrumPokerStore?: RoomStore }).scrumPokerStore = undefined;
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(new NextRequest(URL_));

    expect(res.status).toBe(503);
    error.mockRestore();
    vi.unstubAllEnvs();
  });
});
