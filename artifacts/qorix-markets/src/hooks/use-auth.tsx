import React, { createContext, useContext, useEffect, useState } from "react";
import { useGetMe } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { getOrCreateVisitorId } from "@/lib/visitor-id";

type AuthContextType = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem("qorix_token");
    } catch (e) {
      return null;
    }
  });

  const [, setLocation] = useLocation();

  const { data: user, isLoading, isError } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
    },
  });

  useEffect(() => {
    if (isError) {
      logout();
    }
  }, [isError]);

  const login = (newToken: string, newUser: User) => {
    try {
      localStorage.setItem("qorix_token", newToken);
    } catch (e) {
      // ignore
    }
    setToken(newToken);

    // Task #145 Batch D: claim the visitor's anonymous chat session so the
    // history they built up before signing in follows them into their
    // authenticated account. Fire-and-forget — auth flow MUST NOT block on
    // this network call. A failed claim leaves the guest session orphaned
    // (still scannable by support via visitor_id) but does not break login.
    try {
      const visitorId = getOrCreateVisitorId();
      void fetch("/api/chat/guest-session/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${newToken}`,
          "x-visitor-id": visitorId,
        },
        body: JSON.stringify({ visitorId }),
      }).catch(() => {
        // Non-fatal: orphaned guest session, no user-visible impact.
      });
    } catch {
      // localStorage / crypto unavailable — visitor was never identified, no
      // session to claim. Silently skip.
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem("qorix_token");
    } catch (e) {
      // ignore
    }
    setToken(null);
    setLocation("/");
  };

  return (
    <AuthContext.Provider value={{ user: user || null, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
