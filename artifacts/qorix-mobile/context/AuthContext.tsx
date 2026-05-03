import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getMe as apiGetMe,
  login as apiLogin,
  register as apiRegister,
  type User as ApiUser,
} from "@workspace/api-client-react";
import React, { createContext, useContext, useEffect, useState } from "react";

import { setAuthToken, setCaptchaToken } from "@/lib/apiClient";

export type KycStatus = "none" | "pending" | "approved" | "rejected";
export type RiskTier = "conservative" | "moderate" | "aggressive" | null;

export interface LinkedBank {
  id: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  accountHolder: string;
  isPrimary: boolean;
  addedAt: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  kycStatus: KycStatus;
  riskTier: RiskTier;
  is2FAEnabled: boolean;
  isPhoneVerified?: boolean;
  linkedBanks?: LinkedBank[];
  referralCode?: string;
  isAdmin?: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  pendingOtpFor: string | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (
    email: string,
    password: string,
    captchaToken?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  signup: (
    name: string,
    email: string,
    phone: string,
    password: string,
    referralCode?: string,
    captchaToken?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (otp: string) => Promise<{ success: boolean; error?: string }>;
  submitKyc: (aadhaar: string, pan: string) => Promise<void>;
  setRiskProfile: (tier: RiskTier) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (partial: Partial<User>) => Promise<void>;
  addLinkedBank: (b: Omit<LinkedBank, "id" | "addedAt" | "isPrimary">) => Promise<void>;
  removeLinkedBank: (id: string) => Promise<void>;
}

const STORAGE_KEY = "@autotrader_user";
const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_USER: User = {
  id: "demo_001",
  name: "Arjun Sharma",
  email: "demo@autotrader.in",
  phone: "9876543210",
  kycStatus: "approved",
  riskTier: "moderate",
  is2FAEnabled: false,
  isPhoneVerified: true,
  linkedBanks: [
    {
      id: "bank_demo_1",
      bankName: "HDFC Bank",
      accountNumber: "50100123456712",
      ifsc: "HDFC0001234",
      accountHolder: "Arjun Sharma",
      isPrimary: true,
      addedAt: Date.now() - 86400000 * 30,
    },
  ],
};

function mergeApiUser(apiUser: ApiUser, prev: User | null): User {
  return {
    id: String(apiUser.id),
    name: apiUser.fullName,
    email: apiUser.email,
    phone: prev?.phone ?? "",
    kycStatus: prev?.kycStatus ?? "none",
    riskTier: prev?.riskTier ?? null,
    is2FAEnabled: prev?.is2FAEnabled ?? false,
    isPhoneVerified: prev?.isPhoneVerified ?? false,
    linkedBanks: prev?.linkedBanks ?? [],
    referralCode: apiUser.referralCode,
    isAdmin: apiUser.isAdmin,
  };
}

function extractError(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  const anyErr = err as { data?: { error?: string }; message?: string };
  const raw = anyErr?.data?.error ?? anyErr?.message ?? fallback;
  // Network/captcha errors in dev — friendly message
  if (/failed to fetch|network|internal server error/i.test(raw)) {
    return "Server unreachable (captcha required in production). Please use the Demo Account for now.";
  }
  return raw;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    pendingOtpFor: null,
    isLoading: true,
  });

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const user: User = JSON.parse(raw);
          setState({ user, isAuthenticated: true, pendingOtpFor: null, isLoading: false });
          // Refresh user from server in background (non-blocking)
          apiGetMe()
            .then((apiUser) => {
              const merged = mergeApiUser(apiUser, user);
              saveUser(merged);
              setState((s) => ({ ...s, user: merged }));
            })
            .catch(() => {
              /* token may be expired, keep cached user */
            });
        } catch {
          setState((s) => ({ ...s, isLoading: false }));
        }
      } else {
        setState((s) => ({ ...s, isLoading: false }));
      }
    })();
  }, []);

  const saveUser = async (user: User) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  };

  const login: AuthContextValue["login"] = async (email, password, captchaToken) => {
    if (!email || !password) return { success: false, error: "Enter email and password" };

    // Offline demo account — bypass API
    if (email.toLowerCase() === "demo@autotrader.in" && password === "demo1234") {
      await saveUser(DEMO_USER);
      setState({ user: DEMO_USER, isAuthenticated: true, pendingOtpFor: null, isLoading: false });
      return { success: true };
    }

    try {
      if (captchaToken) setCaptchaToken(captchaToken);
      const res = await apiLogin({ email, password });
      await setAuthToken(res.token);
      const user = mergeApiUser(res.user, null);
      await saveUser(user);
      setState({ user, isAuthenticated: true, pendingOtpFor: null, isLoading: false });
      return { success: true };
    } catch (err) {
      return { success: false, error: extractError(err, "Invalid email or password") };
    }
  };

  const signup: AuthContextValue["signup"] = async (
    name,
    email,
    _phone,
    password,
    referralCode,
    captchaToken,
  ) => {
    if (!name || !email || !password)
      return { success: false, error: "Name, email and password are required" };

    try {
      if (captchaToken) setCaptchaToken(captchaToken);
      const res = await apiRegister({
        fullName: name,
        email,
        password,
        referralCode: referralCode || null,
      });
      await setAuthToken(res.token);
      const user = mergeApiUser(res.user, null);
      await saveUser(user);
      setState({ user, isAuthenticated: true, pendingOtpFor: null, isLoading: false });
      return { success: true };
    } catch (err) {
      return { success: false, error: extractError(err, "Could not create account") };
    }
  };

  const verifyOtp: AuthContextValue["verifyOtp"] = async (otp) => {
    if (otp.length !== 6) return { success: false, error: "Enter 6-digit OTP" };
    // API has no OTP step — pass through for legacy callers.
    return { success: true };
  };

  const submitKyc = async (_aadhaar: string, _pan: string) => {
    await new Promise((r) => setTimeout(r, 1000));
    const updated = { ...state.user!, kycStatus: "pending" as KycStatus };
    await saveUser(updated);
    setState((s) => ({ ...s, user: updated }));
  };

  const setRiskProfile = async (tier: RiskTier) => {
    const updated = { ...state.user!, riskTier: tier };
    await saveUser(updated);
    setState((s) => ({ ...s, user: updated }));
  };

  const updateUser = async (partial: Partial<User>) => {
    const updated = { ...state.user!, ...partial };
    await saveUser(updated);
    setState((s) => ({ ...s, user: updated }));
  };

  const addLinkedBank: AuthContextValue["addLinkedBank"] = async (b) => {
    const existing = state.user?.linkedBanks ?? [];
    const newBank: LinkedBank = {
      ...b,
      id: `bank_${Date.now()}`,
      addedAt: Date.now(),
      isPrimary: existing.length === 0,
    };
    const updated = { ...state.user!, linkedBanks: [...existing, newBank] };
    await saveUser(updated);
    setState((s) => ({ ...s, user: updated }));
  };

  const removeLinkedBank = async (id: string) => {
    const existing = state.user?.linkedBanks ?? [];
    const filtered = existing.filter((b) => b.id !== id);
    if (filtered.length > 0 && !filtered.some((b) => b.isPrimary)) {
      filtered[0] = { ...filtered[0], isPrimary: true };
    }
    const updated = { ...state.user!, linkedBanks: filtered };
    await saveUser(updated);
    setState((s) => ({ ...s, user: updated }));
  };

  const logout = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await setAuthToken(null);
    // Clear React Query cache so the next user does not see cached referral
    // codes, deposit addresses, or other account-bound data.
    try {
      const { queryClient } = await import("@/lib/queryClient");
      queryClient.clear();
    } catch {
      /* cache clear is best-effort */
    }
    setState({ user: null, isAuthenticated: false, pendingOtpFor: null, isLoading: false });
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        signup,
        verifyOtp,
        submitKyc,
        setRiskProfile,
        logout,
        updateUser,
        addLinkedBank,
        removeLinkedBank,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
