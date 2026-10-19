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
      <Box sx={{ aspectRatio: "5 / 7", borderRadius: "9cqw", p: "6cqw", bgcolor: "primary.main" }}>{children}</Box>
    </Box>
  );
}

export function CardFace({ value }: { value: CardValue }) {
  const { Icon, iconColor, label } = CARD_INFO[value];
  const isCoffee = value === COFFEE;

  return (
    <CardFrame>
      <Box
        sx={{
          position: "relative",
          height: "100%",
          borderRadius: "5cqw",
          bgcolor: "#FFFFFF",
          color: "#1A1A1A",
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
          <Icon sx={{ fontSize: "60cqw", color: iconColor }} />
        ) : (
          <Box component="span" sx={{ fontSize: value.length > 1 ? "40cqw" : "50cqw", fontWeight: 400, lineHeight: 1 }}>
            {value}
          </Box>
        )}
        {isCoffee ? (
          <Box
            component="span"
            sx={{ position: "absolute", bottom: "7cqw", fontSize: "11cqw", fontWeight: 500, letterSpacing: "0.04em" }}
          >
            {label}
          </Box>
        ) : (
          <Icon
            aria-label={label}
            sx={{ position: "absolute", bottom: "5cqw", right: "6cqw", fontSize: "24cqw", color: iconColor }}
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
          color: "rgba(255,255,255,0.9)",
          border: "1.5cqw solid rgba(255,255,255,0.85)",
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.18) 0 4cqw, transparent 4cqw 8cqw)",
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
        sx={(theme) => ({
          display: "block",
          width: "100%",
          borderRadius: "10%/7%",
          boxShadow: selected ? theme.shadows[12] : theme.shadows[2],
          transform: selected ? "translateY(-14px) scale(1.04)" : "none",
          outline: selected ? `3px solid ${(theme.vars ?? theme).palette.secondary.main}` : "none",
          outlineOffset: 3,
          transition: theme.transitions.create(["transform", "box-shadow"], {
            duration: theme.transitions.duration.short,
          }),
          "&:hover": { transform: selected ? undefined : "translateY(-6px)", boxShadow: theme.shadows[8] },
          "&.Mui-disabled": { opacity: selected ? 1 : 0.45, filter: selected ? "none" : "grayscale(0.6)" },
          "&.Mui-focusVisible": { outline: `3px solid ${(theme.vars ?? theme).palette.secondary.main}` },
        })}
      >
        <CardFace value={value} />
      </ButtonBase>
      </Box>
    </Tooltip>
  );
}
