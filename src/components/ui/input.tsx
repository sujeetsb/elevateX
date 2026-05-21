import * as React from "react";

import { cn } from "./utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-[var(--cp-accent-muted)] selection:text-foreground border-border flex h-9 w-full min-w-0 rounded-[var(--cp-radius-md)] border px-3 py-1 text-sm bg-input-background shadow-[var(--cp-shadow-inset)] transition-[border-color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45",
        "hover:border-[var(--cp-border-strong)] focus-visible:border-primary focus-visible:shadow-[var(--cp-shadow-focus)]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
