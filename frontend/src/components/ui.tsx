"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function Card({ children, className = "", title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-5 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type BtnProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
  className?: string;
  href?: string;
};

export function Button({ children, onClick, variant = "primary", disabled, loading, type = "button", className = "", href }: BtnProps) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
  const styles = {
    primary: "bg-brand text-white hover:bg-brand-strong",
    secondary: "border border-line bg-surface text-ink hover:bg-subtle",
    ghost: "text-brand hover:bg-brand-soft",
    danger: "border border-red-200 bg-surface text-red-700 hover:bg-red-50",
  }[variant];
  if (href) {
    return (
      <Link href={href} className={`${base} ${styles} ${className}`}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={`${base} ${styles} ${className}`}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" | "warn" | "good" | "bad" }) {
  const t = {
    neutral: "bg-subtle text-muted",
    brand: "bg-brand-soft text-brand-strong",
    warn: "bg-amber-50 text-amber-800",
    good: "bg-emerald-50 text-emerald-800",
    bad: "bg-red-50 text-red-700",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${t}`}>{children}</span>;
}

export function Meter({ value, target, className = "" }: { value: number; target?: number; className?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={`relative h-2 w-full rounded-full bg-subtle ${className}`}>
      <div className="h-2 rounded-full bg-brand" style={{ width: `${v * 100}%` }} />
      {target != null && (
        <div className="absolute -top-1 h-4 w-0.5 bg-ink" style={{ left: `${Math.min(1, target) * 100}%` }} title={`target ${target.toFixed(2)}`} />
      )}
    </div>
  );
}

export function Spinner({ label = "Memuat…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  const msg = error instanceof Error ? error.message : String(error);
  return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{msg}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{children}</div>;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mb-5 flex flex-wrap gap-1 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
            value === t.id ? "border-brand text-brand-strong" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/20";

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}
