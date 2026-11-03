import { expect, test } from "@playwright/test";
import {
  card,
  clearRound,
  enter,
  enterOn,
  leave,
  reveal,
  roomCode,
  seat,
  unique,
  vote,
  votedCount,
  type Person,
} from "./helpers";

/** Quanto a sala tolera uma aba fechada antes de tirar a pessoa da mesa (+ folga). */
const AFTER_HEARTBEAT_MS = 17_000;
/** Votar antes do polling trazer a rodada nova é recusado com aviso (T09). */
const SYNC_MS = 2_500;

let people: Person[] = [];

async function join(browser: Parameters<typeof enter>[0], name: string, code?: string) {
  const person = await enter(browser, unique(name), code);
  people.push(person);
  return person;
}

test.afterEach(async () => {
  await Promise.all(people.map(leave));
  people = [];
});

test("T02/T03/T13 quem está na mesa se vê e o voto chega aos outros em até 3 s", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  const bia = await join(browser, "Bia", ana.code);
  await clearRound(ana.page);

  await expect(seat(ana.page, bia.name)).toBeVisible();
  await expect(seat(bia.page, ana.name)).toBeVisible();

  await vote(ana.page, "5");
  await expect(votedCount(bia.page, 1)).toBeVisible({ timeout: 3_000 });
});

test("T26 fluxo completo: revelar mostra o mesmo resultado e destaca os extremos", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  const bia = await join(browser, "Bia", ana.code);
  await clearRound(ana.page);
  await bia.page.waitForTimeout(SYNC_MS);

  await vote(ana.page, "2");
  await vote(bia.page, "13");
  await reveal(ana.page);

  for (const { page } of [ana, bia]) {
    await expect(page.getByText("Divergência", { exact: true })).toBeVisible();
    await expect(page.getByText("menor", { exact: true })).toBeVisible();
    await expect(page.getByText("maior", { exact: true })).toBeVisible();
  }
});

test("T14 recarregar a página mantém o lugar e o voto", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  const bia = await join(browser, "Bia", ana.code);
  await clearRound(ana.page);
  await vote(ana.page, "8");
  await expect(votedCount(bia.page, 1)).toBeVisible();

  await ana.page.reload();

  await expect(seat(ana.page, ana.name)).toBeVisible();
  await expect(card(ana.page, "8")).toHaveAttribute("aria-pressed", "true");
  await expect(votedCount(bia.page, 1)).toBeVisible();
});

test("T15 fechar uma segunda aba não tira a pessoa da mesa nem apaga o voto", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  await clearRound(ana.page);
  await vote(ana.page, "3");

  const secondTab = await ana.context.newPage();
  await secondTab.goto(`/sala/${ana.code}`);
  await expect(seat(secondTab, ana.name)).toBeVisible();
  await secondTab.close({ runBeforeUnload: true });

  await ana.page.waitForTimeout(AFTER_HEARTBEAT_MS);
  await expect(seat(ana.page, ana.name)).toBeVisible();
  await expect(card(ana.page, "3")).toHaveAttribute("aria-pressed", "true");
});

test("T07 o diálogo de limpar fecha quando a rodada muda em outra aba", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  const secondTab = await ana.context.newPage();
  await secondTab.goto(`/sala/${ana.code}`);

  await secondTab.getByRole("button", { name: "Limpar votação" }).click();
  await expect(secondTab.getByRole("dialog")).toBeVisible();

  await clearRound(ana.page);

  await expect(secondTab.getByRole("dialog")).toBeHidden({ timeout: 5_000 });
});

test("T06 clique duplo em Limpar não apaga o voto dado logo depois", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  await ana.page.getByRole("button", { name: "Limpar votação" }).click();
  await ana.page.getByRole("dialog").getByRole("button", { name: "Limpar" }).dblclick({ force: true });
  await expect(ana.page.getByRole("dialog")).toBeHidden();

  await vote(ana.page, "5");
  await ana.page.waitForTimeout(3_500);
  await expect(card(ana.page, "5")).toHaveAttribute("aria-pressed", "true");
});

test("T16 depois de Sair a pessoa não volta para a mesa", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  const bia = await join(browser, "Bia", ana.code);
  await expect(seat(ana.page, bia.name)).toBeVisible();

  await bia.page.getByRole("button", { name: "Sair" }).click();

  await expect(ana.page.getByText(bia.name, { exact: true })).toHaveCount(0);
  await ana.page.waitForTimeout(AFTER_HEARTBEAT_MS);
  await expect(ana.page.getByText(bia.name, { exact: true })).toHaveCount(0);
});

