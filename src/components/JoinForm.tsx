"use client";
import { useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { POINTS } from "@/lib/deck";
import { isRoomCode, normalizeRoomCode } from "@/lib/room-code";
import { CardFace } from "./PokerCard";

function FormCard({ subtitle, children }: { subtitle: string; children: ReactNode }) {
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
          <Typography sx={{ color: "text.secondary", textAlign: "center", mt: 1, mb: 3 }}>{subtitle}</Typography>
          {children}
        </CardContent>
      </Card>
    </Box>
  );
}

function NameField({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  return (
    <TextField
      label="Seu nome"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoFocus
      fullWidth
      slotProps={{ htmlInput: { maxLength: 30, autoComplete: "name" } }}
    />
  );
}

/** Quem chega pelo link da sala só precisa informar o nome. */
export function NameForm({ room, onJoin }: { room: string; onJoin: (name: string) => void }) {
  const [name, setName] = useState("");
  const trimmed = name.trim();

  return (
    <FormCard subtitle={`Informe seu nome para entrar na sala ${room}.`}>
      <Stack
        component="form"
        spacing={2}
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed) onJoin(trimmed);
        }}
      >
        <NameField value={name} onChange={setName} />
        <Button type="submit" variant="contained" size="large" disabled={!trimmed}>
          Entrar na sala
        </Button>
      </Stack>
    </FormCard>
  );
}

interface HomeFormProps {
  userId: string;
  initialName: string;
  onEnter: (name: string, code: string) => void;
}

export function HomeForm({ userId, initialName, onEnter }: HomeFormProps) {
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const trimmed = name.trim();

  const create = async () => {
    setBusy(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/rooms", { method: "POST", body: JSON.stringify({ pid: userId }) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.code) throw new Error(json?.error);
      onEnter(trimmed, json.code);
    } catch (e) {
      setCreateError((e instanceof Error && e.message) || "Não foi possível criar a sala. Tente de novo.");
      setBusy(false);
    }
  };

  const enter = async () => {
    const normalized = normalizeRoomCode(code);
    if (!isRoomCode(normalized)) return setCodeError("Sala não encontrada. Confira o código.");
    setBusy(true);
    setCodeError(null);
    try {
      const res = await fetch(`/api/rooms/${normalized}`, { cache: "no-store" });
      if (res.ok) return onEnter(trimmed, normalized);
      setCodeError(
        res.status === 404 ? "Sala não encontrada. Confira o código." : "Não foi possível abrir a sala. Tente de novo.",
      );
    } catch {
      setCodeError("Sem conexão. Tente de novo.");
    }
    setBusy(false);
  };

  return (
    <FormCard subtitle="Do skate ao avião: quanto mais partes, mais pontos.">
      <Stack spacing={2}>
        <NameField value={name} onChange={setName} />
        <Button variant="contained" size="large" disabled={!trimmed || busy} onClick={create}>
          Criar sala
        </Button>
        {createError && (
          <Typography role="alert" variant="body2" sx={{ color: "text.secondary", textAlign: "center" }}>
            {createError}
          </Typography>
        )}
        <Divider>ou</Divider>
        <Stack
          component="form"
          direction="row"
          spacing={1}
          sx={{ alignItems: "flex-start" }}
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed && code.trim() && !busy) enter();
          }}
        >
          <TextField
            label="Código da sala"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setCodeError(null);
            }}
            error={codeError !== null}
            helperText={codeError}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 8, autoComplete: "off", style: { textTransform: "uppercase" } } }}
          />
          <Button type="submit" variant="outlined" size="large" disabled={!trimmed || !code.trim() || busy} sx={{ height: 56 }}>
            Entrar
          </Button>
        </Stack>
      </Stack>
    </FormCard>
  );
}
