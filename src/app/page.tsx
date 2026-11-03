"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HomeForm } from "@/components/JoinForm";
import { loadUser, saveUser, type StoredUser } from "@/lib/user";

export default function Home() {
  const router = useRouter();
  // Carregado só no cliente, depois da hidratação, porque depende do localStorage.
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => setUser(loadUser()), []);

  if (!user) return null;

  return (
    <HomeForm
      userId={user.id}
      initialName={user.name}
      onEnter={(name, code) => {
        saveUser({ ...user, name });
        router.push(`/sala/${code}`);
      }}
    />
  );
}
