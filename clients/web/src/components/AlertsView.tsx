"use client";

import { useState } from "react";
import { useApi } from "@/lib/api";
import type { Alert, Lang } from "@/lib/types";
import { AlertItem, LanguageToggle } from "./Alerts";
import { ErrorState, Loading, Notice } from "./ui";

export default function AlertsView() {
  const { data, error, reload } = useApi<Alert[]>("/closures");
  const [lang, setLang] = useState<Lang>("en");

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading label="Loading service alerts" />;

  const active = data.filter((a) => a.status === "active");
  const upcoming = data.filter((a) => a.status !== "active");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Alerts are published in English, Gujarati and Hindi.</p>
        <LanguageToggle value={lang} onChange={setLang} />
      </div>
      {!data.length ? (
        <Notice tone="success" title="No service alerts">
          There are no current or planned closures.
        </Notice>
      ) : null}
      {active.length ? (
        <section aria-labelledby="active-heading" className="space-y-3">
          <h2 id="active-heading" className="text-lg font-bold">
            In effect now
          </h2>
          {active.map((a) => (
            <AlertItem key={a.id} alert={a} lang={lang} />
          ))}
        </section>
      ) : null}
      {upcoming.length ? (
        <section aria-labelledby="upcoming-heading" className="space-y-3">
          <h2 id="upcoming-heading" className="text-lg font-bold">
            Planned
          </h2>
          {upcoming.map((a) => (
            <AlertItem key={a.id} alert={a} lang={lang} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
