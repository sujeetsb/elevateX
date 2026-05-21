import * as React from "react";

import { cn } from "./utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "resize-none border-border placeholder:text-muted-foreground flex field-sizing-content min-h-16 w-full rounded-[var(--cp-radius-md)] border bg-input-background px-3 py-2 text-sm transition-[border-color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50",
        "hover:border-border focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
