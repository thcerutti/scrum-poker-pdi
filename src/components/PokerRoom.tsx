"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Alert from "@mui/material/Alert";
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
const RETRY_INTERVAL_MS = 3000;
const API = "/api/room";

// Halo no acento do segmento chamando para revelar; não é sombra de elevação.
const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--w2-acento) 55%, transparent); }
  70% { box-shadow: 0 0 0 12px color-mix(in srgb, var(--w2-acento) 0%, transparent); }
  100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--w2-acento) 0%, transparent); }
`;

class ConflictError extends Error {
  constructor(message: string, public state: RoomState) {
    super(message);
  }
}

async function fetchState([url, pid]: readonly [string, string]): Promise<RoomState> {
  const res = await fetch(url, { cache: "no-store", headers: { "x-participant": pid } });
  if (!res.ok) throw new Error("Falha ao carregar a sala.");
  return res.json();
}

async function postAction<T = RoomState>(payload: RoomAction): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Sem conexão com a sala. Tente novamente.");
  }
  const json = await res.json().catch(() => null);
  if (res.status === 409 && json?.state) throw new ConflictError(json.error, json.state);
  if (!res.ok) throw new Error(json?.error ?? "Algo deu errado. Tente novamente.");
  return json;
}

interface PokerRoomProps {
  user: { id: string; name: string };
  onLeave: () => void;
}

export function PokerRoom({ user, onLeave }: PokerRoomProps) {
  const { data, error, mutate } = useSWR<RoomState>([API, user.id] as const, fetchState, {
    refreshInterval: POLL_INTERVAL_MS,
    // Tem que ser menor que o polling; igual ao padrão (2 s), um a cada dois ciclos seria descartado.
    dedupingInterval: POLL_INTERVAL_MS - 500,
    // Sem isso, offline o polling só pararia, sem erro nem aviso na tela.
    refreshWhenOffline: true,
    keepPreviousData: true,
    onErrorRetry: (_error, _key, _config, revalidate, { retryCount }) => {
      setTimeout(() => revalidate({ retryCount }), RETRY_INTERVAL_MS);
    },
  });
  const [confirmClear, setConfirmClear] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const join = useCallback(async () => {
    await postAction({ action: "join", pid: user.id, name: user.name });
    await mutate();
  }, [user.id, user.name, mutate]);

  // Presença: entra ao abrir, renova periodicamente e avisa ao fechar a aba.
  useEffect(() => {
    const enter = () => join().catch(() => {});
    const beat = () =>
      postAction<{ seated: boolean }>({ action: "heartbeat", pid: user.id })
        .then(({ seated }) => (seated ? undefined : join()))
        .catch(() => {});
    const onVisible = () => document.visibilityState === "visible" && enter();
    const onPageShow = (event: PageTransitionEvent) => event.persisted && enter();
    // "away" e não "leave": isto também dispara ao recarregar ou fechar uma aba
    // duplicada, e nesses casos a pessoa continua na mesa com o voto.
    const onPageHide = () =>
      navigator.sendBeacon(API, JSON.stringify({ action: "away", pid: user.id } satisfies RoomAction));

    enter();
    const interval = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [join, user.id]);

  // Se saímos da mesa (ex.: aba ficou muito tempo suspensa), volta sozinho.
  const seated = data?.seated ?? true;
  useEffect(() => {
    if (!seated) join().catch(() => {});
  }, [seated, join]);

  // A rodada mudou com o diálogo aberto: confirmar agora limparia a rodada seguinte.
  const currentRound = data?.round;
  useEffect(() => setConfirmClear(false), [currentRound]);

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
        ? analyzeVotes(
            data.participants.flatMap((p) => (p.vote ? [p.vote] : [])),
            data.participants.length,
          )
        : null,
    [data],
  );

  if (!data) {
    return (
      <Box sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
        {error ? <Typography>Não foi possível conectar à sala.</Typography> : <CircularProgress />}
      </Box>
    );
  }

  const { round, revealed, participants, myVote, selfId } = data;
  const votedCount = participants.filter((p) => p.voted).length;
  const allVoted = participants.length > 0 && votedCount === participants.length;

  const vote = (value: CardValue) => {
    const next = myVote === value ? null : value;
    run({ action: "vote", pid: user.id, round, value: next }, (current) => ({
      ...current,
      myVote: next,
      participants: current.participants.map((p) => (p.id === selfId ? { ...p, voted: next !== null } : p)),
    }));
  };

  const reveal = async () => {
    // Sem atualização otimista: os valores só existem na resposta, e a tela mostraria "Nenhum voto".
    const state = await run({ action: "reveal", pid: user.id, round });
    if (!state?.revealed || state.gif) return;
    // Quem revela busca o GIF (o KLIPY exige a busca no navegador) e o compartilha com a sala.
    const votes = state.participants.flatMap((p) => (p.vote ? [p.vote] : []));
    const { level } = analyzeVotes(votes, state.participants.length);
    const gif = await fetchRevealGif(level, user.id).catch(() => null);
    if (gif) run({ action: "gif", pid: user.id, round: state.round, gif });
  };

  const clear = () => {
    setConfirmClear(false);
    run({ action: "clear", pid: user.id, round }, (current) => ({
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

  const extremeOf = (v: CardValue | null) =>
    analysis?.level !== "divergent" ? null : v === analysis.min ? "min" : v === analysis.max ? "max" : null;

  return (
    <Box sx={{ minHeight: "100dvh" }}>
      <AppBar position="sticky" elevation={2}>
        <Toolbar>
          <StyleIcon sx={{ mr: 1.5 }} />
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1, fontWeight: 700 }}>
            Scrum Poker
          </Typography>
          <Chip
            avatar={<Avatar>{user.name[0]?.toUpperCase()}</Avatar>}
            label={user.name}
            sx={{ mr: 1, maxWidth: { xs: 140, sm: 260 } }}
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
          {error && (
            <Alert severity="warning" variant="outlined">
              Sem conexão com a sala. Tentando reconectar…
            </Alert>
          )}

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
                <Seat key={p.id} participant={p} revealed={revealed} isMe={p.id === selfId} extreme={extremeOf(p.vote)} />
              ))}
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "center" }}>
              <Button
                variant="contained"
                size="large"
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
          {/* desabilitado na animação de saída: um clique duplo não dispara duas vezes */}
          <Button onClick={clear} variant="contained" autoFocus disabled={!confirmClear}>
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