test("T17 Sair em uma aba também tira a outra aba da mesma pessoa", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  const secondTab = await ana.context.newPage();
  await secondTab.goto(`/sala/${ana.code}`);
  await expect(seat(secondTab, ana.name)).toBeVisible();

  await ana.page.getByRole("button", { name: "Sair" }).click();

  await expect(secondTab.getByRole("button", { name: "Criar sala" })).toBeVisible();
});

test("T23 mesa vazia com rodada revelada não contamina a próxima sessão", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  await clearRound(ana.page);
  await vote(ana.page, "3");
  await reveal(ana.page);
  await ana.page.getByRole("button", { name: "Sair" }).click();
  await ana.page.getByRole("button", { name: "Criar sala" }).waitFor();

  const bia = await join(browser, "Bia", ana.code);
  await expect(bia.page.getByRole("button", { name: "Votos revelados" })).toHaveCount(0);
  await expect(card(bia.page, "5")).toBeEnabled();
});

test("T12 revelar com rede lenta não mostra 'Nenhum voto'", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  await clearRound(ana.page);
  await vote(ana.page, "5");

  await ana.page.evaluate(() => {
    const win = window as unknown as { sawEmpty?: boolean };
    new MutationObserver(() => {
      if (document.body.innerText.includes("Nenhum voto")) win.sawEmpty = true;
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  await ana.page.route("**/api/rooms/**", async (route) => {
    if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 800));
    await route.continue();
  });

  await reveal(ana.page);
  await expect(ana.page.getByText("Só um voto")).toBeVisible();
  expect(await ana.page.evaluate(() => (window as unknown as { sawEmpty?: boolean }).sawEmpty ?? false)).toBe(false);
});

test("T20 sem rede aparece aviso e a sala se recupera sozinha", async ({ browser }) => {
  const ana = await join(browser, "Ana");

  await ana.context.setOffline(true);
  await expect(ana.page.getByText(/sem conexão/i)).toBeVisible({ timeout: 10_000 });

  await ana.context.setOffline(false);
  await expect(ana.page.getByText(/sem conexão/i)).toBeHidden({ timeout: 10_000 });
});

test("T27 servidor com erro mostra mensagem em português e se recupera", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  await clearRound(ana.page);

  await ana.page.route("**/api/rooms/**", (route) => route.fulfill({ status: 500, body: "" }));
  await expect(ana.page.getByText(/sem conexão/i)).toBeVisible({ timeout: 10_000 });

  await card(ana.page, "5").click();
  const toast = ana.page.getByRole("alert").filter({ hasNotText: /sem conexão/i });
  await expect(ana.page.getByText(/JSON|Unexpected/i)).toHaveCount(0);
  await expect(toast.or(ana.page.getByText(/algo deu errado|indisponível/i)).first()).toBeVisible();

  await ana.page.unroute("**/api/rooms/**");
  await expect(ana.page.getByText(/sem conexão/i)).toBeHidden({ timeout: 10_000 });
});

test("T30/T31 o identificador de quem está na mesa não dá acesso à pessoa", async ({ browser, request }) => {
  const ana = await join(browser, "Ana");
  const bia = await join(browser, "Bia", ana.code);
  await clearRound(ana.page);
  await bia.page.waitForTimeout(SYNC_MS);
  await vote(bia.page, "21");

  const api = `/api/rooms/${ana.code}`;
  const room = await (await request.get(api)).json();
  const target = room.participants.find((p: { name: string }) => p.name === bia.name);

  const asBia = await (
    await request.get(api, { headers: { "x-participant": target.id } })
  ).json();
  expect(asBia.myVote).toBeNull();

  await request.post(api, { data: { action: "leave", pid: target.id } });
  await bia.page.waitForTimeout(3_500);
  await expect(seat(ana.page, bia.name)).toBeVisible();
  await expect(votedCount(ana.page, 1)).toBeVisible();
});

test("T32 nome com HTML é exibido como texto", async ({ browser }) => {
  const ana = await join(browser, "<img src=x onerror=a=1>");
  await expect(seat(ana.page, ana.name)).toBeVisible();
  expect(await ana.page.evaluate(() => (window as unknown as { a?: number }).a)).toBeUndefined();
});

