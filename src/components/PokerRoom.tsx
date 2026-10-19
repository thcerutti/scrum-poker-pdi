"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { keyframes } from "@mui/material/styles";
import LogoutIcon from "@mui/icons-material/Logout";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import StyleIcon from "@mui/icons-material/Style";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { analyzeVotes, CARD_VALUES, type CardValue } from "@/lib/deck";
import { fetchRevealGif } from "@/lib/klipy";
import type { RoomAction, RoomState } from "@/lib/types";
import { SelectableCard } from "./PokerCard";
import { GifCard } from "./GifCard";
import { ResultPanel } from "./ResultPanel";
import { Seat } from "./Seat";

const POLL_INTERVAL_MS = 1500;
const HEARTBEAT_INTERVAL_MS = 15_000;
const API = "/api/room";

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(46, 125, 50, 0.55); }
  70% { box-shadow: 0 0 0 12px rgba(46, 125, 50, 0); }
  100% { box-shadow: 0 0 0 0 rgba(46, 125, 50, 0); }
`;

class ConflictError extends Error {
  constructor(message: string, public state: RoomState) {
    super(message);
  }
}

async function fetchState(url: string): Promise<RoomState> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar a sala.");
  return res.json();
}

async function postAction(payload: RoomAction): Promise<RoomState> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (res.status === 409) throw new ConflictError(json.error, json.state);
  if (!res.ok) throw new Error(json.error ?? "Algo deu errado.");
  return json;
}

interface PokerRoomProps {
  user: { id: string; name: string };
  onLeave: () => void;
}

export function PokerRoom({ user, onLeave }: PokerRoomProps) {
  const { data, error, mutate } = useSWR<RoomState>(`${API}?pid=${user.id}`, fetchState, {
    refreshInterval: POLL_INTERVAL_MS,
    keepPreviousData: true,
  });
  const [confirmClear, setConfirmClear] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const join = useCallback(
    () => postAction({ action: "join", pid: user.id, name: user.name }).then((s) => mutate(s, { revalidate: false })),
    [user.id, user.name, mutate],
  );

  // Presença: entra ao abrir, renova periodicamente e sai ao fechar a aba.
  useEffect(() => {
    join().catch(() => {});
    const interval = setInterval(() => join().catch(() => {}), HEARTBEAT_INTERVAL_MS);
    const onVisible = () => document.visibilityState === "visible" && join().catch(() => {});
    const onPageHide = () =>
      navigator.sendBeacon(API, JSON.stringify({ action: "leave", pid: user.id } satisfies RoomAction));
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [join, user.id]);

  // Se o servidor nos removeu (ex.: aba ficou muito tempo suspensa), volta para a mesa.
  const iAmSeated = data?.participants.some((p) => p.id === user.id) ?? true;
  useEffect(() => {
    if (!iAmSeated) join().catch(() => {});
  }, [iAmSeated, join]);

  const run = useCallback(
    async (payload: RoomAction, optimisticData?: (current: RoomState) => RoomState) => {
      try {
        return await mutate(postAction(payload), {
          optimisticData: optimisticData && ((current) => (current ? optimisticData(current) : current!)),
          rollbackOnError: true,
          revalidate: false,
        });
      } catch (e) {
        if (e instanceof ConflictError) mutate(e.state, { revalidate: false });
        setToast(e instanceof Error ? e.message : "Algo deu errado.");
        return undefined;
      }
    },
    [mutate],
  );

  const analysis = useMemo(
    () =>
      data?.revealed
        ? analyzeVotes(data.participants.flatMap((p) => (p.vote ? [p.vote] : [])))
        : null,
    [data],
  );

  if (!data) {
    return (
      <Box sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
        {error ? <Typography color="error">Não foi possível conectar à sala.</Typography> : <CircularProgress />}
      </Box>
    );
  }

  const { round, revealed, participants, myVote } = data;
  const votedCount = participants.filter((p) => p.voted).length;
  const allVoted = participants.length > 0 && votedCount === participants.length;

  const vote = (value: CardValue) => {
    const next = myVote === value ? null : value;
    run({ action: "vote", pid: user.id, round, value: next }, (current) => ({
      ...current,
      myVote: next,
      participants: current.participants.map((p) => (p.id === user.id ? { ...p, voted: next !== null } : p)),
    }));
  };

  const reveal = async () => {
    const state = await run({ action: "reveal", pid: user.id, round }, (current) => ({ ...current, revealed: true }));
    if (!state?.revealed || state.gif) return;
    // Quem revela busca o GIF (o KLIPY exige a busca no navegador) e o compartilha com a sala.
    const votes = state.participants.flatMap((p) => (p.vote ? [p.vote] : []));
    const gif = await fetchRevealGif(analyzeVotes(votes).level, user.id).catch(() => null);
    if (gif) run({ action: "gif", pid: user.id, round: state.round, gif });
  };

  const clear = () => {
    setConfirmClear(false);
    run({ action: "clear", pid: user.id }, (current) => ({
      ...current,
      round: current.round + 1,
      revealed: false,
      myVote: null,
      gif: null,
      participants: current.participants.map((p) => ({ ...p, voted: false, vote: null })),
    }));
  };

  const leave = () => {
    postAction({ action: "leave", pid: user.id }).catch(() => {});
    onLeave();
  };

  const isOutlier = (v: CardValue | null) =>
    analysis?.level === "divergent" && v !== null && (v === analysis.min || v === analysis.max);

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
      <AppBar position="sticky" elevation={2}>
        <Toolbar>
          <StyleIcon sx={{ mr: 1.5 }} />
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1, fontWeight: 700 }}>
            Scrum Poker
          </Typography>
          <Chip
            avatar={<Avatar>{user.name[0]?.toUpperCase()}</Avatar>}
            label={user.name}
            sx={{ bgcolor: "rgba(255,255,255,0.16)", color: "inherit", mr: 1, maxWidth: { xs: 140, sm: 260 } }}
          />
          <Tooltip title="Sair / trocar nome">
            <IconButton color="inherit" onClick={leave} aria-label="Sair">
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 } }}>
        {/* Seções empilhadas na largura toda: lado a lado, a altura do resultado
            (que cresce com o GIF) deixava um vão embaixo da mesa. */}
        <Stack spacing={3}>
          <Paper sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack direction="row" sx={{ alignItems: "baseline", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
                Mesa
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {votedCount} de {participants.length} votaram
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              color={allVoted ? "success" : "primary"}
              value={participants.length ? (votedCount / participants.length) * 100 : 0}
              sx={{ height: 6, borderRadius: 3, mb: 3 }}
            />

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))",
                gap: { xs: 2, sm: 3 },
                justifyItems: "center",
                mb: 3,
              }}
            >
              {participants.map((p) => (
                <Seat key={p.id} participant={p} revealed={revealed} isMe={p.id === user.id} outlier={isOutlier(p.vote)} />
              ))}
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "center" }}>
              <Button
                variant="contained"
                size="large"
                color={allVoted ? "success" : "primary"}
                startIcon={<VisibilityIcon />}
                onClick={reveal}
                disabled={revealed || votedCount === 0}
                sx={{ minWidth: 220, animation: allVoted && !revealed ? `${pulse} 1.6s infinite` : "none" }}
              >
                {revealed
                  ? "Votos revelados"
                  : allVoted
                    ? "Todos votaram: revelar!"
                    : `Revelar votos (${votedCount}/${participants.length})`}
              </Button>
              <Button
                variant="outlined"
                size="large"
                color="inherit"
                startIcon={<RestartAltIcon />}
                onClick={() => setConfirmClear(true)}
              >
                Limpar votação
              </Button>
            </Stack>
          </Paper>

          {revealed && analysis && (
            <Paper sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mb: 2 }}>
                Resultado
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gap: 3,
                  gridTemplateColumns: { xs: "1fr", md: data.gif ? "minmax(0, 1fr) minmax(0, 1fr)" : "1fr" },
                  alignItems: "center",
                }}
              >
                <ResultPanel analysis={analysis} />
                {data.gif && <GifCard gif={data.gif} />}
              </Box>
            </Paper>
          )}
        </Stack>

        <Paper sx={{ p: { xs: 2, sm: 3 }, mt: 3 }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
            Suas cartas
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
            {revealed
              ? "Votos revelados. Limpe a votação para começar uma nova rodada."
              : myVote
                ? "Voto registrado. Clique na mesma carta para retirar ou em outra para trocar."
                : "Escolha uma carta: quanto mais partes a entrega tiver, mais pontos."}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "repeat(4, 1fr)", md: "repeat(8, 1fr)" },
              gap: { xs: 1.5, sm: 2.5 },
              pt: 2,
              maxWidth: 1000,
              mx: "auto",
            }}
          >
            {CARD_VALUES.map((value) => (
              <SelectableCard
                key={value}
                value={value}
                selected={myVote === value}
                disabled={revealed}
                onSelect={vote}
              />
            ))}
          </Box>
        </Paper>
      </Container>

      <Dialog open={confirmClear} onClose={() => setConfirmClear(false)}>
        <DialogTitle>Limpar votação?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Os votos desta rodada serão apagados para todos os participantes e uma nova rodada começará.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmClear(false)}>Cancelar</Button>
          <Button onClick={clear} variant="contained" color="error" autoFocus>
            Limpar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast !== null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
