/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { api } from "./api";

interface CurrentUser {
  userId: string;
  tenantId: string;
  companyId: string;
  branchIds: string[];
  permissions: string[];
  forcePasswordChange: boolean;
}
interface AuthValue {
  user: CurrentUser | null;
  loading: boolean;
  login(email: string, password: string): Promise<{ forcePasswordChange: boolean }>;
  logout(): Promise<void>;
  refresh(): Promise<void>;
}
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      setUser(await api<CurrentUser>("/me"));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => void refresh(), [refresh]);
  const value = useMemo<AuthValue>(() => ({
    user,
    loading,
    refresh,
    async login(email, password) {
      const result = await api<{ user: { forcePasswordChange: boolean } }>("/auth/login", {
        method: "POST", body: JSON.stringify({ email, password })
      });
      return { forcePasswordChange: result.user.forcePasswordChange };
    },
    async logout() {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
    }
  }), [loading, refresh, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider no está disponible.");
  return value;
}
