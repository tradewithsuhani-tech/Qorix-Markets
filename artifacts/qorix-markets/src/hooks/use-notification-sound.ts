import { useEffect, useRef } from "react";
import { useGetNotifications } from "@workspace/api-client-react";
import { playNotificationSound, soundKindForType } from "@/lib/notification-sound";

/**
 * Watches the notifications query and plays a sound whenever a brand-new
 * notification (id > last seen) arrives. Skips the very first poll so that
 * existing notifications don't trigger a sound on mount/refresh.
 */
export function useNotificationSoundOnNew() {
  const { data } = useGetNotifications(
    { limit: 5 },
    { query: { refetchInterval: 30000 } },
  );

  const lastSeenIdRef = useRef<number | null>(null);

  useEffect(() => {
    const list = data?.notifications ?? [];
    if (list.length === 0) return;
    const maxId = Math.max(...list.map((n) => n.id));

    // First load: just remember, don't play.
    if (lastSeenIdRef.current === null) {
      lastSeenIdRef.current = maxId;
      return;
    }

    if (maxId > lastSeenIdRef.current) {
      // Find the newest notification to pick its sound type
      const newest = list.find((n) => n.id === maxId);
      const kind = newest ? soundKindForType(newest.type) : "generic";
      playNotificationSound(kind);
      lastSeenIdRef.current = maxId;
    }
  }, [data]);
}
