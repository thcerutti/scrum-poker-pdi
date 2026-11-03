import { describe, expect, it } from "vitest";
import { analyzeVotes, isCardValue, type CardValue } from "./deck";

const analyze = (votes: CardValue[], people = votes.length) => analyzeVotes(votes, people);

describe("T24 analyzeVotes", () => {
  it("classifica pela distância entre as cartas", () => {
    expect(analyze(["5", "5"]).level).toBe("consensus");
    expect(analyze(["3", "5"]).level).toBe("minor");
    expect(analyze(["1", "21"]).level).toBe("divergent");
    expect(analyze(["2", "5"]).level).toBe("divergent");
  });

  it("trata voto único, só pausa e nenhum voto", () => {
    expect(analyze(["8"]).level).toBe("single");
    expect(analyze(["coffee", "coffee"]).level).toBe("coffee");
    expect(analyze([], 3).level).toBe("empty");
  });

  it("não conta a pausa na média nem na divergência", () => {
    const result = analyze(["5", "5", "coffee"]);
    expect(result).toMatchObject({ level: "consensus", average: 5, numericCount: 2, coffeeCount: 1 });
  });

  it("conta quem não votou", () => {
    expect(analyze(["5", "5"], 4).missingCount).toBe(2);
  });

  it("calcula média, extremos e mais votado", () => {
    const result = analyze(["2", "2", "5"]);
    expect(result.average).toBe(3);
    expect(result).toMatchObject({ min: "2", max: "5", mostVoted: ["2"] });
  });

  it("não aponta mais votado quando todos empatam, mas aponta empate parcial", () => {
    expect(analyze(["2", "5"]).mostVoted).toEqual([]);
    expect(analyze(["2", "2", "5", "5", "8"]).mostVoted).toEqual(["2", "5"]);
  });

  it("mantém a distribuição na ordem do baralho", () => {
    expect(analyze(["coffee", "8", "1"]).distribution.map((d) => d.value)).toEqual(["1", "8", "coffee"]);
  });
});

describe("isCardValue", () => {
  it("aceita só cartas do baralho", () => {
    expect(isCardValue("13")).toBe(true);
    expect(isCardValue("coffee")).toBe(true);
    expect(isCardValue("4")).toBe(false);
    expect(isCardValue(5)).toBe(false);
    expect(isCardValue(null)).toBe(false);
  });
});
