import { useEffect, useState } from "react";
import type { LocalSession, LocalUser } from "@/lib/localCommerce";
import { apiFetch } from "@/lib/api";

export function useAuth() {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [session, setSession] = useState<LocalSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sync = async () => {
      try {
        const data = await apiFetch<{ user: LocalUser }>("/api/auth/me");
        setUser(data.user);
        setSession({ user: data.user });
      } catch {
        setUser(null);
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    sync();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const result = await apiFetch<{ user: LocalUser; token: string }>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, fullName }),
      });
      setUser(result.user);
      setSession({ user: result.user });
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : "Erro ao criar conta" } };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const result = await apiFetch<{ user: LocalUser; token: string }>("/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setUser(result.user);
      setSession({ user: result.user });
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : "Erro ao entrar" } };
    }
  };

  const signOut = async () => {
    try {
      await apiFetch("/api/auth/signout", { method: "POST" });
    } catch {
      // noop
    }
    setUser(null);
    setSession(null);
    return { error: null };
  };

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    isAuthenticated: !!user,
  };
}
