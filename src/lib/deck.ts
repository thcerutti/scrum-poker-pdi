/** Valores numéricos do baralho, na sequência de Fibonacci. */
export const POINTS = ["1", "2", "3", "5", "8", "13", "21"] as const;

/** Carta de pausa: não entra no cálculo de divergência nem na média. */
export const COFFEE = "coffee";

export const CARD_VALUES = [...POINTS, COFFEE] as const;

export type CardValue = (typeof CARD_VALUES)[number];

export function isCardValue(value: unknown): value is CardValue {
  return typeof value === "string" && (CARD_VALUES as readonly string[]).includes(value);
}

export type AgreementLevel = "consensus" | "minor" | "divergent" | "none";

export interface VoteAnalysis {
  level: AgreementLevel;
  /** Quantidade de votos numéricos (sem contar pausa). */
  numericCount: number;
  coffeeCount: number;
  average: number | null;
  min: string | null;
  max: string | null;
  /** Valor(es) mais votado(s). */
  mostVoted: string[];
  /** Contagem por valor, na ordem do baralho. */
  distribution: { value: CardValue; count: number }[];
}

/**
 * Classifica o nível de concordância pela distância entre o menor e o maior voto
 * na sequência do baralho: mesma carta = consenso, cartas vizinhas = pequena
 * divergência, duas ou mais posições de distância = divergência.
 */
export function analyzeVotes(votes: CardValue[]): VoteAnalysis {
  const numeric = votes.filter((v) => v !== COFFEE);
  const coffeeCount = votes.length - numeric.length;

  const distribution = CARD_VALUES.map((value) => ({
    value,
    count: votes.filter((v) => v === value).length,
  })).filter((d) => d.count > 0);

  if (numeric.length === 0) {
    return {
      level: "none",
      numericCount: 0,
      coffeeCount,
      average: null,
      min: null,
      max: null,
      mostVoted: [],
      distribution,
    };
  }

  const indexes = numeric.map((v) => POINTS.indexOf(v as (typeof POINTS)[number]));
  const minIndex = Math.min(...indexes);
  const maxIndex = Math.max(...indexes);
  const spread = maxIndex - minIndex;

  const numericDistribution = distribution.filter((d) => d.value !== COFFEE);
  const topCount = Math.max(...numericDistribution.map((d) => d.count));
  const top = numericDistribution.filter((d) => d.count === topCount).map((d) => d.value);

  return {
    level: spread === 0 ? "consensus" : spread === 1 ? "minor" : "divergent",
    numericCount: numeric.length,
    coffeeCount,
    average: numeric.reduce((sum, v) => sum + Number(v), 0) / numeric.length,
    min: POINTS[minIndex],
    max: POINTS[maxIndex],
    // Se todos os valores empatam, não há "mais votado".
    mostVoted: top.length > 1 && top.length === numericDistribution.length ? [] : top,
    distribution,
  };
}
