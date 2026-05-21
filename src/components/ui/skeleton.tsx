import { cn } from "./utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted animate-pulse rounded-[var(--cp-radius-md)]", className)}
      {...props}
    />
  );
}

export { Skeleton };
