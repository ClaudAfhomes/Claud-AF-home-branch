import { cn } from "@/lib/cn";

interface DividerProps {
  /** Optional centered editorial label. */
  label?: string;
  className?: string;
}

/** Editorial hairline with an optional centered label. */
export function Divider({ label, className }: DividerProps) {
  if (!label) {
    return <hr className={cn("border-0 bg-line h-px w-full", className)} aria-hidden="true" />;
  }

  return (
    <div className={cn("flex w-full items-center gap-6", className)} role="separator">
      <span className="h-px flex-1 bg-line" aria-hidden="true" />
      <span className="label-caps shrink-0 text-ink-400">{label}</span>
      <span className="h-px flex-1 bg-line" aria-hidden="true" />
    </div>
  );
}