"use client";

import { useState } from "react";
import { api, qs } from "@/lib/api";
import type { Brief } from "@/lib/types";
import { inr, modeColor } from "@/lib/modes";
import { Alert, Button, Card, Empty, ModeBadge, PageHeader, Stat, TableWrap, useLoad } from "@/components/ui";

const SEVERITY: Record<string, string> = {
  high: "border-red-200 bg-red-50 text-red-900",
  medium: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-slate-200 bg-slate-50 text-slate-800",
};

function Change({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-400">n/a</span>;
  const c = value <= -25 ? "text-red-700" : value >= 25 ? "text-emerald-700" : "text-slate-600";
  return <span className={`tabular-nums ${c}`}>{value > 0 ? "+" : ""}{value}%</span>;
}

/** One-page daily brief across all operators (PS-13), printable. */
export default function BriefPage() {
  // Empty date lets the server pick yesterday (IST).
  const [date, setDate] = useState("");
  const { data, error, loading } = useLoad(() => api<Brief>(`/admin/brief${qs({ date: date || undefined })}`), [date]);

  return (
    <>
      <PageHeader
        title="Morning brief"
        subtitle="Tickets and revenue per operator against the previous 7 days, with the exceptions worth a look and recorded events that may explain them."
        actions={
          <>
            <input className="input w-auto" type="date" value={date || data?.date || ""} onChange={(e) => setDate(e.target.value)} />
            <Button onClick={() => window.print()}>Print</Button>
          </>
        }
      />
      {error && <Alert>{error}</Alert>}
      {loading && !data && <Empty>Building brief...</Empty>}
      {data && (
        <div className="space-y-6">
          <Card>
            <p className="text-base font-medium text-slate-900">{data.headline}</p>
            <p className="mt-1 text-xs text-slate-500">
              {data.date} · generated {new Date(data.generatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
              {data.weather && ` · weather: max ${data.weather.maxTempC} °C (feels ${data.weather.maxFeelsLikeC} °C), rain ${data.weather.precipMm} mm, source ${data.weather.source}`}
            </p>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Tickets" value={data.totals.tickets} hint={`7-day avg ${data.totals.avgTickets}`} />
            <Stat label="Net revenue" value={inr(data.totals.net)} hint={`7-day avg ${inr(data.totals.avgNet)}`} />
            <Stat label="Across operators" value={data.totals.multiOperator} hint="journeys using 2+ operators" />
            <Stat label="Cancelled" value={data.totals.cancelled} hint={`${inr(data.totals.refunds)} refunded`} />
          </div>

          <Card title={`Exceptions (${data.exceptions.length})`}>
            {data.exceptions.length ? (
              <ul className="space-y-3">
                {data.exceptions.map((e, i) => (
                  <li key={i} className={`rounded-lg border p-3 ${SEVERITY[e.severity]}`}>
                    <div className="text-sm font-semibold">{e.title}</div>
                    <div className="text-sm">{e.detail}</div>
                    {e.possibleCauses.length > 0 && (
                      <div className="mt-1 text-xs">
                        <span className="font-medium">Possible causes: </span>
                        {e.possibleCauses.join("; ")}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Nothing unusual on this day.</Empty>
            )}
          </Card>

          <Card title="By operator">
            {data.operators.length ? (
              <TableWrap>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="th">Operator</th>
                      <th className="th text-right">Tickets</th>
                      <th className="th text-right">vs avg</th>
                      <th className="th text-right">Revenue</th>
                      <th className="th text-right">vs avg</th>
                      <th className="th hidden text-right sm:table-cell">Passenger-km</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.operators.map((o) => (
                      <tr key={o.operator} className="border-t border-slate-100">
                        <td className="td"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: modeColor(o.mode) }} />{o.operatorName} <ModeBadge mode={o.mode} /></td>
                        <td className="td text-right tabular-nums">{o.tickets}</td>
                        <td className="td text-right"><Change value={o.ticketsChangePct} /></td>
                        <td className="td text-right tabular-nums">{inr(o.revenue, 2)}</td>
                        <td className="td text-right"><Change value={o.revenueChangePct} /></td>
                        <td className="td hidden text-right tabular-nums sm:table-cell">{o.passengerKm}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            ) : (
              <Empty>No ticket activity in this period.</Empty>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Closures on this day">
              {data.events.closures.length ? (
                <ul className="space-y-1 text-sm">{data.events.closures.map((c) => <li key={c.id}>{c.title} <span className="text-xs text-slate-500">({c.id})</span></li>)}</ul>
              ) : (
                <Empty>None.</Empty>
              )}
            </Card>
            <Card title="Network and fare changes">
              {data.events.adminChanges.length ? (
                <ul className="space-y-1 text-sm">
                  {data.events.adminChanges.map((e, i) => (
                    <li key={i}>
                      <span className="text-xs text-slate-500">{new Date(e.at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}</span> {e.action} {e.entity} {e.entityId}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>None.</Empty>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
