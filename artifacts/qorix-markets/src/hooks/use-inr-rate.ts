import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export const FX_RATE_FALLBACK = 99;

export function useInrRate(): number {
  const { data } = useQuery<{ rate: number }>({
    queryKey: ["inr-rate"],
    queryFn: async () => {
      const r = (await authFetch(`${BASE_URL}/api/inr-rate`)) as { rate: number | string };
      const n = typeof r.rate === "string" ? parseFloat(r.rate) : r.rate;
      return { rate: Number.isFinite(n) && n > 0 ? n : FX_RATE_FALLBACK };
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  return data?.rate ?? FX_RATE_FALLBACK;
}
