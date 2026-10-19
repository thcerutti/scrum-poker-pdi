"use client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { Participant } from "@/lib/types";
import { CardBack, CardFace } from "./PokerCard";

interface SeatProps {
  participant: Participant;
  revealed: boolean;
  isMe: boolean;
  /** Votou no extremo (menor ou maior) de uma rodada com divergência. */
  outlier: boolean;
}

export function Seat({ participant, revealed, isMe, outlier }: SeatProps) {
  const { name, voted, vote } = participant;
  const faceUp = revealed && vote !== null;

  return (
    <Box sx={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, minWidth: 0 }}>
      <Box
        sx={(theme) => ({
          width: "100%",
          maxWidth: 88,
          borderRadius: "10%/7%",
          outline: outlier ? `3px solid ${(theme.vars ?? theme).palette.warning.main}` : "none",
          outlineOffset: 3,
        })}
      >
        {voted || faceUp ? (
          <Box sx={{ perspective: "600px" }}>
            <Box
              sx={{
                display: "grid",
                transformStyle: "preserve-3d",
                transition: "transform 600ms cubic-bezier(.2,.7,.3,1)",
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
              border: "2px dashed",
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "text.disabled",
              fontSize: 22,
            }}
          >
            {revealed ? "—" : "?"}
          </Box>
        )}
      </Box>
      <Typography
        variant="body2"
        noWrap
        title={name}
        sx={{ maxWidth: "100%", fontWeight: isMe ? 700 : 400, color: voted ? "text.primary" : "text.secondary" }}
      >
        {name}
      </Typography>
      {isMe && (
        <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 600, mt: -1 }}>
          você
        </Typography>
      )}
    </Box>
  );
}
