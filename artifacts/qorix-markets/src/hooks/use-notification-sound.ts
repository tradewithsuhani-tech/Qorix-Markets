import { useEffect, useRef } from "react";
import { useGetNotifications } from "@workspace/api-client-react";
import { playNotificationSound, soundKindForType } from "@/lib/notification-sound";
import { useToast } from "@/hooks/use-toast";

/**
 * Watches the notifications query and plays a sound + shows a toast whenever a
 * brand-new notification (id > last seen) arrives. Skips the very first poll so
 * existing notifications don't trigger noise on mount/refresh.
 */
export function useNotificationSoundOnNew() {
  const { data } = useGetNotifications(
    { limit: 5 },
    { query: { refetchInterval: 15000 } },
  );
  const { toast } = useToast();

  const lastSeenIdRef = useRef<number | null>(null);

  useEffect(() => {
    const list = data?.notifications ?? [];
    if (list.length === 0) return;
    const maxId = Math.max(...list.map((n: any) => n.id));

    // First load: just remember, don't play.
    if (lastSeenIdRef.current === null) {
      lastSeenIdRef.current = maxId;
      return;
    }

    if (maxId > lastSeenIdRef.current) {
      const previousLastSeen = lastSeenIdRef.current;
      // Show a toast for every new notification (newest first), and play sound
      // once for the most recent.
      const fresh = list
        .filter((n: any) => n.id > previousLastSeen)
        .sort((a: any, b: any) => b.id - a.id);

      if (fresh.length > 0) {
        const newest = fresh[0];
        const kind = soundKindForType(newest.type);
        playNotificationSound(kind);

        for (const n of fresh) {
          toast({
            title: n.title,
            description: n.message,
            duration: 6000,
          });
        }
      }

      lastSeenIdRef.current = maxId;
    }
  }, [data, toast]);
}
