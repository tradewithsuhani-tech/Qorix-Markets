import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Link } from "wouter";
import {
  getMerchantToken,
  merchantApiUrl,
  merchantAuthFetch,
} from "@/lib/merchant-auth-fetch";
import { cn } from "@/lib/utils";

interface PendingItem {
  id: number;
  createdAt: string;
}
interface ListResponse {
  deposits: PendingItem[];
}

const BASE_TITLE = "Qorix Merchant";

function useMerchantPendingCount(): number {
  const tokenPresent = Boolean(getMerchantToken());
  const { data } = useQuery<ListResponse>({
    queryKey: ["merchant-pending-notify"],
    queryFn: () =>
      merchantAuthFetch<ListResponse>(
        merchantApiUrl("/merchant/inr-deposits?status=pending"),
      ),
    enabled: tokenPresent,
    refetchInterval: 10_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: false,
  });
  return data?.deposits?.length ?? 0;
}

function isOverdue(items: PendingItem[]): boolean {
  const now = Date.now();
  return items.some(
    (d) => now - new Date(d.createdAt).getTime() >= 10 * 60_000,
  );
}

function useOverdueFlag(): boolean {
  const tokenPresent = Boolean(getMerchantToken());
  const { data } = useQuery<ListResponse>({
    queryKey: ["merchant-pending-notify"],
    queryFn: () =>
      merchantAuthFetch<ListResponse>(
        merchantApiUrl("/merchant/inr-deposits?status=pending"),
      ),
    enabled: tokenPresent,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: false,
  });
  return data?.deposits ? isOverdue(data.deposits) : false;
}

/**
 * Drives `document.title` so background-tab merchants notice pending deposits.
 * Flashes between "(N) ⚠ N pending — Qorix Merchant" and the base title every
 * 1.2s while the tab is hidden AND there's pending work; restores base title
 * when count = 0 or tab becomes visible.
 */
function useTitleBeacon(count: number, overdue: boolean): void {
  const flashStateRef = useRef(false);
  useEffect(() => {
    if (count === 0) {
      document.title = BASE_TITLE;
      return;
    }
    const stamp = (state: boolean) => {
      const mark = overdue ? "⚠" : "●";
      document.title = state
        ? `(${count}) ${mark} ${count} pending — ${BASE_TITLE}`
        : BASE_TITLE;
    };
    // Only flash while hidden — when user has the tab in front, the popup +
    // badge already do the job; flashing focused tab is just noise.
    const shouldFlash = () =>
      typeof document !== "undefined" && document.hidden;

    if (shouldFlash()) {
      stamp(true);
    } else {
      // Tab visible: show count statically, no flashing.
      document.title = `(${count}) ${BASE_TITLE}`;
    }

    const interval = window.setInterval(() => {
      if (!shouldFlash()) {
        document.title = `(${count}) ${BASE_TITLE}`;
        flashStateRef.current = false;
        return;
      }
      flashStateRef.current = !flashStateRef.current;
      stamp(flashStateRef.current);
    }, 1200);

    const onVisibility = () => {
      if (!document.hidden) {
        document.title = `(${count}) ${BASE_TITLE}`;
        flashStateRef.current = false;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      document.title = BASE_TITLE;
    };
  }, [count, overdue]);
}

/**
 * Sidebar / topbar pill — persistent visibility of pending deposit queue.
 * Click → /merchant/deposits. Stays on every merchant page so even a merchant
 * idling on Settings or Methods can see "you have 2 deposits waiting".
 */
export function MerchantPendingBadge({
  variant,
}: {
  variant: "sidebar" | "mobile";
}) {
  const count = useMerchantPendingCount();
  const overdue = useOverdueFlag();
  useTitleBeacon(count, overdue);

  if (count === 0) return null;

  if (variant === "mobile") {
    return (
      <Link
        href="/merchant/deposits"
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums shadow-[0_2px_8px_-2px_rgba(252,213,53,0.5)] transition-transform active:scale-95",
          overdue
            ? "bg-rose-500 text-white animate-pulse"
            : "bg-amber-400 text-slate-950",
        )}
        aria-label={`${count} pending deposit${count === 1 ? "" : "s"}`}
      >
        <Bell className="h-3 w-3" />
        {count}
      </Link>
    );
  }

  return (
    <Link
      href="/merchant/deposits"
      className={cn(
        "group flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-all",
        overdue
          ? "border-rose-500/40 bg-rose-500/10 text-rose-200 hover:border-rose-500/60 hover:bg-rose-500/20 animate-pulse"
          : "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:border-amber-500/60 hover:bg-amber-500/20",
      )}
    >
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
            overdue ? "bg-rose-400" : "bg-amber-400",
          )}
        />
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            overdue ? "bg-rose-500" : "bg-amber-500",
          )}
        />
      </span>
      <span className="tabular-nums">{count}</span>
      <span className="text-[10px] font-medium uppercase tracking-wider opacity-80">
        {overdue ? "Overdue · review" : `Pending`}
      </span>
    </Link>
  );
}
