"use client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { RevealGif } from "@/lib/types";

export function GifCard({ gif }: { gif: RevealGif }) {
  return (
    <Box component="figure" sx={{ m: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Box
        component="img"
        // A URL é usada exatamente como o KLIPY devolveu, como pedem os termos de uso.
        src={gif.url}
        alt={gif.title}
        width={gif.width}
        height={gif.height}
        loading="eager"
        // Tamanho natural limitado pela coluna e pela altura, sem faixas de fundo.
        sx={{ display: "block", width: "auto", height: "auto", maxWidth: "100%", maxHeight: 300, borderRadius: 2 }}
      />
      <Typography component="figcaption" variant="caption" sx={{ color: "text.secondary", mt: 0.75 }}>
        Powered by KLIPY
      </Typography>
    </Box>
  );
}
