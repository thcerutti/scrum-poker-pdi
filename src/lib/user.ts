const USER_KEY = "scrum-poker:user";
const LEFT_KEY = "scrum-poker:left";

export interface StoredUser {
  id: string;
  name: string;
}

/** Sem localStorage, mantém o usuário ao menos enquanto a página estiver aberta. */
let sessionUser: StoredUser | null = null;

function newId() {
  // randomUUID só existe em contexto seguro (https/localhost).
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function loadUser(): StoredUser {
  try {
    const stored = JSON.parse(localStorage.getItem(USER_KEY) ?? "null") as Partial<StoredUser> | null;
    if (stored?.id) return { id: stored.id, name: stored.name ?? "" };
  } catch {
    // localStorage indisponível ou corrompido: começa do zero.
  }
  return (sessionUser ??= { id: newId(), name: "" });
}

export function saveUser(user: StoredUser) {
  sessionUser = user;
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Sem persistência: o usuário só precisará digitar o nome de novo.
  }
}

/** "Sair" vale para todas as abas na mesma sala: o id é o mesmo, então é a mesma pessoa. */
export function announceLeft(room: string) {
  try {
    localStorage.setItem(LEFT_KEY, `${room}:${Date.now()}`);
  } catch {
    // Sem localStorage, as outras abas voltam para a mesa no próximo heartbeat.
  }
}

export function onLeftElsewhere(room: string, callback: () => void) {
  const listener = (event: StorageEvent) => {
    if (event.key === LEFT_KEY && event.newValue?.startsWith(`${room}:`)) callback();
  };
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}
