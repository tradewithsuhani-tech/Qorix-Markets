import React, { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { TURNSTILE_SITE_KEY } from "@/lib/apiClient";
import { useColors } from "@/hooks/useColors";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_ID = "cf-turnstile-script";

type TurnstileGlobal = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      theme?: "light" | "dark" | "auto";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileGlobal;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof document === "undefined") return Promise.reject(new Error("no document"));
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("turnstile load failed")));
      return;
    }
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile load failed"));
    document.head.appendChild(s);
  });

  return scriptPromise;
}

export interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

type Status = "loading" | "ready" | "verified" | "error";

export function TurnstileWidget({ onToken, onExpire, onError }: TurnstileWidgetProps) {
  const colors = useColors();
  const containerId = useRef(`cf-turnstile-${Math.random().toString(36).slice(2, 10)}`);
  const widgetIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (Platform.OS !== "web") {
      setStatus("error");
      return;
    }
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled) return;
        const el = document.getElementById(containerId.current);
        if (!el || !window.turnstile) {
          setStatus("error");
          return;
        }
        setStatus("ready");
        widgetIdRef.current = window.turnstile.render(el, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "dark",
          callback: (token: string) => {
            setStatus("verified");
            onToken(token);
          },
          "expired-callback": () => {
            setStatus("ready");
            onExpire?.();
          },
          "error-callback": () => {
            setStatus("error");
            onError?.();
          },
        });
      })
      .catch(() => {
        setStatus("error");
        onError?.();
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
      }
    };
  }, [onToken, onExpire, onError]);

  if (Platform.OS !== "web") {
    return (
      <View style={[styles.placeholder, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
          Captcha verification only available on web preview.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {/* React Native Web maps nativeID → DOM id, so Turnstile finds this node. */}
      <View nativeID={containerId.current} style={styles.container} />
      {status === "loading" ? (
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>
          Loading captcha…
        </Text>
      ) : null}
      {/* Errors are silent in dev — captcha is enforced at the server in prod. */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 65, alignItems: "center", justifyContent: "center" },
  placeholder: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  placeholderText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statusText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 4,
  },
  errorBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  errorTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  errorText: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
});
