import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--cp-radius-md)] text-sm font-medium transition-[background-color,border-color,color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-0 aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-white/[0.08] shadow-[var(--cp-elevation-1)] hover:bg-primary/90 hover:border-white/[0.12] hover:shadow-[var(--cp-elevation-2)] focus-visible:shadow-[var(--cp-shadow-focus)]",
        destructive:
          "bg-destructive text-destructive-foreground border border-white/[0.06] hover:bg-destructive/90 focus-visible:shadow-[0_0_0_2px_var(--cp-surface-0),0_0_0_4px_rgba(248,113,113,0.35)]",
        outline:
          "border border-border bg-transparent text-secondary-foreground hover:bg-muted hover:text-foreground hover:border-[var(--cp-border-strong)]",
        secondary:
          "bg-secondary text-secondary-foreground border border-border shadow-[var(--cp-elevation-1)] hover:bg-[var(--cp-bg-hover)] hover:text-foreground hover:border-[var(--cp-border-strong)]",
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:text-[var(--cp-accent-hover)] hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5 text-xs",
        lg: "h-10 px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
