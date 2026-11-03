import { expect, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

export const unique = (name: string) => `${name} ${Math.random().toString(36).slice(2, 6)}`;

export interface Person {
  context: BrowserContext;
  page: Page;
  name: string;
  code: string;
}

/** Cada contexto tem seu próprio localStorage: é uma pessoa diferente na mesa. */
export async function enter(browser: Browser, name: string, code?: string): Promise<Person> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await enterOn(page, name, code);
  return { context, page, name, code: roomCode(page) };
}

/** Sem código, cria uma sala; com código, entra pelo link compartilhado. */
export async function enterOn(page: Page, name: string, code?: string) {
  await page.goto(code ? `/sala/${code}` : "/");
  await page.getByLabel("Seu nome").fill(name);
  await page.getByRole("button", { name: code ? "Entrar na sala" : "Criar sala" }).click();
  await expect(seat(page, name)).toBeVisible();
}

export const roomCode = (page: Page) => new URL(page.url()).pathname.split("/").pop()!;

export const seat = (page: Page, name: string): Locator => page.getByText(name, { exact: true }).last();

export const card = (page: Page, value: string): Locator =>
  page.getByRole("button", { name: new RegExp(`^${value} pontos? ·`) });

export const votedCount = (page: Page, voted: number, total?: number): Locator =>
  page.getByText(total === undefined ? new RegExp(`^${voted} de \\d+ votaram$`) : `${voted} de ${total} votaram`);

export async function vote(page: Page, value: string) {
  await card(page, value).click();
  await expect(card(page, value)).toHaveAttribute("aria-pressed", "true");
}

export async function reveal(page: Page) {
  await page.getByRole("button", { name: /revelar/i }).click();
  await expect(page.getByRole("button", { name: "Votos revelados" })).toBeVisible();
}

/** Começa de uma rodada limpa, qualquer que seja o estado deixado antes. */
export async function clearRound(page: Page) {
  await page.getByRole("button", { name: "Limpar votação" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Limpar" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

export async function leave(person: Person) {
  await person.page
    .getByRole("button", { name: "Sair" })
    .click({ timeout: 2_000 })
    .catch(() => {});
  await person.context.close().catch(() => {});
}
