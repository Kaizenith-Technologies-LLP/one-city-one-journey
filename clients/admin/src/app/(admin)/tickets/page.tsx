"use client";

import { useEffect, useState } from "react";
import { api, qs } from "@/lib/api";
import type { OperatorRevenue, Paged, Ticket } from "@/lib/types";
import { dateTime, inr, modeColor, OPERATORS, todayIST } from "@/lib/modes";
import { Alert, Button, Card, Drawer, Empty, ModeBadge, PageHeader, Pager, StatusBadge, TableWrap, useLoad, useToast } from "@/components/ui";

const LIMIT = 25;

type Report = { totals: { tickets: number; gross: number; refunds: number; net: number }; operators: OperatorRevenue[] };

export default function TicketsPage() {
  const [status, setStatus] = useState("");
  const [operator, setOperator] = useState("");
  const [date, setDate] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<Ticket | null>(null);
  const [scan, setScan] = useState("");
  const { toast, toastNode } = useToast();

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q);
      setOffset(0);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const filters = { status, operator, date, q: query };
  const { data, error, loading, reload } = useLoad(() => api<Paged<Ticket>>(`/admin/tickets${qs({ ...filters, limit: LIMIT, offset })}`), [status, operator, date, query, offset]);
  const report = useLoad(() => api<Report>(`/admin/reports/revenue${qs({ from: date, to: date })}`), [date]);

  const refresh = () => {
    reload();
    report.reload();
  };

  async function act(t: Ticket, action: "validate" | "cancel") {
    let body: object | undefined;
    if (action === "cancel") {
      const reason = prompt(`Cancel ${t.id} and refund ${inr(t.fare)}? Reason:`, "Passenger request");
      if (reason === null) return;
      body = { reason };
    }
    try {
      const updated = await api<Ticket>(`/admin/tickets/${t.id}/${action}`, { method: "POST", body });
      setOpen(updated);
      toast(action === "validate" ? `${t.id} marked as used` : `${t.id} cancelled, ${inr(updated.refundAmount)} refunded`);
      refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function scanQr() {
    try {
      const t = await api<Ticket>("/admin/tickets/scan", { method: "POST", body: { qr: scan } });
      toast(`${t.id} validated from QR`);
      setScan("");
      setOpen(t);
      refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const setFilter = (fn: (v: string) => void) => (v: string) => {
    fn(v);
    setOffset(0);
  };

  return (
    <>
      <PageHeader title="Tickets" subtitle="Integrated tickets issued by the app and website" actions={<Button onClick={refresh}>Refresh</Button>} />

      {report.data && (
        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          <Card title={date ? `Revenue on ${date}` : "Revenue (all time)"}>
            <div className="text-2xl font-semibold tabular-nums">{inr(report.data.totals.net, 2)}</div>
            <div className="mt-1 text-xs text-slate-500">{report.data.totals.tickets} tickets · gross {inr(report.data.totals.gross)} · refunds {inr(report.data.totals.refunds)}</div>
          </Card>
          <Card title="Settlement by operator" className="lg:col-span-2">
            {report.data.operators.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {report.data.operators.map((o) => (
                  <div key={o.operator} className="rounded-lg border border-slate-200 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600"><span className="h-2 w-2 rounded-full" style={{ background: modeColor(o.mode) }} />{o.operator}</div>
                    <div className="text-lg font-semibold tabular-nums">{inr(o.net, 2)}</div>
                    <div className="text-[11px] text-slate-500">{o.tickets} tickets · {o.sharePct}%</div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>No revenue for this period.</Empty>
            )}
          </Card>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className="input max-w-[14rem]" placeholder="Ticket id or place" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-[10rem]" value={status} onChange={(e) => setFilter(setStatus)(e.target.value)}>
          <option value="">Any status</option>
          {["active", "used", "expired", "cancelled"].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select className="input max-w-[10rem]" value={operator} onChange={(e) => setFilter(setOperator)(e.target.value)}>
          <option value="">Any operator</option>
          {OPERATORS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <input className="input max-w-[11rem]" type="date" value={date} onChange={(e) => setFilter(setDate)(e.target.value)} />
        <Button size="sm" variant="ghost" onClick={() => setFilter(setDate)(todayIST())}>Today</Button>
        {(status || operator || date || q) && <Button size="sm" variant="ghost" onClick={() => { setStatus(""); setOperator(""); setDate(""); setQ(""); setOffset(0); }}>Clear</Button>}
        <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
          <input className="input font-mono text-xs sm:w-64" placeholder="Paste QR payload to validate" value={scan} onChange={(e) => setScan(e.target.value)} />
          <Button onClick={scanQr} disabled={!scan.trim()}>Validate QR</Button>
        </div>
      </div>

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <TableWrap>
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Ticket</th>
              <th className="th">Journey</th>
              <th className="th hidden md:table-cell">Modes</th>
              <th className="th text-right">Fare</th>
              <th className="th">Status</th>
              <th className="th hidden sm:table-cell">Issued</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.items.map((t) => (
              <tr key={t.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(t)}>
                <td className="td font-mono text-xs font-semibold text-slate-900">{t.id}</td>
                <td className="td">
                  <div className="max-w-[18rem] truncate text-sm">{t.from.name} &rarr; {t.to.name}</div>
                  <div className="text-[11px] text-slate-500">{t.distanceKm} km · {t.totalMin} min · {t.transfers} transfer{t.transfers === 1 ? "" : "s"}</div>
                </td>
                <td className="td hidden md:table-cell"><div className="flex flex-wrap gap-1">{t.modes.map((m) => <ModeBadge key={m} mode={m} />)}</div></td>
                <td className="td text-right font-medium tabular-nums">{inr(t.fare)}</td>
                <td className="td"><StatusBadge status={t.status} /></td>
                <td className="td hidden whitespace-nowrap text-xs sm:table-cell">{dateTime(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && !data.items.length && <Empty>{loading ? "Loading..." : "No tickets match."}</Empty>}
        {data && <Pager total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />}
      </TableWrap>

      <Drawer
        open={!!open}
        title={open ? <span className="font-mono">{open.id}</span> : ""}
        onClose={() => setOpen(null)}
        footer={
          open && (
            <>
              <Button variant="danger" disabled={open.status === "used" || open.status === "cancelled"} onClick={() => act(open, "cancel")}>Cancel & refund</Button>
              <Button variant="primary" disabled={open.status !== "active"} onClick={() => act(open, "validate")}>Mark as used</Button>
            </>
          )
        }
      >
        {open && <TicketDetail t={open} />}
      </Drawer>
      {toastNode}
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-slate-500">{k}</span>
      <span className="text-right text-slate-800">{v}</span>
    </div>
  );
}

function TicketDetail({ t }: { t: Ticket }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <StatusBadge status={t.status} />
        <span className="text-2xl font-semibold tabular-nums">{inr(t.fare)}</span>
      </div>
      <div>
        <Row k="From" v={t.from.name} />
        <Row k="To" v={t.to.name} />
        <Row k="Issued" v={`${dateTime(t.createdAt)} via ${t.channel}`} />
        <Row k="Valid until" v={dateTime(t.validUntil)} />
        {t.usedAt && <Row k="Used" v={`${dateTime(t.usedAt)}${t.validatedBy ? ` (${t.validatedBy})` : ""}`} />}
        {t.cancelledAt && <Row k="Cancelled" v={`${dateTime(t.cancelledAt)}, refund ${inr(t.refundAmount)}${t.cancelReason ? `: ${t.cancelReason}` : ""}`} />}
        <Row k="Trip" v={`${t.distanceKm} km · ${t.totalMin} min · ${t.transfers} transfers`} />
        {t.savings > 0 && <Row k="Separate tickets" v={<span>{inr(t.standaloneFare)} <span className="text-emerald-700">(saved {inr(t.savings)}, {t.discountPct}% off)</span></span>} />}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Legs</h3>
        <ol className="space-y-2">
          {t.legs.map((l, i) => (
            <li key={i} className="flex gap-3 rounded-lg border border-slate-200 p-2.5">
              <span className="mt-0.5 inline-flex h-6 min-w-9 items-center justify-center rounded px-1.5 text-xs font-semibold text-white" style={{ background: l.color }}>{l.line}</span>
              <div className="text-sm">
                <div className="text-slate-800">{l.from} &rarr; {l.to}</div>
                <div className="text-xs text-slate-500">{l.lineName} · {l.operator} · {l.stops} stops · {l.distanceKm} km</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Revenue split</h3>
        <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
          {t.split.map((s, i) => <div key={s.operator} style={{ width: `${s.sharePct}%`, background: modeColor(s.mode), marginLeft: i ? 2 : 0 }} title={`${s.operator} ${s.sharePct}%`} />)}
        </div>
        <table className="mt-2 w-full">
          <tbody>
            {t.split.map((s) => (
              <tr key={s.operator} className="text-sm">
                <td className="py-1"><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: modeColor(s.mode) }} />{s.operator} <span className="text-xs text-slate-500">{s.operatorName}</span></td>
                <td className="py-1 text-right tabular-nums text-slate-500">{s.km} km</td>
                <td className="py-1 text-right tabular-nums text-slate-500">{s.sharePct}%</td>
                <td className="py-1 text-right font-medium tabular-nums">{inr(s.amount, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-[11px] text-slate-400">{t.splitMethod}</p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">QR payload</h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void navigator.clipboard?.writeText(t.qr);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-slate-900 p-3 font-mono text-xs text-emerald-300">{t.qr}</pre>
        <p className="mt-1 text-[11px] text-slate-400">Format: OJ1|id|from|to|fare|validUntil(epoch)|signature. Validators check the HMAC signature.</p>
      </div>
    </div>
  );
}
