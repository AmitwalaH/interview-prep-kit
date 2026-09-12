"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiFetch, ApiError } from "./apiClient";
import { User } from "./types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // true until the initial /me check resolves
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<User>("/api/auth/me")
      .then((u) => setUser(u))
      .catch(() => setUser(null)) // 401 just means signed out — not an error to surface
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    setError(null);
    try {
      const u = await apiFetch<User>("/api/auth/login", { method: "POST", body: { email, password } });
      setUser(u);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      throw err;
    }
  }

  async function register(email: string, password: string) {
    setError(null);
    try {
      const u = await apiFetch<User>("/api/auth/register", { method: "POST", body: { email, password } });
      setUser(u);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      throw err;
    }
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
