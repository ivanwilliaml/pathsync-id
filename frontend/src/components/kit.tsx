"use client";

// Small app-level building blocks on top of shadcn/ui.
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { VariantProps } from "class-variance-authority";
import { AlertCircle, Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Navigation that looks like a button (keeps <a> semantics for Cmd/Ctrl-click). */
export function LinkButton({
  href,
  className,
  variant,
  size,
  children,
  ...props
}: ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </Link>
  );
}

export function PageHeader({ title, description, actions, className }: { title: string; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <header className={cn("mb-8 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0 max-w-2xl">
        <h1 className="text-[28px] font-bold leading-tight text-ink sm:text-[32px]">{title}</h1>
        {description ? <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 id={id} className="scroll-mt-24 text-lg font-semibold text-ink">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Panel({ children, className, ...props }: ComponentProps<"section">) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5 sm:p-6", className)} {...props}>
      {children}
    </section>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {label}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{msg}</span>
    </div>
  );
}

export function EmptyState({ title, children, action, image }: { title: string; children?: ReactNode; action?: ReactNode; image?: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" width={160} height={107} loading="lazy" className="mb-5 h-[107px] w-40 rounded-xl object-cover" />
      ) : null}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {children ? <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{children}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Mastery bar: filled to the current level, with a tick at the target. */
export function MasteryBar({ value, target, className, tone = "route" }: { value: number; target?: number | null; className?: string; tone?: "route" | "indigo" | "mint" }) {
  const v = Math.max(0, Math.min(1, value));
  const fill = tone === "route" ? "bg-route" : tone === "mint" ? "bg-mint" : "bg-indigo";
  return (
    <div className={cn("relative h-2 w-full rounded-full bg-muted", className)} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}>
      <div className={cn("h-2 rounded-full", fill)} style={{ width: `${v * 100}%` }} />
      {target != null ? (
        <span className="absolute -top-1 h-4 w-[3px] rounded-full bg-ink" style={{ left: `calc(${Math.min(1, target) * 100}% - 1.5px)` }} aria-hidden="true" />
      ) : null}
    </div>
  );
}

export function Tag({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "indigo" | "ember" | "mint" | "red"; className?: string }) {
  const t = {
    neutral: "bg-muted text-ink/80",
    indigo: "bg-secondary text-secondary-foreground",
    ember: "bg-[#fff1e8] text-ember-ink",
    mint: "bg-[#e3f6f2] text-mint-ink",
    red: "bg-destructive/10 text-destructive",
  }[tone];
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", t, className)}>{children}</span>;
}

export const fieldCls =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-ink outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50";

/** Native select styled like the inputs (reliable on mobile, explicit colours for Windows dark mode). */
export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(fieldCls, "appearance-auto bg-card pr-8 text-ink", className)} {...props}>
      {children}
    </select>
  );
}
