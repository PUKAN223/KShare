import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-sm",
        secondary:
          "border-border/60 bg-secondary text-secondary-foreground",
        destructive:
          "border-destructive/30 bg-destructive/10 text-destructive-foreground",
        outline:
          "border-border/80 text-foreground bg-background/50",
        live:
          "border-rose-500/30 bg-rose-500/10 text-rose-400 font-semibold",
        success:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-medium",
        warning:
          "border-amber-500/30 bg-amber-500/10 text-amber-400 font-medium",
        cyber:
          "border-cyan-500/30 bg-cyan-500/10 text-cyan-300 font-medium",
        gradient:
          "border-transparent bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold shadow-sm"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  pulse?: boolean;
}

function Badge({ className, variant, dot, pulse, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            variant === "live" && "bg-rose-500",
            variant === "success" && "bg-emerald-400",
            variant === "warning" && "bg-amber-400",
            variant === "cyber" && "bg-cyan-400",
            (!variant || variant === "default") && "bg-primary-foreground",
            pulse && "animate-pulse"
          )}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
