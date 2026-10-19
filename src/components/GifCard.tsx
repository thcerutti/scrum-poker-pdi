"use client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { RevealGif } from "@/lib/types";

export function GifCard({ gif }: { gif: RevealGif }) {
  return (
    <Box component="figure" sx={{ m: 0, mt: 2.5 }}>
      <Box
        component="img"
        // A URL é usada exatamente como o KLIPY devolveu, como pedem os termos de uso.
        src={gif.url}
        alt={gif.title}
        width={gif.width}
        height={gif.height}
        loading="eager"
        sx={{
          display: "block",
          width: "100%",
          height: "auto",
          maxHeight: 280,
          objectFit: "contain",
          borderRadius: 2,
          bgcolor: "action.hover",
        }}
      />
      <Typography
        component="figcaption"
        variant="caption"
        sx={{ display: "block", textAlign: "right", color: "text.secondary", mt: 0.5 }}
      >
        Powered by KLIPY
      </Typography>
    </Box>
  );
}
