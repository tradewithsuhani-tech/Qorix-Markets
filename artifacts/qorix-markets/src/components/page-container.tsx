import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Standard page wrapper used inside <Layout>.
 *
 * Layout already provides:
 *   • outer padding (p-4 md:p-8)
 *   • an outer 1152px cap (max-w-6xl mx-auto)
 *   • the mobile bottom-nav clearance spacer
 *
 * PageContainer adds page-level max-width and section spacing on top, with a
 * fixed token vocabulary so every page picks from the same set instead of
 * inventing its own.
 *
 * IMPORTANT: do NOT add px / py here. Pages that add their own horizontal
 * padding inside Layout end up double-padded — on a 375px screen that drops
 * the usable content area from 343px to 311px.
 */

type MaxWidth = "compact" | "default" | "wide";
type Spacing = "tight" | "default" | "loose";

const MAX_WIDTH_CLASSES: Record<MaxWidth, string> = {
  compact: "max-w-2xl", //  672px — narrow forms, focused single-column pages
  default: "max-w-4xl", //  896px — most pages with text + a few cards
  wide: "max-w-6xl", //   1152px — data-dense / trading pages (matches Layout cap)
};

const SPACING_CLASSES: Record<Spacing, string> = {
  tight: "space-y-4",
  default: "space-y-6",
  loose: "space-y-8",
};

interface PageContainerProps {
  /** Max content width. Defaults to "default" (896px). */
  maxWidth?: MaxWidth;
  /** Vertical gap between top-level sections. Defaults to "default" (24px). */
  spacing?: Spacing;
  /** Extra classes for one-off tweaks. Avoid px/py here. */
  className?: string;
  children: ReactNode;
}

export function PageContainer({
  maxWidth = "default",
  spacing = "default",
  className,
  children,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        MAX_WIDTH_CLASSES[maxWidth],
        SPACING_CLASSES[spacing],
        className,
      )}
    >
      {children}
    </div>
  );
}
