"use client";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { COFFEE, type VoteAnalysis } from "@/lib/deck";
import { CARD_INFO } from "./cardInfo";

const LEVEL_COPY = {
  consensus: { severity: "success", title: "Consenso!", text: "Todos votaram no mesmo valor." },
  minor: {
    severity: "warning",
    title: "Pequena divergência",
    text: "Os votos ficaram em cartas vizinhas. Vale uma conversa rápida para alinhar.",
  },
  divergent: {
    severity: "error",
    title: "Divergência",
    text: "Os votos estão distantes. Quem votou mais baixo e mais alto (destacados na mesa) pode explicar o raciocínio.",
  },
  none: { severity: "info", title: "Sem votos numéricos", text: "Ninguém votou em pontos nesta rodada." },
} as const;

const formatAverage = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export function ResultPanel({ analysis }: { analysis: VoteAnalysis }) {
  const copy = LEVEL_COPY[analysis.level];
  const total = analysis.numericCount + analysis.coffeeCount;

  return (
    <Stack spacing={2}>
      <Alert severity={copy.severity} variant="filled">
        <AlertTitle sx={{ fontWeight: 700 }}>{copy.title}</AlertTitle>
        {copy.text}
        {analysis.level !== "consensus" && analysis.min !== null && analysis.level !== "none" && (
          <> Votos de {analysis.min} a {analysis.max} pontos.</>
        )}
      </Alert>

      {analysis.level !== "none" && (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 2 }}>
          <Stat label="Média" value={formatAverage(analysis.average!)} />
          <Stat
            label={analysis.mostVoted.length > 1 ? "Mais votados" : "Mais votado"}
            value={analysis.mostVoted.length > 0 ? analysis.mostVoted.join(" / ") : "Empate"}
          />
        </Box>
      )}

      <Stack spacing={1.25}>
        {analysis.distribution.map(({ value, count }) => {
          const { Icon, iconColor, label } = CARD_INFO[value];
          return (
            <Stack key={value} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Icon sx={{ color: iconColor, fontSize: 22 }} />
              <Typography variant="body2" sx={{ width: 72, fontWeight: 600 }}>
                {value === COFFEE ? label : `${value} pts`}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(count / total) * 100}
                sx={{ flex: 1, height: 8, borderRadius: 4 }}
              />
              <Typography variant="body2" sx={{ width: 64, textAlign: "right", color: "text.secondary" }}>
                {count} {count === 1 ? "voto" : "votos"}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Stack>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "action.hover", textAlign: "center" }}>
      <Typography variant="overline" sx={{ color: "text.secondary", lineHeight: 1.5 }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
    </Box>
  );
}
