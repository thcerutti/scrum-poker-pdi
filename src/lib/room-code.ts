/** Sem 0, O, 1 e I, que se confundem ao ditar ou digitar o código. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;

export const normalizeRoomCode = (code: string) => code.trim().toUpperCase();

export const isRoomCode = (code: unknown): code is string =>
  typeof code === "string" && new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`).test(code);

export function generateRoomCode() {
  // 256 é múltiplo do tamanho do alfabeto, então o resto não favorece nenhuma letra.
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}
