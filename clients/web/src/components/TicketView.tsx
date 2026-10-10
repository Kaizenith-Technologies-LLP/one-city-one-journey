"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useApi } from "@/lib/api";
import { istDateTime, modeLabel, rupees } from "@/lib/format";
import type { Ticket } from "@/lib/types";
import { ArrowLeftIcon, ChevronRightIcon, ClockIcon, ModeIcon, RefreshIcon } from "./icons";
import TicketStatusBadge from "./TicketStatus";
import { Card, ErrorState, Loading, Notice, btn } from "./ui";

/** Current time, updated every second. Null until mounted so prerendered HTML never depends on the clock. */
function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  return now;
}

function Countdown({ until }: { until: string }) {
  const now = useNow();
  if (now === null) return <span className="text-muted">Checking validity…</span>;
  const left = Math.floor((Date.parse(until) - now) / 1000);
  if (left <= 0) return <span>Validity has ended</span>;
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  return (
    <span className="tabular-nums">
      {h > 0 ? `${h} h ` : ""}
      {m} min {String(s).padStart(2, "0")} s left
    </span>
  );
}

export default function TicketView() {
  const { id } = useParams<{ id: string }>();
  const code = decodeURIComponent(id ?? "").toUpperCase();
  const { data: t, error, loading, reload } = useApi<Ticket>(code ? `/tickets/${encodeURIComponent(code)}` : null);

  const back = (
    <Link href="/tickets" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline">
      <ArrowLeftIcon className="h-4 w-4" />
      My tickets
    </Link>
  );

  if (error && !t)
    return (
      <div>
        {back}
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  if (!t) return <Loading label="Loading ticket" />;

  return (
    <div className="mx-auto max-w-2xl">
      {back}
      <Card className="overflow-hidden p-0 sm:p-0">
        <div className="bg-brand px-5 py-6 text-on-brand">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium uppercase tracking-wide opacity-90">Integrated ticket</p>
            <span className="rounded-full bg-card p-0.5">
              <TicketStatusBadge status={t.status} />
            </span>
          </div>
          <p className="mt-3 font-mono text-4xl font-bold tracking-widest sm:text-5xl" aria-label={`Ticket code ${t.id.split("").join(" ")}`}>
            {t.id}
          </p>
          <p className="mt-2 text-lg font-semibold">
            {t.from.name} to {t.to.name}
          </p>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 font-medium" aria-live="off">
              <ClockIcon className="h-5 w-5 text-brand" />
              {t.status === "active" ? <Countdown until={t.validUntil} /> : <span>Valid until {istDateTime(t.validUntil)} (IST)</span>}
            </p>
            <button type="button" onClick={reload} disabled={loading} className={`${btn.secondary} py-1.5 text-sm`}>
              <RefreshIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh status
            </button>
          </div>
          {error ? <p className="text-sm text-accent-ink">{error}</p> : null}

          {t.status === "active" ? (
            <Notice title="Payment at counter, online payment coming soon">Nothing has been charged online. You pay {rupees(t.fare)} at the counter.</Notice>
          ) : null}

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">QR payload</h2>
            <p className="mt-1 break-all rounded-lg border border-line bg-surface p-3 font-mono text-sm">{t.qr}</p>
            <p className="mt-1 text-xs text-muted">Validators read this signed text from the ticket QR code.</p>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Route</h2>
            <ol className="mt-2 space-y-2">
              {t.legs.map((l, i) => (
                <li key={i} className="flex items-start gap-3 rounded-lg border border-line p-3">
                  <ModeIcon mode={l.mode} className="mt-0.5 h-5 w-5 text-brand" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold">
                      {modeLabel(l.mode)} {l.line}
                    </p>
                    <p className="flex flex-wrap items-center gap-1">
                      {l.departTime} {l.from}
                      <ChevronRightIcon className="h-4 w-4 text-muted" />
                      {l.arriveTime} {l.to}
                    </p>
                    <p className="text-muted">
                      {l.stops} {l.stops === 1 ? "stop" : "stops"}, {l.distanceKm.toFixed(1)} km
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <dl className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
            <div>
              <dt className="text-muted">Fare</dt>
              <dd className="text-lg font-bold">{rupees(t.fare)}</dd>
            </div>
            {t.savings > 0 ? (
              <div>
                <dt className="text-muted">You save</dt>
                <dd className="text-lg font-bold">{rupees(t.savings)}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted">Booked</dt>
              <dd>{istDateTime(t.createdAt)} IST</dd>
            </div>
            <div>
              <dt className="text-muted">Valid until</dt>
              <dd>{istDateTime(t.validUntil)} IST</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted">Operators</dt>
              <dd>{t.split.map((s) => `${s.operatorName} ${rupees(s.amount)}`).join(", ")}</dd>
            </div>
          </dl>
        </div>
      </Card>
    </div>
  );
}
