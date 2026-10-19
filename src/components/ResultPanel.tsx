"use client";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import LocalCafeOutlinedIcon from "@mui/icons-material/LocalCafeOutlined";
import LooksOneIcon from "@mui/icons-material/LooksOne";
import type { SvgIconComponent } from "@mui/icons-material";
import { COFFEE, type AgreementLevel, type VoteAnalysis } from "@/lib/deck";
import { CARD_INFO } from "./cardInfo";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const points = (value: string) => `${value} ${value === "1" ? "ponto" : "pontos"}`;

/** A marca não tem cores de sucesso, alerta e erro: o nível se distingue pelo
 *  ícone e pelo título, sempre no acento do segmento. */
const LEVEL_ICON: Record<AgreementLevel, SvgIconComponent> = {
  consensus: HandshakeOutlinedIcon,
  minor: CompareArrowsIcon,
  divergent: CallSplitIcon,
  single: LooksOneIcon,
  coffee: LocalCafeOutlinedIcon,
  empty: HourglassEmptyIcon,
};

function describe(a: VoteAnalysis): { title: string; text: string } {
  // "Todos" só é verdade se ninguém ficou sem votar nem escolheu a pausa.
  const partial = a.missingCount > 0 || a.coffeeCount > 0;
  switch (a.level) {
    case "consensus":
      return partial
        ? {
            title: "Consenso entre quem votou",
            text: `Os ${a.numericCount} votos em pontos foram em ${points(a.min!)}.`,
          }
        : { title: "Consenso!", text: `Todos votaram em ${points(a.min!)}.` };
    case "minor":
      return {
        title: "Pequena divergência",
        text: `Os votos ficaram em cartas vizinhas (${a.min} e ${a.max}). Vale uma conversa rápida para alinhar.`,
      };
    case "divergent":
      return {
        title: "Divergência",
        text: `Os votos vão de ${a.min} a ${a.max} pontos. Quem votou mais baixo e mais alto (destacados na mesa) pode explicar o raciocínio.`,
      };
    case "single":
      return {
        title: "Só um voto",
        text: `Com um único voto (${points(a.min!)}) não dá para medir a concordância.`,
      };
    case "coffee":
      return { title: "Pausa para o café", text: "Quem votou pediu uma pausa." };
    case "empty":
      return { title: "Nenhum voto", text: "A rodada foi revelada sem votos." };
  }
}

const formatAverage = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export function ResultPanel({ analysis }: { analysis: VoteAnalysis }) {
  const copy = describe(analysis);
  const LevelIcon = LEVEL_ICON[analysis.level];
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
      <Box
        role="status"
        sx={{
          display: "flex",
          gap: 1.5,
          p: 2,
          borderRadius: "12px",
          border: "var(--w2-borda-1) solid var(--w2-acento)",
        }}
      >
        <LevelIcon sx={{ color: "var(--w2-acento)", fontSize: 28, flexShrink: 0 }} />
        <Box>
          <Typography variant="h6" component="p" sx={{ lineHeight: 1.25 }}>
            {copy.title}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {copy.text}
          </Typography>
          {notes.length > 0 && (
            <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
              {notes.join(" · ")}.
            </Typography>
          )}
        </Box>
      </Box>

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
          const { Icon, label } = CARD_INFO[value];
          return (
            <Stack key={value} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Icon sx={{ color: "var(--w2-acento)", fontSize: 22 }} />
              <Typography variant="body2" sx={{ width: 72, fontWeight: 700 }}>
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
    <Box
      sx={{
        p: 1.5,
        borderRadius: "12px",
        bgcolor: "var(--w2-superficie-elevada-2)",
        border: "var(--w2-borda-1) solid var(--w2-borda)",
        textAlign: "center",
      }}
    >
      <Typography variant="overline" sx={{ color: "text.secondary", lineHeight: 1.5 }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
    </Box>
  );
}
