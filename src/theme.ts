"use client";
import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  cssVariables: true,
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#D32F2F" },
        secondary: { main: "#3949AB" },
        background: { default: "#F4F5F7", paper: "#FFFFFF" },
      },
    },
    dark: {
      palette: {
        primary: { main: "#EF5350" },
        secondary: { main: "#7986CB" },
        background: { default: "#121316", paper: "#1C1D21" },
      },
    },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "var(--font-roboto), Roboto, Helvetica, Arial, sans-serif",
    button: { textTransform: "none", fontWeight: 600 },
  },
});
