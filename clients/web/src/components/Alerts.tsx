"use client";

import { useState } from "react";
import { istDateTime } from "@/lib/format";
import type { Alert, Lang } from "@/lib/types";
import { AlertIcon, CheckIcon, CopyIcon, ShareIcon } from "./icons";

export const LANGS: { key: Lang; label: string; htmlLang: string }[] = [
  { key: "en", label: "English", htmlLang: "en" },
  { key: "gu", label: "ગુજરાતી", htmlLang: "gu" },
  { key: "hi", label: "हिन्दी", htmlLang: "hi" },
];

export function LanguageToggle({ value, onChange }: { value: Lang; onChange: (l: Lang) => void }) {
  return (
    <div role="group" aria-label="Alert language" className="inline-flex rounded-lg border border-line bg-card p-0.5">
      {LANGS.map((l) => (
        <button
          key={l.key}
          type="button"
          lang={l.htmlLang}
          aria-pressed={value === l.key}
          onClick={() => onChange(l.key)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${value === l.key ? "bg-brand text-on-brand" : "text-muted hover:text-brand"}`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

function CopyForWhatsApp({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-medium text-brand hover:border-brand">
        {state === "copied" ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
        {state === "copied" ? "Copied" : "Copy for WhatsApp"}
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand-soft"
      >
        <ShareIcon className="h-4 w-4" />
        Share on WhatsApp
      </a>
      <span aria-live="polite" className="text-sm text-muted">
        {state === "failed" ? "Copy is blocked in this browser. Use Share on WhatsApp instead." : ""}
      </span>
    </div>
  );
}

export function AlertItem({ alert, lang }: { alert: Alert; lang: Lang }) {
  const htmlLang = LANGS.find((l) => l.key === lang)?.htmlLang;
  return (
    <article className="rounded-xl border border-accent bg-accent-soft p-4">
      <div className="flex items-start gap-3">
        <AlertIcon className="mt-0.5 h-5 w-5 text-accent-ink" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink">{alert.title}</h3>
            <span className="rounded-md border border-accent-ink/40 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-accent-ink">
              {alert.status === "active" ? "In effect" : alert.status === "upcoming" ? "Upcoming" : alert.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {istDateTime(alert.startsAt)} to {istDateTime(alert.endsAt)} (IST)
          </p>
          <p lang={htmlLang} className="mt-2 text-ink">
            {alert[lang]}
          </p>
          <div className="mt-3">
            <CopyForWhatsApp text={alert.whatsapp} />
          </div>
        </div>
      </div>
    </article>
  );
}

/** Active disruptions on the planner, with a language switch. */
export function DisruptionsBanner({ alerts }: { alerts: Alert[] }) {
  const [lang, setLang] = useState<Lang>("en");
  if (!alerts.length) return null;
  return (
    <section aria-labelledby="disruptions-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="disruptions-heading" className="flex items-center gap-2 font-semibold text-ink">
          <AlertIcon className="h-5 w-5 text-accent-ink" />
          Disruptions affecting service now
        </h2>
        <LanguageToggle value={lang} onChange={setLang} />
      </div>
      {alerts.map((a) => (
        <AlertItem key={a.id} alert={a} lang={lang} />
      ))}
    </section>
  );
}