test("T36 funciona com localStorage bloqueado", async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("bloqueado");
      },
    });
  });
  const page = await context.newPage();
  const name = unique("Sem storage");
  await enterOn(page, name);
  people.push({ context, page, name, code: roomCode(page) });
});

test("T37 nomes iguais e longos não quebram o layout no celular", async ({ browser }) => {
  const longName = `${"M".repeat(24)} ${Math.random().toString(36).slice(2, 7)}`;
  const context = await browser.newContext({ viewport: { width: 375, height: 700 } });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Seu nome").fill(longName);
  await page.getByRole("button", { name: "Criar sala" }).click();
  await expect(page.getByText("você", { exact: true })).toBeVisible();
  people.push({ context, page, name: longName, code: roomCode(page) });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("T38 dá para votar e revelar só com o teclado", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  await clearRound(ana.page);

  await card(ana.page, "5").focus();
  await ana.page.keyboard.press("Enter");
  await expect(card(ana.page, "5")).toHaveAttribute("aria-pressed", "true");

  await ana.page.getByRole("button", { name: /revelar/i }).focus();
  await ana.page.keyboard.press("Enter");
  await expect(ana.page.getByRole("button", { name: "Votos revelados" })).toBeVisible();
});

test("S01 salas diferentes não se enxergam nem compartilham votos", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  const bia = await join(browser, "Bia");
  expect(ana.code).not.toBe(bia.code);

  await vote(ana.page, "5");
  await reveal(ana.page);
  await bia.page.waitForTimeout(SYNC_MS);

  await expect(seat(bia.page, bia.name)).toBeVisible();
  await expect(bia.page.getByText(ana.name, { exact: true })).toHaveCount(0);
  await expect(votedCount(bia.page, 0, 1)).toBeVisible();
  await expect(bia.page.getByRole("button", { name: "Votos revelados" })).toHaveCount(0);
});

test("S02 quem recebe o link informa o nome e cai direto na sala", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  const bia = await join(browser, "Bia", ana.code);
  await expect(bia.page).toHaveURL(new RegExp(`/sala/${ana.code}$`));
  await expect(seat(ana.page, bia.name)).toBeVisible();
});

test("S03 dá para entrar digitando o código em minúsculas, na tela inicial", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  const context = await browser.newContext();
  const page = await context.newPage();
  const name = unique("Bia");
  people.push({ context, page, name, code: ana.code });

  await page.goto("/");
  await page.getByLabel("Seu nome").fill(name);
  await page.getByLabel("Código da sala").fill(ana.code.toLowerCase());
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`/sala/${ana.code}$`));
  await expect(seat(ana.page, name)).toBeVisible();
});

test("S04 código inexistente mostra erro na tela inicial e não sai dela", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Seu nome").fill("Ana");
  await page.getByLabel("Código da sala").fill("ZZZZZZ");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  await expect(page.getByText(/sala não encontrada/i)).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await context.close();
});

test("S05 link de sala inexistente explica o problema e volta ao início", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/sala/ZZZZZZ");
  await page.getByLabel("Seu nome").fill("Ana");
  await page.getByRole("button", { name: "Entrar na sala" }).click();

  await expect(page.getByRole("heading", { name: "Sala não encontrada" })).toBeVisible();
  await page.getByRole("button", { name: "Voltar ao início" }).click();
  await expect(page.getByRole("button", { name: "Criar sala" })).toBeVisible();
  await context.close();
});

test("S06 o botão copia o link da sala", async ({ browser }) => {
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  const name = unique("Ana");
  await enterOn(page, name);
  people.push({ context, page, name, code: roomCode(page) });

  await page.getByRole("button", { name: /copiar link da sala/i }).click();

  await expect(page.getByText("Link da sala copiado.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
});

test("S07 Sair volta ao início com o nome preenchido e dá para voltar à sala", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  await ana.page.getByRole("button", { name: "Sair" }).click();
  await expect(ana.page.getByLabel("Seu nome")).toHaveValue(ana.name);

  await ana.page.goto(`/sala/${ana.code}`);
  await expect(seat(ana.page, ana.name)).toBeVisible();
});

test("S08 a mesma pessoa pode estar em duas salas, e sair de uma não afeta a outra", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  const other = await join(browser, "Bia");
  const secondTab = await ana.context.newPage();
  await secondTab.goto(`/sala/${other.code}`);
  await expect(seat(secondTab, ana.name)).toBeVisible();

  await ana.page.getByRole("button", { name: "Sair" }).click();

  await secondTab.waitForTimeout(1_000);
  await expect(seat(secondTab, ana.name)).toBeVisible();
});

