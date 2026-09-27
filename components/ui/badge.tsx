import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-block text-xs font-bold px-2.5 py-0.5 rounded-full", {
  variants: {
    tone: {
      green: "bg-green-100 text-green-800",
      amber: "bg-amber-100 text-amber-800",
      red: "bg-red-100 text-red-800",
      blue: "bg-blue-100 text-blue-800",
      navy: "bg-primary-soft text-primary",
      gray: "bg-slate-100 text-slate-600",
    },
  },
  defaultVariants: { tone: "gray" },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
