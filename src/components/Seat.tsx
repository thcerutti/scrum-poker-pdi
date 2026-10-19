"use client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { Participant } from "@/lib/types";
import { CardBack, CardFace } from "./PokerCard";

interface SeatProps {
  participant: Participant;
  revealed: boolean;
  isMe: boolean;
  /** Votou no extremo de uma rodada com divergência. */
  extreme: "min" | "max" | null;
}

/** Tag da marca sobre o cartão: contorno no acento, fundo transparente, texto branco. */
const tagSx = {
  px: 1,
  py: 0.25,
  borderRadius: "var(--w2-raio-pill)",
  border: "var(--w2-borda-1) solid var(--w2-acento-tag-borda)",
  color: "var(--w2-acento-tag-texto-elevado)",
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  lineHeight: 1.2,
  whiteSpace: "nowrap",
} as const;

export function Seat({ participant, revealed, isMe, extreme }: SeatProps) {
  const { name, voted, vote } = participant;
  const faceUp = revealed && vote !== null;

  return (
    <Box sx={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, minWidth: 0 }}>
      <Box sx={{ width: "100%", maxWidth: 88 }}>
        {voted || faceUp ? (
          <Box sx={{ perspective: "600px" }}>
            <Box
              sx={{
                display: "grid",
                transformStyle: "preserve-3d",
                transition: "transform var(--w2-mov-3) var(--w2-mov-curva)",
                transform: faceUp ? "rotateY(0deg)" : "rotateY(180deg)",
                "& > *": { gridArea: "1 / 1", backfaceVisibility: "hidden" },
              }}
            >
              <Box>{vote ? <CardFace value={vote} /> : <CardBack />}</Box>
              <Box sx={{ transform: "rotateY(180deg)" }}>
                <CardBack />
              </Box>
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              aspectRatio: "5 / 7",
              borderRadius: "10%/7%",
              border: "var(--w2-borda-2) dashed var(--w2-borda)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              color: "text.secondary",
              fontSize: revealed ? 12 : 22,
              fontWeight: revealed ? 700 : 300,
              textTransform: revealed ? "uppercase" : "none",
              letterSpacing: revealed ? "0.14em" : 0,
              px: 0.5,
            }}
          >
            {revealed ? "sem voto" : "?"}
          </Box>
        )}
      </Box>
      <Typography
        variant="body2"
        noWrap
        title={name}
        sx={{ maxWidth: "100%", fontWeight: isMe ? 700 : 300, color: voted ? "text.primary" : "text.secondary" }}
      >
        {name}
      </Typography>
      {isMe && (
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", mt: -1 }}
        >
          você
        </Typography>
      )}
      {extreme && (
        <Box component="span" sx={tagSx} title={extreme === "min" ? "Menor voto da rodada" : "Maior voto da rodada"}>
          {extreme === "min" ? "menor" : "maior"}
        </Box>
      )}
    </Box>
  );
}
