import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium",
    "rounded-lg transition-all duration-200 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
    "active:scale-[0.97]",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    "select-none cursor-pointer",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary — gradient biru untuk aksi utama
        default: [
          "bg-gradient-to-b from-blue-500 to-blue-600 text-white",
          "shadow-[0_1px_2px_rgba(0,0,0,0.12),0_2px_8px_rgba(59,130,246,0.25)]",
          "border border-blue-600/40",
          "hover:from-blue-400 hover:to-blue-500",
          "hover:shadow-[0_2px_4px_rgba(0,0,0,0.12),0_4px_16px_rgba(59,130,246,0.35)]",
          "hover:scale-[1.02]",
          "focus-visible:ring-blue-500",
        ].join(" "),

        // Secondary — netral abu
        secondary: [
          "bg-gradient-to-b from-slate-100 to-slate-200 text-slate-700",
          "shadow-[0_1px_2px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.06)]",
          "border border-slate-300/80",
          "hover:from-slate-50 hover:to-slate-150 hover:text-slate-900",
          "hover:shadow-[0_2px_4px_rgba(0,0,0,0.10),0_2px_8px_rgba(0,0,0,0.08)]",
          "hover:scale-[1.02]",
          "focus-visible:ring-slate-400",
          "dark:from-slate-700 dark:to-slate-800 dark:text-slate-200 dark:border-slate-600/80",
          "dark:hover:from-slate-600 dark:hover:to-slate-700",
        ].join(" "),

        // Success — gradient hijau
        success: [
          "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white",
          "shadow-[0_1px_2px_rgba(0,0,0,0.12),0_2px_8px_rgba(16,185,129,0.25)]",
          "border border-emerald-600/40",
          "hover:from-emerald-400 hover:to-emerald-500",
          "hover:shadow-[0_2px_4px_rgba(0,0,0,0.12),0_4px_16px_rgba(16,185,129,0.35)]",
          "hover:scale-[1.02]",
          "focus-visible:ring-emerald-500",
        ].join(" "),

        // Warning — gradient kuning/oranye
        warning: [
          "bg-gradient-to-b from-amber-400 to-amber-500 text-white hover:text-gray-800",
          "shadow-[0_1px_2px_rgba(0,0,0,0.12),0_2px_8px_rgba(245,158,11,0.25)]",
          "border border-amber-500/40",
          "hover:from-amber-300 hover:to-amber-400 ",
          "hover:shadow-[0_2px_4px_rgba(0,0,0,0.12),0_4px_16px_rgba(245,158,11,0.35)]",
          "hover:scale-[1.02]",
          "focus-visible:ring-amber-400",
        ].join(" "),

        // Danger / Destructive — gradient merah
        destructive: [
          "bg-gradient-to-b from-rose-500 to-rose-600 text-white",
          "shadow-[0_1px_2px_rgba(0,0,0,0.12),0_2px_8px_rgba(244,63,94,0.25)]",
          "border border-rose-600/40",
          "hover:from-rose-400 hover:to-rose-500",
          "hover:shadow-[0_2px_4px_rgba(0,0,0,0.12),0_4px_16px_rgba(244,63,94,0.35)]",
          "hover:scale-[1.02]",
          "focus-visible:ring-rose-500",
        ].join(" "),

        // Info — gradient cyan/biru muda
        info: [
          "bg-gradient-to-b from-cyan-500 to-cyan-600 text-white hover:text-gray-800",
          "shadow-[0_1px_2px_rgba(0,0,0,0.12),0_2px_8px_rgba(6,182,212,0.25)]",
          "border border-cyan-600/40",
          "hover:from-cyan-400 hover:to-cyan-500",
          "hover:shadow-[0_2px_4px_rgba(0,0,0,0.12),0_4px_16px_rgba(6,182,212,0.35)]",
          "hover:scale-[1.02]",
          "focus-visible:ring-cyan-500",
        ].join(" "),

        // Ghost — transparan dengan hover subtle
        ghost: [
          "bg-transparent text-slate-600",
          "border border-transparent",
          "hover:bg-slate-100 hover:text-slate-900 hover:border-slate-200",
          "hover:shadow-[0_1px_3px_rgba(0,0,0,0.08)]",
          "focus-visible:ring-slate-400",
          "dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 dark:hover:border-slate-700",
        ].join(" "),

        // Outline — border dengan warna primary
        outline: [
          "bg-transparent text-slate-700",
          "border border-slate-300 shadow-[0_1px_2px_rgba(0,0,0,0.05)]",
          "hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900",
          "hover:shadow-[0_1px_4px_rgba(0,0,0,0.10)]",
          "hover:scale-[1.02]",
          "focus-visible:ring-slate-400",
          "dark:text-slate-300 dark:border-slate-600",
          "dark:hover:bg-slate-800 dark:hover:border-slate-500 dark:hover:text-slate-100",
        ].join(" "),

        // Link — teks dengan underline
        link: [
          "bg-transparent text-blue-600 underline-offset-4",
          "hover:underline hover:text-blue-700",
          "focus-visible:ring-blue-500",
          "dark:text-blue-400 dark:hover:text-blue-300",
        ].join(" "),
      },
      size: {
        default: "h-11 px-4 py-2 md:h-9",
        xxs: "h-6 px-2 py-1 text-xs",
        xs: "h-7 rounded-md px-3 text-xs",
        sm: "h-9 rounded-lg px-3 text-xs md:h-8 md:rounded-md",
        lg: "h-11 rounded-xl px-6 text-base",
        xl: "h-12 rounded-xl px-8 text-base font-semibold",
        icon: "h-11 w-11 rounded-xl md:h-9 md:w-9 md:rounded-lg",
        "icon-sm": "h-7 w-7 rounded-md",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"

    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          disabled={disabled || loading}
          {...props}
        >
          {children}
        </Comp>
      )
    }

    const hasExplicitIcons = leftIcon || rightIcon

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="animate-spin shrink-0" aria-hidden="true" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {hasExplicitIcons && !loading
          ? children && <span className="truncate">{children}</span>
          : children}
        {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
