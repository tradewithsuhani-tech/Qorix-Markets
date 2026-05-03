import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { PortfolioProvider } from "@/context/PortfolioContext";
import { configureApiClient } from "@/lib/apiClient";

SplashScreen.preventAutoHideAsync();
configureApiClient();

function RootLayoutNav() {
  const { isAuthenticated, user, isLoading, pendingOtpFor } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const inAuthGroup = segments[0] === "(auth)";

  useEffect(() => {
    if (isLoading) return;

    // Not authenticated → push to login (or OTP if mid-signup)
    if (!isAuthenticated) {
      if (pendingOtpFor && segments[1] !== "otp") {
        router.replace({ pathname: "/(auth)/otp", params: { email: pendingOtpFor } });
      } else if (!inAuthGroup) {
        router.replace("/(auth)/login");
      }
      return;
    }

    // Authenticated but no KYC → push to KYC
    if (user && user.kycStatus === "none") {
      if (segments[1] !== "kyc") {
        router.replace("/(auth)/kyc");
      }
      return;
    }

    // Fully authenticated → push out of auth group into the app
    if (inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, user, pendingOtpFor, inAuthGroup, segments, router]);

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="risk-select"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen name="deploy" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="deposit" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="withdraw" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="withdraw-bank" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="withdraw-upi" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="withdraw-crypto" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="withdraw-success" options={{ animation: "slide_from_right", gestureEnabled: false }} />
      <Stack.Screen name="transfer" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="income" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="notifications" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <PortfolioProvider>
                  <RootLayoutNav />
                </PortfolioProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
