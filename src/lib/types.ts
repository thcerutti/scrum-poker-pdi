import type { CardValue } from "./deck";

export interface Participant {
  id: string;
  name: string;
  voted: boolean;
  /** Só é preenchido depois que a rodada é revelada. */
  vote: CardValue | null;
}

export interface RoomState {
  round: number;
  revealed: boolean;
  participants: Participant[];
  /** Voto de quem fez a requisição na rodada atual (mesmo antes de revelar). */
  myVote: CardValue | null;
}

export type RoomAction =
  | { action: "join"; pid: string; name: string }
  | { action: "leave"; pid: string }
  | { action: "vote"; pid: string; round: number; value: CardValue | null }
  | { action: "reveal"; pid: string; round: number }
  | { action: "clear"; pid: string };
