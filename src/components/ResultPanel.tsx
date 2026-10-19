"use client";
import Alert, { type AlertColor } from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { COFFEE, type VoteAnalysis } from "@/lib/deck";
import { CARD_INFO } from "./cardInfo";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const points = (value: string) => `${value} ${value === "1" ? "ponto" : "pontos"}`;

function describe(a: VoteAnalysis): { severity: AlertColor; title: string; text: string } {
  // "Todos" só é verdade se ninguém ficou sem votar nem escolheu a pausa.
  const partial = a.missingCount > 0 || a.coffeeCount > 0;
  switch (a.level) {
    case "consensus":
      return partial
        ? {
            severity: "success",
            title: "Consenso entre quem votou",
            text: `Os ${a.numericCount} votos em pontos foram em ${points(a.min!)}.`,
          }
        : { severity: "success", title: "Consenso!", text: `Todos votaram em ${points(a.min!)}.` };
    case "minor":
      return {
        severity: "warning",
        title: "Pequena divergência",
        text: `Os votos ficaram em cartas vizinhas (${a.min} e ${a.max}). Vale uma conversa rápida para alinhar.`,
      };
    case "divergent":
      return {
        severity: "error",
        title: "Divergência",
        text: `Os votos vão de ${a.min} a ${a.max} pontos. Quem votou mais baixo e mais alto (destacados na mesa) pode explicar o raciocínio.`,
      };
    case "single":
      return {
        severity: "info",
        title: "Só um voto",
        text: `Com um único voto (${points(a.min!)}) não dá para medir a concordância.`,
      };
    case "coffee":
      return { severity: "info", title: "Pausa para o café", text: "Quem votou pediu uma pausa." };
    case "empty":
      return { severity: "info", title: "Nenhum voto", text: "A rodada foi revelada sem votos." };
  }
}

const formatAverage = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export function ResultPanel({ analysis }: { analysis: VoteAnalysis }) {
  const copy = describe(analysis);
  const total = analysis.numericCount + analysis.coffeeCount;

  // Ressalvas que valem para qualquer resultado: quem ficou de fora e quem pediu pausa.
  const notes = [
    analysis.missingCount > 0 &&
      plural(analysis.missingCount, "pessoa não votou", "pessoas não votaram"),
    analysis.coffeeCount > 0 &&
      analysis.level !== "coffee" &&
      plural(analysis.coffeeCount, "pessoa pediu pausa", "pessoas pediram pausa"),
  ].filter(Boolean);

  return (
    <Stack spacing={2}>
      <Alert severity={copy.severity} variant="filled">
        <AlertTitle sx={{ fontWeight: 700 }}>{copy.title}</AlertTitle>
        {copy.text}
        {notes.length > 0 && <Box sx={{ mt: 0.5, opacity: 0.9 }}>{notes.join(" · ")}.</Box>}
      </Alert>

      {analysis.numericCount > 1 && (
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
