// Teste de carga (T33): simula pessoas na mesa, com o polling e o heartbeat reais, e
// confere o que importa no uso em grupo. Uso: node test/load.mjs <url> <pessoas> <segundos>
const [base = "http://127.0.0.1:3100", people = "15", seconds = "60"] = process.argv.slice(2);
const API = `${base}/api/room`;
const total = Number(people);
const endAt = Date.now() + Number(seconds) * 1000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const stats = { gets: 0, posts: 0, errors: 0, shrunk: 0, roundBack: 0, notSeated: 0, latencies: [] };
const prefix = Math.random().toString(36).slice(2, 8);

async function timed(run) {
  const start = performance.now();
  try {
    const res = await run();
    stats.latencies.push(performance.now() - start);
    if (!res.ok && res.status !== 409) stats.errors++;
    return res.status === 204 ? null : await res.json();
  } catch {
    stats.errors++;
    return null;
  }
}
const post = (body) => {
  stats.posts++;
  return timed(() => fetch(API, { method: "POST", body: JSON.stringify(body) }));
};
const get = (pid) => {
  stats.gets++;
  return timed(() => fetch(API, { headers: { "x-participant": pid }, cache: "no-store" }));
};

async function person(index) {
  const pid = `carga-${prefix}-${index}`;
  await post({ action: "join", pid, name: `Carga ${index}` });
  let lastRound = 0;
  let nextBeat = Date.now() + 15_000;
  await sleep(3000); // todos sentam antes de começar a medir

  while (Date.now() < endAt) {
    const state = await get(pid);
    if (state) {
      if (state.round < lastRound) stats.roundBack++;
      lastRound = state.round;
      if (!state.seated) stats.notSeated++;
      if (state.participants.length < total) stats.shrunk++;
      if (!state.revealed && !state.myVote && Math.random() < 0.3) {
        await post({ action: "vote", pid, round: state.round, value: "5" });
      }
      if (index === 0 && state.participants.every((p) => p.voted)) {
        await post({ action: "reveal", pid, round: state.round });
        await sleep(3000);
        await post({ action: "clear", pid, round: state.round });
      }
    }
    if (Date.now() > nextBeat) {
      nextBeat += 15_000;
      await post({ action: "heartbeat", pid });
    }
    await sleep(1500);
  }
  await post({ action: "leave", pid });
}

await Promise.all(Array.from({ length: total }, (_, i) => person(i)));
const sorted = stats.latencies.sort((a, b) => a - b);
console.log({
  leituras: stats.gets,
  escritas: stats.posts,
  erros: stats.errors,
  mesaMenorQueOEsperado: stats.shrunk,
  rodadaVoltou: stats.roundBack,
  pessoaFoiTiradaDaMesa: stats.notSeated,
  p50ms: Math.round(sorted[Math.floor(sorted.length / 2)] ?? 0),
  p95ms: Math.round(sorted[Math.floor(sorted.length * 0.95)] ?? 0),
});
