import React, { createContext, useContext, useEffect, useState } from "react";
import { useGetMe } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { useLocation } from "wouter";

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

  // ─── Qorix Play OAuth resume hook ─────────────────────────────────────
  // When the user lands on /oauth/quiz/authorize unauthenticated, that
  // page stashes the full URL in sessionStorage and bounces them to
  // /login. After login, the user normally ends up on /dashboard — but
  // we want to resume the OAuth flow they originally tried to start so
  // they don't have to click "Sign in with Qorix Markets" twice.
  //
  // This effect fires on every transition where `user` becomes truthy.
  // We use window.location.href (not setLocation) because the OAuth page
  // reads window.location.search on mount; a Wouter client-side nav
  // would skip that hydration when it's the same component. The
  // sessionStorage entry is cleared atomically before the nav so we
  // never loop. (B35)
  useEffect(() => {
    if (!user) return;
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem("qorix_oauth_resume_url");
    } catch {
      return;
    }
    if (!pending) return;
    // Sanity-check the stored URL — only resume to /oauth/quiz/* paths,
    // never to an arbitrary attacker-supplied URL. Since this came from
    // our own page in the same origin it should always start with
    // /oauth/quiz/, but a defensive check costs nothing.
    if (!pending.startsWith("/oauth/quiz/")) {
      try {
        sessionStorage.removeItem("qorix_oauth_resume_url");
      } catch {
        // ignore
      }
      return;
    }
    try {
      sessionStorage.removeItem("qorix_oauth_resume_url");
    } catch {
      // ignore
    }
    // Use replace so the dashboard URL the user briefly hit on the way
    // here doesn't end up in their back-button history.
    window.location.replace(pending);
  }, [user]);

  const login = (newToken: string, newUser: User) => {
    try {
      localStorage.setItem("qorix_token", newToken);
    } catch (e) {
      // ignore
    }
    setToken(newToken);
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
