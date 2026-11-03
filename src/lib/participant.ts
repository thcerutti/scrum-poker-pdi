import "server-only";
import { createHash } from "node:crypto";

export const isPid = (pid: unknown): pid is string =>
  typeof pid === "string" && /^[\w-]{1,64}$/.test(pid);

/** O `pid` é o segredo de cada navegador e nunca sai do servidor: a mesa só vê
 *  este id derivado, que não permite agir em nome da pessoa. */
export const publicId = (pid: string) => createHash("sha256").update(pid).digest("hex").slice(0, 16);