test("O01 só o admin vê os botões de revelar e limpar", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  const bia = await join(browser, "Bia", ana.code);

  await expect(ana.page.getByRole("button", { name: /revelar/i })).toBeVisible();
  await expect(ana.page.getByRole("button", { name: "Limpar votação" })).toBeVisible();

  await expect(bia.page.getByText(`${ana.name} vai revelar os votos.`)).toBeVisible();
  await expect(bia.page.getByRole("button", { name: /revelar/i })).toHaveCount(0);
  await expect(bia.page.getByRole("button", { name: "Limpar votação" })).toHaveCount(0);
});

test("O02 quem não é admin é recusado mesmo chamando a API direto", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  const bia = await join(browser, "Bia", ana.code);
  await vote(bia.page, "5");

  const statuses = await bia.page.evaluate(async (code) => {
    const { id: pid } = JSON.parse(localStorage.getItem("scrum-poker:user")!);
    const call = (action: string) =>
      fetch(`/api/rooms/${code}`, { method: "POST", body: JSON.stringify({ action, pid, round: 0 }) }).then((r) => r.status);
    return [await call("reveal"), await call("clear")];
  }, ana.code);

  expect(statuses).toEqual([403, 403]);
  await expect(card(bia.page, "5")).toHaveAttribute("aria-pressed", "true");
});

test("O03 o admin mantém o cargo depois de recarregar", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  const bia = await join(browser, "Bia", ana.code);

  await ana.page.reload();
  await expect(ana.page.getByRole("button", { name: "Limpar votação" })).toBeVisible();

  await bia.page.waitForTimeout(SYNC_MS);
  await expect(bia.page.getByRole("button", { name: "Limpar votação" })).toHaveCount(0);
});

test("A01 quando o admin sai, quem entrou logo depois assume e é avisado", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  const bia = await join(browser, "Bia", ana.code);
  const carla = await join(browser, "Carla", ana.code);

  await ana.page.getByRole("button", { name: "Sair" }).click();

  await expect(bia.page.getByRole("button", { name: "Limpar votação" })).toBeVisible();
  await expect(bia.page.getByText("Agora você é admin da sala.")).toBeVisible();
  await expect(carla.page.getByText(`${bia.name} vai revelar os votos.`)).toBeVisible();
  await expect(carla.page.getByRole("button", { name: "Limpar votação" })).toHaveCount(0);

  await vote(carla.page, "8");
  await reveal(bia.page);
  await expect(carla.page.getByText("Só um voto")).toBeVisible();
});

test("A02 o admin que volta entra como participante comum", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  const bia = await join(browser, "Bia", ana.code);
  await ana.page.getByRole("button", { name: "Sair" }).click();
  await expect(bia.page.getByRole("button", { name: "Limpar votação" })).toBeVisible();

  await ana.page.goto(`/sala/${ana.code}`);

  await expect(ana.page.getByText(`${bia.name} vai revelar os votos.`)).toBeVisible();
  await expect(ana.page.getByRole("button", { name: "Limpar votação" })).toHaveCount(0);
});

test("A03 fechar a aba do admin também passa o cargo", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  const bia = await join(browser, "Bia", ana.code);

  await ana.page.close({ runBeforeUnload: true });

  await expect(bia.page.getByRole("button", { name: "Limpar votação" })).toBeVisible({ timeout: 30_000 });
});

test("A04 a mesa mostra quem é o admin", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  const bia = await join(browser, "Bia", ana.code);
  await expect(bia.page.getByText("admin", { exact: true })).toHaveCount(1);
  await expect(ana.page.getByText("admin", { exact: true })).toHaveCount(1);
});

test("O05 quem vota vê que a próxima rodada depende de quem criou a sala", async ({ browser }) => {
  const ana = await join(browser, "Ana");
  const bia = await join(browser, "Bia", ana.code);
  await vote(bia.page, "5");
  await reveal(ana.page);

  await expect(bia.page.getByText(`${ana.name} vai iniciar a próxima rodada.`)).toBeVisible();
  await expect(bia.page.getByText("Votos revelados. Aguarde a próxima rodada.")).toBeVisible();
});
