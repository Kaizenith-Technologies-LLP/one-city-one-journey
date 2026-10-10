"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Dashboard, OperatorRevenue } from "@/lib/types";
import { inr, modeColor } from "@/lib/modes";
import { Alert, Button, Card, Empty, ModeBadge, PageHeader, Stat, useLoad } from "@/components/ui";

/** Horizontal bars, one per operator, coloured by mode; direct value labels. */
function OperatorBars({ rows }: { rows: OperatorRevenue[] }) {
  const max = Math.max(1, ...rows.map((r) => r.net));
  if (!rows.length) return <Empty>No ticket revenue yet. Tickets issued from the app or website appear here.</Empty>;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.operator} className="group" title={`${r.operatorName}: ${inr(r.net, 2)} net from ${r.tickets} tickets, ${r.passengerKm} passenger-km`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 font-medium text-slate-800">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: modeColor(r.mode) }} />
              {r.operator}
              <span className="hidden text-xs font-normal text-slate-500 sm:inline">{r.operatorName}</span>
            </span>
            <span className="tabular-nums text-slate-700">
              {inr(r.net, 2)} <span className="text-xs text-slate-500">({r.sharePct}%)</span>
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-100">
            <div className="h-2.5 rounded-full transition-all group-hover:opacity-80" style={{ width: `${(r.net / max) * 100}%`, background: modeColor(r.mode), minWidth: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Daily net revenue columns (single series) with a hover tooltip. */
function DailyColumns({ rows }: { rows: Dashboard["daily"] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!rows.length) return <Empty>No tickets yet.</Empty>;
  const max = Math.max(1, ...rows.map((r) => r.revenue));
  const h = hover == null ? null : rows[hover];
  return (
    <div>
      <div className="mb-2 h-5 text-xs text-slate-600">{h ? `${h.date}: ${inr(h.revenue, 2)} from ${h.tickets} tickets` : "Hover a day for details"}</div>
      <div className="flex h-40 items-end gap-1 border-b border-slate-200">
        {rows.map((r, i) => (
          <div key={r.date} className="flex h-full flex-1 items-end justify-center" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div
              className="w-full max-w-8 rounded-t bg-brand transition-opacity"
              style={{ height: `${Math.max(2, (r.revenue / max) * 100)}%`, opacity: hover == null || hover === i ? 1 : 0.45 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 text-[10px] text-slate-500">
        {rows.map((r) => (
          <div key={r.date} className="flex-1 truncate text-center">{r.date.slice(5)}</div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: d, error, loading, reload } = useLoad(() => api<Dashboard>("/admin/dashboard"), []);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Network health and integrated-ticket revenue across Ahmedabad + Gandhinagar" actions={<Button onClick={reload} disabled={loading}>Refresh</Button>} />
      {error && <Alert>{error}</Alert>}
      {d && !d.dataLoaded && <div className="mb-4"><Alert>Transit data failed to load on the server. Planner and hubs are unavailable.</Alert></div>}
      {d && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Stations" value={d.counts.stops.toLocaleString()} hint={`${d.counts.platforms} platforms defined`} />
            <Stat label="Lines" value={d.counts.activeLines} hint={d.counts.suspendedLines ? `${d.counts.suspendedLines} suspended` : "All running"} accent={d.counts.suspendedLines ? "#f59e0b" : undefined} />
            <Stat label="Interchange hubs" value={d.counts.hubs} hint={Object.entries(d.hubTypes).map(([k, v]) => `${v} ${k}`).join(", ") || "-"} />
            <Stat label="Corridor overlaps" value={d.counts.corridorOverlaps} hint="Line pairs sharing hubs" />
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Revenue today" value={inr(d.tickets.revenueToday, 2)} hint={`${d.tickets.issuedToday} tickets issued today`} accent="#0f4c81" />
            <Stat label="Tickets issued" value={d.tickets.issued} hint={`${d.tickets.multiOperator} multi-operator`} />
            <Stat label="Active / used" value={`${d.tickets.active} / ${d.tickets.used}`} hint={`${d.tickets.expired} expired unused`} />
            <Stat label="Cancelled" value={d.tickets.cancelled} hint={`Net revenue all time ${inr(d.tickets.revenueTotal, 2)}`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card title="Revenue per operator (all tickets, net of refunds)" className="lg:col-span-3">
              <OperatorBars rows={d.revenueByOperator} />
              {d.tickets.commuterSavings > 0 && (
                <p className="mt-4 text-xs text-slate-500">Commuters saved {inr(d.tickets.commuterSavings)} versus buying separate tickets.</p>
              )}
            </Card>
            <Card title="Daily net revenue (last 14 days)" className="lg:col-span-2">
              <DailyColumns rows={d.daily} />
            </Card>
          </div>

          <Card title="Network by mode">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="th">Mode</th>
                    <th className="th">Operator</th>
                    <th className="th text-right">Stations</th>
                    <th className="th text-right">Lines</th>
                    <th className="th text-right">Suspended</th>
                    <th className="th text-right">Hubs served</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {d.modes.map((m) => (
                    <tr key={m.key}>
                      <td className="td"><ModeBadge mode={m.key}>{m.label}</ModeBadge></td>
                      <td className="td">{m.operator}</td>
                      <td className="td text-right tabular-nums">{m.stops}</td>
                      <td className="td text-right tabular-nums">{m.lines}</td>
                      <td className="td text-right tabular-nums">{m.suspendedLines || "-"}</td>
                      <td className="td text-right tabular-nums">{m.hubs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
