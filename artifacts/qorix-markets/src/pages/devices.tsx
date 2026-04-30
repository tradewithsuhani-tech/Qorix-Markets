import { Layout } from "@/components/layout";
import { motion, type Variants } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import {
  Smartphone,
  Monitor,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  Shield,
  Mail,
} from "lucide-react";

interface DeviceRow {
  id: string;
  browser: string;
  os: string;
  firstSeenAt: string;
  lastSeenAt: string;
  city: string | null;
  country: string | null;
  isCurrent: boolean;
  newDeviceAlertSent: boolean;
  withdrawalLocked: boolean;
  withdrawalUnlockAt: string | null;
  withdrawalUnlockHoursLeft: number;
  withdrawalUnlockIst: string | null;
}

type CurrentSession =
  | { withdrawalAllowed: true }
  | {
      withdrawalAllowed: false;
      message: string;
      hoursLeft: number;
      unlockAt: string;
      unlockIst: string;
    };

interface DevicesResponse {
  devices: DeviceRow[];
  cooldownHours: number;
  currentDeviceTracked: boolean;
  currentSession: CurrentSession;
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: "easeOut" },
  },
};

function isMobileOs(os: string): boolean {
  const lower = os.toLowerCase();
  return (
    lower.includes("android") ||
    lower.includes("ios") ||
    lower.includes("ipad") ||
    lower.includes("iphone") ||
    lower.includes("mobile")
  );
}

function DeviceRowSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="skeleton-shimmer w-10 h-10 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton-shimmer h-3.5 w-40 rounded" />
          <div className="skeleton-shimmer h-2.5 w-28 rounded" />
        </div>
      </div>
      <div className="space-y-2 pt-2">
        <div className="skeleton-shimmer h-2.5 w-full rounded" />
        <div className="skeleton-shimmer h-2.5 w-3/4 rounded" />
      </div>
    </div>
  );
}

function DeviceCard({ d }: { d: DeviceRow }) {
  const Icon = isMobileOs(d.os) ? Smartphone : Monitor;
  const lastSeenRel = formatDistanceToNow(new Date(d.lastSeenAt), {
    addSuffix: true,
  });
  const firstSeenAbs = format(new Date(d.firstSeenAt), "MMM d, yyyy 'at' HH:mm");

  return (
    <motion.div
      variants={item}
      className={`glass-card rounded-2xl p-5 ${
        d.isCurrent
          ? "border-blue-500/40 bg-blue-500/[0.03]"
          : "border-white/[0.06]"
      }`}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div
          className={`p-2.5 rounded-xl shrink-0 ${
            d.isCurrent
              ? "bg-blue-500/15 text-blue-400"
              : "bg-white/[0.04] text-white/70"
          }`}
        >
          <Icon style={{ width: 20, height: 20 }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-semibold truncate">{d.browser}</div>
            {d.isCurrent && (
              <span className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                <CheckCircle2 style={{ width: 10, height: 10 }} />
                This device
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {d.os}
          </div>
        </div>
      </div>

      {/* Meta rows */}
      <div className="mt-4 space-y-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock style={{ width: 12, height: 12 }} className="shrink-0" />
          <span className="truncate">
            Last seen{" "}
            <span className="text-white/80">{lastSeenRel}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Shield style={{ width: 12, height: 12 }} className="shrink-0" />
          <span className="truncate">
            First sign-in: <span className="text-white/80">{firstSeenAbs}</span>
          </span>
        </div>
        {d.newDeviceAlertSent && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail style={{ width: 12, height: 12 }} className="shrink-0" />
            <span className="truncate">
              New-device email alert sent at first sign-in
            </span>
          </div>
        )}
      </div>

    </motion.div>
  );
}

export default function DevicesPage() {
  const { data, isLoading, error } = useQuery<DevicesResponse>({
    queryKey: ["/api/devices"],
    queryFn: () => authFetch<DevicesResponse>("/api/devices"),
    refetchOnWindowFocus: false,
  });

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-2"
        >
          <Link href="/settings">
            <a className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-white transition-colors">
              <ChevronLeft style={{ width: 14, height: 14 }} />
              Back to settings
            </a>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400">
              <Smartphone style={{ width: 16, height: 16 }} />
            </div>
            <h1 className="text-xl font-bold">My Devices</h1>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Every device you've successfully signed in from. If you see a
            device you don't recognise, change your password immediately.
          </p>
        </motion.div>

        {/* List */}
        {isLoading && (
          <div className="space-y-3">
            <DeviceRowSkeleton />
            <DeviceRowSkeleton />
          </div>
        )}

        {error && (
          <div className="glass-card rounded-2xl p-5 flex items-start gap-3 text-rose-300 border-rose-500/30">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="font-semibold">Couldn't load your devices</div>
              <div className="text-rose-200/80 mt-0.5">
                Please refresh the page or try again in a few moments.
              </div>
            </div>
          </div>
        )}

        {data && data.devices.length === 0 && !isLoading && (
          <div className="glass-card rounded-2xl p-8 text-center">
            <div className="inline-flex p-3 rounded-2xl bg-white/[0.04] text-white/60 mb-3">
              <Smartphone style={{ width: 24, height: 24 }} />
            </div>
            <div className="text-sm font-medium">No devices recorded yet</div>
            <div className="text-xs text-muted-foreground mt-1">
              Devices appear here after a successful sign-in.
            </div>
          </div>
        )}

        {data && data.devices.length > 0 && (
          <>
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="space-y-3"
            >
              {data.devices.map((d) => (
                <DeviceCard key={d.id} d={d} />
              ))}
            </motion.div>

            <div className="text-[11px] text-muted-foreground text-center pt-2">
              Showing {data.devices.length} device
              {data.devices.length !== 1 ? "s" : ""}.
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
