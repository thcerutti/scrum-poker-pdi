"use client";
import { createTheme, type Shadows } from "@mui/material/styles";

/**
 * Tema da marca Way2: superfície escura fixa e acento do segmento PDI.
 * A paleta do MUI precisa de hex (ele deriva tons claros e escuros a partir
 * dela), então os valores abaixo espelham os tokens de src/styles/way2. Nos
 * estilos de componente, use sempre as variáveis --w2-*.
 */
const W2 = {
  pagina: "#0A1730", // --w2-sup-escuro-pagina
  cartao: "#203460", // --w2-sup-escuro-elev-2
  borda: "#3A5285", // --w2-borda-escura
  texto: "#FFFFFF", // --w2-branco
  textoSecundario: "#D1D1D1", // --w2-cinza-300
  acento: "#00B856", // --w2-verd-escuro, acento do PDI sobre superfície escura
};

const pill = "var(--w2-raio-pill)";

export const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: "dark",
    primary: { main: W2.acento, contrastText: W2.pagina },
    background: { default: W2.pagina, paper: W2.cartao },
    text: { primary: W2.texto, secondary: W2.textoSecundario },
    divider: W2.borda,
  },
  // No tema escuro da marca a elevação é borda de 1px, nunca sombra.
  shadows: Array(25).fill("none") as Shadows,
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: "var(--font-nunito-sans), Roboto, 'Segoe UI', system-ui, sans-serif",
    fontWeightLight: 300,
    fontWeightRegular: 300,
    fontWeightMedium: 700,
    fontWeightBold: 700,
    h4: { fontWeight: 700, letterSpacing: "-0.01em" },
    h5: { fontWeight: 700, letterSpacing: "-0.01em" },
    h6: { fontWeight: 700, letterSpacing: "-0.01em" },
    body1: { fontWeight: 300 },
    body2: { fontWeight: 300 },
    caption: { fontWeight: 300 },
    overline: { fontWeight: 700, letterSpacing: "0.14em" },
    button: { fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", fontSize: "0.8125rem" },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "var(--w2-superficie-elevada)",
          border: "var(--w2-borda-1) solid var(--w2-borda-elevada)",
          borderRadius: 20,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          // Cabeçalho é faixa de serviço: superfície chapada, separada por divisor.
          backgroundColor: "var(--w2-superficie)",
          border: 0,
          borderBottom: "var(--w2-borda-1) solid var(--w2-borda)",
          borderRadius: 0,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: pill,
          transition: "background-color var(--w2-mov-2) var(--w2-mov-curva), border-color var(--w2-mov-2) var(--w2-mov-curva), opacity var(--w2-mov-2) var(--w2-mov-curva)",
          "&.Mui-focusVisible": {
            outline: "var(--w2-foco-largura) solid var(--w2-foco)",
            outlineOffset: "var(--w2-foco-deslocamento)",
          },
        },
        contained: {
          backgroundColor: "var(--w2-acento)",
          color: "var(--w2-texto-inverso)",
          "&:hover": { backgroundColor: "var(--w2-acento)", opacity: 0.88 },
          "&.Mui-disabled": {
            backgroundColor: "var(--w2-acento)",
            color: "var(--w2-texto-inverso)",
            opacity: 0.4,
          },
        },
        // Contorno sempre no acento; dentro do cartão o texto fica branco.
        outlined: {
          borderColor: "var(--w2-acento)",
          color: "var(--w2-texto)",
          "&:hover": {
            borderColor: "var(--w2-acento)",
            backgroundColor: "color-mix(in srgb, var(--w2-acento) 14%, transparent)",
          },
        },
        text: {
          color: "var(--w2-texto)",
          "&:hover": { backgroundColor: "color-mix(in srgb, var(--w2-acento) 14%, transparent)" },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { "&.Mui-focusVisible": { outline: "var(--w2-foco-largura) solid var(--w2-foco)" } },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: pill,
          backgroundColor: "transparent",
          border: "var(--w2-borda-1) solid var(--w2-acento-tag-borda)",
          color: "var(--w2-texto)",
          fontWeight: 700,
        },
        avatar: {
          backgroundColor: "var(--w2-acento)",
          color: "var(--w2-texto-inverso)",
          fontWeight: 700,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { backgroundColor: "var(--w2-borda)" },
        bar: { backgroundColor: "var(--w2-acento-area-elevada)" },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "var(--w2-superficie-elevada-2)",
          border: "var(--w2-borda-1) solid var(--w2-borda)",
          color: "var(--w2-texto)",
          fontSize: "0.875rem",
          fontWeight: 300,
        },
        arrow: { color: "var(--w2-superficie-elevada-2)" },
      },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: {
          backgroundColor: "var(--w2-superficie-elevada-2)",
          border: "var(--w2-borda-1) solid var(--w2-acento)",
          color: "var(--w2-texto)",
          borderRadius: 8,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: { borderColor: "var(--w2-borda)" },
        root: {
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "var(--w2-acento)" },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "var(--w2-acento)" },
        },
      },
    },
    // Rótulo focado fica branco: texto no tom de acento sobre o cartão é proibido.
    MuiInputLabel: {
      styleOverrides: { root: { "&.Mui-focused": { color: "var(--w2-texto)" } } },
    },
    MuiDialog: {
      styleOverrides: { paper: { backgroundColor: "var(--w2-superficie-elevada)" } },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          "&:not(.MuiBackdrop-invisible)": {
            backgroundColor: "color-mix(in srgb, var(--w2-superficie) 75%, transparent)",
          },
        },
      },
    },
  },
});
