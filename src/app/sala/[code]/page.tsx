"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { NameForm } from "@/components/JoinForm";
import { PokerRoom } from "@/components/PokerRoom";
import { normalizeRoomCode } from "@/lib/room-code";
import { announceLeft, loadUser, onLeftElsewhere, saveUser, type StoredUser } from "@/lib/user";

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = normalizeRoomCode(params.code);
  // Carregado só no cliente, depois da hidratação, porque depende do localStorage.
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => setUser(loadUser()), []);
  useEffect(() => onLeftElsewhere(code, () => router.push("/")), [code, router]);

  if (!user) return null;

  if (!user.name) {
    return (
      <NameForm
        room={code}
        onJoin={(name) => {
          const next = { ...user, name };
          saveUser(next);
          setUser(next);
        }}
      />
    );
  }

  return (
    <PokerRoom
      room={code}
      user={user}
      onLeave={() => {
        announceLeft(code);
        router.push("/");
      }}
    />
  );
}
