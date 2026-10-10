import type { ReactNode } from "react";
import { modeLabel } from "@/lib/format";
import type { Mode } from "@/lib/types";
import { AlertIcon, CheckIcon, InfoIcon, ModeIcon, XCircleIcon } from "./icons";

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 font-semibold text-on-brand transition hover:bg-brand/90 disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-card px-4 py-2.5 font-medium text-ink transition hover:border-brand hover:text-brand disabled:opacity-50",
  ghost: "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 font-medium text-brand transition hover:bg-brand-soft",
};

export function PageHeader({ title, intro, children }: { title: string; intro?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {intro ? <p className="mt-2 text-muted">{intro}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-card p-4 sm:p-5 ${className}`}>{children}</div>;
}

type Tone = "info" | "success" | "warning" | "error";

const TONE: Record<Tone, { box: string; icon: ReactNode; role?: "alert" | "status" }> = {
  info: { box: "border-brand/30 bg-brand-soft", icon: <InfoIcon className="h-5 w-5 text-brand" /> },
  success: { box: "border-brand/30 bg-brand-soft", icon: <CheckIcon className="h-5 w-5 text-brand" />, role: "status" },
  warning: { box: "border-accent bg-accent-soft", icon: <AlertIcon className="h-5 w-5 text-accent-ink" /> },
  error: { box: "border-accent bg-accent-soft", icon: <XCircleIcon className="h-5 w-5 text-accent-ink" />, role: "alert" },
};

export function Notice({ tone = "info", title, children, icon }: { tone?: Tone; title?: ReactNode; children?: ReactNode; icon?: ReactNode }) {
  const t = TONE[tone];
  return (
    <div role={t.role} className={`flex gap-3 rounded-xl border p-4 text-ink ${t.box}`}>
      <span className="mt-0.5">{icon ?? t.icon}</span>
      <div className="min-w-0 flex-1 text-sm">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? "mt-1" : ""}>{children}</div> : null}
      </div>
    </div>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-8 text-muted">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand" aria-hidden />
      <span>{label}…</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Notice tone="error" title="Something went wrong">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className={`${btn.secondary} mt-3 py-1.5 text-sm`}>
          Try again
        </button>
      ) : null}
    </Notice>
  );
}

/** Mode shown as icon plus text label. */
export function ModeTag({ mode, label }: { mode: Mode | string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-0.5 text-sm font-medium text-ink">
      <ModeIcon mode={mode} className="h-4 w-4 text-brand" />
      {label ?? modeLabel(mode)}
    </span>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold text-ink">{value}</dd>
    </div>
  );
}
