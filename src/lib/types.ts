import type { CardValue } from "./deck";

export interface Participant {
  id: string;
  name: string;
  voted: boolean;
  /** Só é preenchido depois que a rodada é revelada. */
  vote: CardValue | null;
}

/** GIF do KLIPY sorteado por quem revelou; todos veem o mesmo. */
export interface RevealGif {
  url: string;
  width: number;
  height: number;
  title: string;
}

export interface RoomState {
  round: number;
  revealed: boolean;
  participants: Participant[];
  /** Id público de quem fez a requisição, para se reconhecer na mesa. */
  selfId: string | null;
  /** Se quem fez a requisição está na mesa. */
  seated: boolean;
  /** Voto de quem fez a requisição na rodada atual (mesmo antes de revelar). */
  myVote: CardValue | null;
  /** Só existe depois de revelada a rodada atual. */
  gif: RevealGif | null;
}

export type RoomAction =
  | { action: "join"; pid: string; name: string }
  | { action: "heartbeat"; pid: string }
  | { action: "away"; pid: string }
  | { action: "leave"; pid: string }
  | { action: "vote"; pid: string; round: number; value: CardValue | null }
  | { action: "reveal"; pid: string; round: number }
  | { action: "gif"; pid: string; round: number; gif: RevealGif }
  | { action: "clear"; pid: string; round: number };
