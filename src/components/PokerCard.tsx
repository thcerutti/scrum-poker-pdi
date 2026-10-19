"use client";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Tooltip from "@mui/material/Tooltip";
import StyleIcon from "@mui/icons-material/Style";
import { COFFEE, type CardValue } from "@/lib/deck";
import { CARD_INFO } from "./cardInfo";

/** Moldura com proporção de carta de baralho. Os tamanhos internos usam `cqw`,
 *  então a mesma carta serve para a mão (grande) e para a mesa (pequena). O
 *  container fica no wrapper porque `cqw` nunca resolve contra o próprio elemento. */
function CardFrame({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ width: "100%", containerType: "inline-size" }}>
      <Box sx={{ aspectRatio: "5 / 7", borderRadius: "9cqw", p: "6cqw", bgcolor: "var(--w2-acento-area-elevada)" }}>
        {children}
      </Box>
    </Box>
  );
}

export function CardFace({ value }: { value: CardValue }) {
  const { Icon, label } = CARD_INFO[value];
  const isCoffee = value === COFFEE;

  return (
    <CardFrame>
      <Box
        className="w2-face-clara"
        sx={{
          position: "relative",
          height: "100%",
          borderRadius: "5cqw",
          bgcolor: "var(--w2-superficie)",
          color: "var(--w2-texto)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {!isCoffee && (
          <Box
            component="span"
            sx={{ position: "absolute", top: "5cqw", left: "8cqw", fontSize: "14cqw", fontWeight: 700, lineHeight: 1 }}
          >
            {value}
          </Box>
        )}
        {isCoffee ? (
          <Icon sx={{ fontSize: "60cqw", color: "var(--w2-acento)" }} />
        ) : (
          <Box component="span" sx={{ fontSize: value.length > 1 ? "40cqw" : "50cqw", fontWeight: 300, lineHeight: 1 }}>
            {value}
          </Box>
        )}
        {isCoffee ? (
          <Box
            component="span"
            sx={{
              position: "absolute",
              bottom: "7cqw",
              fontSize: "10cqw",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            {label}
          </Box>
        ) : (
          <Icon
            aria-label={label}
            sx={{ position: "absolute", bottom: "5cqw", right: "6cqw", fontSize: "24cqw", color: "var(--w2-acento)" }}
          />
        )}
      </Box>
    </CardFrame>
  );
}

export function CardBack() {
  return (
    <CardFrame>
      <Box
        sx={{
          height: "100%",
          borderRadius: "5cqw",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Sobre o preenchimento no acento, o detalhe vai no navy, como no CTA da marca.
          color: "var(--w2-texto-inverso)",
          border: "1.5cqw solid color-mix(in srgb, var(--w2-texto-inverso) 70%, transparent)",
          backgroundImage:
            "repeating-linear-gradient(45deg, color-mix(in srgb, var(--w2-texto-inverso) 14%, transparent) 0 4cqw, transparent 4cqw 8cqw)",
        }}
      >
        <StyleIcon sx={{ fontSize: "40cqw" }} />
      </Box>
    </CardFrame>
  );
}

interface SelectableCardProps {
  value: CardValue;
  selected: boolean;
  disabled: boolean;
  onSelect: (value: CardValue) => void;
}

export function SelectableCard({ value, selected, disabled, onSelect }: SelectableCardProps) {
  const { label, hint } = CARD_INFO[value];
  const title = value === COFFEE ? `${label}: ${hint}` : `${value} ${value === "1" ? "ponto" : "pontos"} · ${label}: ${hint}`;

  return (
    <Tooltip title={title} arrow placement="top" describeChild>
      {/* span: o Tooltip não recebe eventos de um botão desabilitado */}
      <Box component="span" sx={{ display: "block" }}>
      <ButtonBase
        onClick={() => onSelect(value)}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={title}
        sx={{
          display: "block",
          width: "100%",
          borderRadius: "10%/7%",
          // No tema escuro da marca não há sombra: a seleção é deslocamento mais contorno no acento.
          transform: selected ? "translateY(-14px) scale(1.04)" : "none",
          outline: selected ? "var(--w2-borda-2) solid var(--w2-acento)" : "none",
          outlineOffset: 4,
          transition: "transform var(--w2-mov-2) var(--w2-mov-curva), opacity var(--w2-mov-2) var(--w2-mov-curva)",
          "&:hover": { transform: selected ? undefined : "translateY(-6px)" },
          "&.Mui-disabled": { opacity: selected ? 1 : 0.4 },
          "&.Mui-focusVisible": { outline: "var(--w2-foco-largura) solid var(--w2-foco)" },
        }}
      >
        <CardFace value={value} />
      </ButtonBase>
      </Box>
    </Tooltip>
  );
}
