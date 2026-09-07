import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Container } from "@/components/ui/Container";

type SectionTone = "default" | "dark" | "tint" | "sage";

const toneStyles: Record<SectionTone, string> = {
  default: "bg-cream-50 text-ink-800",
  dark: "bg-navy-950 text-cream-100",
  tint: "bg-cream-200/70 text-ink-800",
  sage: "bg-sage-200/60 text-ink-800",
};

interface SectionProps extends ComponentPropsWithoutRef<"section"> {
  tone?: SectionTone;
  padding?: boolean;
}

export function Section({
  tone = "default",
  padding = true,
  className,
  children,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn(toneStyles[tone], padding && "py-20 sm:py-24 lg:py-32", className)}
      {...props}
    >
      {children}
    </section>
  );
}

export function SectionInner({
  size = "site",
  className,
  children,
}: {
  size?: "site" | "narrow" | "tight";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Container size={size} className={className}>
      {children}
    </Container>
  );
}