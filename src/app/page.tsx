"use client";
import { useEffect, useState } from "react";
import { JoinForm } from "@/components/JoinForm";
import { PokerRoom } from "@/components/PokerRoom";

const STORAGE_KEY = "scrum-poker:user";

interface StoredUser {
  id: string;
  name: string;
}

function newId() {
  // randomUUID só existe em contexto seguro (https/localhost).
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadUser(): StoredUser {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<StoredUser> | null;
    if (stored?.id) return { id: stored.id, name: stored.name ?? "" };
  } catch {
    // localStorage indisponível ou corrompido: começa do zero.
  }
  return { id: newId(), name: "" };
}

function saveUser(user: StoredUser) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Sem persistência: o usuário só precisará digitar o nome de novo.
  }
}

export default function Home() {
  // Carregado só no cliente, depois da hidratação, porque depende do localStorage.
  const [user, setUser] = useState<StoredUser | null>(null);
  const [seated, setSeated] = useState(false);

  useEffect(() => {
    const loaded = loadUser();
    setUser(loaded);
    setSeated(loaded.name !== "");
  }, []);

  if (!user) return null;

  if (!seated) {
    return (
      <JoinForm
        initialName={user.name}
        onJoin={(name) => {
          const next = { ...user, name };
          saveUser(next);
          setUser(next);
          setSeated(true);
        }}
      />
    );
  }

  return (
    <PokerRoom
      user={user}
      onLeave={() => {
        saveUser({ ...user, name: "" });
        setSeated(false);
      }}
    />
  );
}
