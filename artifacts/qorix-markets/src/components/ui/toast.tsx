import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X, AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-3 p-4 sm:bottom-4 sm:right-4 sm:top-auto sm:flex-col md:max-w-[400px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border p-4 pr-10 shadow-2xl backdrop-blur-xl transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default:
          "border-white/10 bg-[#0d1117]/95 text-white shadow-black/40",
        destructive:
          "destructive group border-red-500/30 bg-gradient-to-br from-[#1a0a0d]/95 to-[#0d1117]/95 text-white shadow-red-950/40",
        success:
          "success group border-emerald-500/30 bg-gradient-to-br from-[#0a1a13]/95 to-[#0d1117]/95 text-white shadow-emerald-950/40",
        info:
          "info group border-blue-500/30 bg-gradient-to-br from-[#0a121a]/95 to-[#0d1117]/95 text-white shadow-blue-950/40",
        warning:
          "warning group border-amber-500/30 bg-gradient-to-br from-[#1a140a]/95 to-[#0d1117]/95 text-white shadow-amber-950/40",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const VARIANT_ICON: Record<string, { Icon: React.ComponentType<{ className?: string }>; color: string; bg: string; ring: string }> = {
  destructive: { Icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/15", ring: "ring-red-500/30" },
  success: { Icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/15", ring: "ring-emerald-500/30" },
  info: { Icon: Info, color: "text-blue-400", bg: "bg-blue-500/15", ring: "ring-blue-500/30" },
  warning: { Icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/15", ring: "ring-amber-500/30" },
  default: { Icon: Info, color: "text-blue-400", bg: "bg-blue-500/15", ring: "ring-blue-500/30" },
}

const ToastIcon = ({ variant }: { variant?: string | null }) => {
  const v = (variant ?? "default") as keyof typeof VARIANT_ICON
  const meta = VARIANT_ICON[v] ?? VARIANT_ICON.default
  const { Icon, color, bg, ring } = meta
  return (
    <div className={cn("shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ring-1", bg, ring)}>
      <Icon className={cn("w-[18px] h-[18px]", color)} />
    </div>
  )
}

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, children, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    >
      <ToastIcon variant={variant} />
      <div className="flex-1 min-w-0">{children}</div>
    </ToastPrimitives.Root>
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-lg p-1.5 text-white/40 transition-all hover:text-white hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/20",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm opacity-90", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
