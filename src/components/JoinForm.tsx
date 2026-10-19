"use client";
import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { POINTS } from "@/lib/deck";
import { CardFace } from "./PokerCard";

export function JoinForm({ initialName, onJoin }: { initialName: string; onJoin: (name: string) => void }) {
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();

  return (
    <Box sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", p: 2 }}>
      <Card elevation={6} sx={{ width: "100%", maxWidth: 440 }}>
        <Box sx={{ display: "flex", justifyContent: "center", gap: 0.75, pt: 4, px: 3 }}>
          {POINTS.slice(0, 5).map((value, i) => (
            <Box key={value} sx={{ width: 52, transform: `rotate(${(i - 2) * 6}deg) translateY(${Math.abs(i - 2) * 4}px)` }}>
              <CardFace value={value} />
            </Box>
          ))}
        </Box>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, textAlign: "center" }}>
            Scrum Poker
          </Typography>
          <Typography sx={{ color: "text.secondary", textAlign: "center", mt: 1, mb: 3 }}>
            Do skate ao avião: quanto mais partes, mais pontos.
          </Typography>
          <Stack
            component="form"
            spacing={2}
            onSubmit={(e) => {
              e.preventDefault();
              if (trimmed) onJoin(trimmed);
            }}
          >
            <TextField
              label="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              fullWidth
              slotProps={{ htmlInput: { maxLength: 30, autoComplete: "name" } }}
            />
            <Button type="submit" variant="contained" size="large" disabled={!trimmed}>
              Entrar na mesa
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
