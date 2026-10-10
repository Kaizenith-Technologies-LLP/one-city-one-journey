"use client";

import { useEffect, useState } from "react";
import { api, qs } from "@/lib/api";
import type { Closure, ClosureType, Line, LineDetail, Paged, Stop } from "@/lib/types";
import { Alert, Button, Drawer, Empty, Field, PageHeader, StatusBadge, TableWrap, useLoad, useToast } from "@/components/ui";

const TYPE_LABEL: Record<ClosureType, string> = { line: "Whole line", section: "Line section", stop: "Stop / station" };
const LANGS = [
  ["en", "English"],
  ["gu", "ગુજરાતી"],
  ["hi", "हिन्दी"],
] as const;

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
/** ISO -> value for <input type="datetime-local"> in IST. */
const toLocalInput = (iso: string) => new Date(Date.parse(iso) + 330 * 60e3).toISOString().slice(0, 16);
const fromLocalInput = (v: string) => new Date(`${v}:00+05:30`).toISOString();

export default function ClosuresPage() {
  const [status, setStatus] = useState("");
  const { data, error, loading, reload } = useLoad(() => api<Closure[]>(`/admin/closures${qs({ status })}`), [status]);
  const [editing, setEditing] = useState<Closure | "new" | null>(null);
  const [viewing, setViewing] = useState<Closure | null>(null);

  return (
    <>
      <PageHeader
        title="Diversions & closures"
        subtitle="Close a line, a section or a stop for a time window. Journey planning routes around it, and advisories are generated in English, Gujarati and Hindi."
        actions={<Button variant="primary" onClick={() => setEditing("new")}>New closure</Button>}
      />
      <div className="mb-4 flex gap-2">
        {["", "active", "upcoming", "ended"].map((s) => (
          <Button key={s} size="sm" variant={status === s ? "primary" : "secondary"} onClick={() => setStatus(s)}>
            {s ? s[0].toUpperCase() + s.slice(1) : "All"}
          </Button>
        ))}
      </div>
      {error && <Alert>{error}</Alert>}
      <TableWrap>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Closure</th>
              <th className="th hidden sm:table-cell">Type</th>
              <th className="th">Window (IST)</th>
              <th className="th">Status</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody>
            {data?.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="td">
                  <div className="font-medium text-slate-900">{c.title}</div>
                  <div className="text-xs text-slate-500">{c.id} · affects {c.advisory.affectedLines.join(", ") || "no lines"}</div>
                </td>
                <td className="td hidden sm:table-cell">{TYPE_LABEL[c.type]}</td>
                <td className="td whitespace-nowrap text-sm">{fmt(c.startsAt)} → {fmt(c.endsAt)}</td>
                <td className="td"><StatusBadge status={c.status === "active" ? "suspended" : c.status === "upcoming" ? "active" : "expired"} /> <span className="text-xs capitalize text-slate-600">{c.status}</span></td>
                <td className="td text-right whitespace-nowrap">
                  <Button size="sm" onClick={() => setViewing(c)}>Advisory</Button> <Button size="sm" onClick={() => setEditing(c)}>Edit</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !data?.length && <Empty>No closures{status ? ` with status "${status}"` : ""}.</Empty>}
      </TableWrap>
      {viewing && <AdvisoryDrawer closure={viewing} onClose={() => setViewing(null)} />}
      {editing && (
        <ClosureDrawer
          closure={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function AdvisoryDrawer({ closure, onClose }: { closure: Closure; onClose: () => void }) {
  const { toast, toastNode } = useToast();
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied`);
    } catch {
      toast("Copy failed: select the text and copy it manually", "error");
    }
  };
  return (
    <Drawer open title={`Advisory: ${closure.title}`} onClose={onClose}>
      <div className="space-y-4">
        {LANGS.map(([key, label]) => (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between">
              <span className="label">{label}</span>
              <Button size="sm" variant="ghost" onClick={() => copy(closure.advisory[key], label)}>Copy</Button>
            </div>
            <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">{closure.advisory[key]}</p>
          </div>
        ))}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="label">WhatsApp message (all three languages)</span>
            <Button size="sm" variant="primary" onClick={() => copy(closure.advisory.whatsapp, "WhatsApp message")}>Copy for WhatsApp</Button>
          </div>
          <pre className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">{closure.advisory.whatsapp}</pre>
        </div>
        <div>
          <span className="label">Affected services</span>
          <p className="text-sm text-slate-700">{closure.advisory.affectedLines.join(", ") || "None"}</p>
        </div>
      </div>
      {toastNode}
    </Drawer>
  );
}

type Form = { type: ClosureType; title: string; reason: string; lineId: string; fromStopId: string; toStopId: string; stopId: string; startsAt: string; endsAt: string };

function ClosureDrawer({ closure, onClose, onSaved }: { closure: Closure | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Form>({
    type: closure?.type ?? "line",
    title: closure?.title ?? "",
    reason: closure?.reason ?? "",
    lineId: closure?.lineId ?? "",
    fromStopId: closure?.fromStopId ?? "",
    toStopId: closure?.toStopId ?? "",
    stopId: closure?.stopId ?? "",
    startsAt: closure ? toLocalInput(closure.startsAt) : "",
    endsAt: closure ? toLocalInput(closure.endsAt) : "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const lines = useLoad(() => api<Line[]>("/admin/lines"), []);
  const [lineStops, setLineStops] = useState<LineDetail["stops"]>([]);
  const [stopQuery, setStopQuery] = useState("");
  const stops = useLoad(() => api<Paged<Stop>>(`/admin/stops${qs({ q: stopQuery, limit: 20 })}`), [stopQuery]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (form.type !== "section" || !form.lineId) return;
    let alive = true;
    api<LineDetail>(`/admin/lines/${encodeURIComponent(form.lineId)}`)
      .then((l) => alive && setLineStops(l.stops))
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [form.type, form.lineId]);

  async function save() {
    if (!form.startsAt || !form.endsAt) return setErr("Start and end are required");
    setBusy(true);
    setErr(null);
    const body = {
      type: form.type,
      title: form.title,
      reason: form.reason,
      startsAt: fromLocalInput(form.startsAt),
      endsAt: fromLocalInput(form.endsAt),
      ...(form.type === "stop" ? { stopId: form.stopId } : { lineId: form.lineId }),
      ...(form.type === "section" ? { fromStopId: form.fromStopId, toStopId: form.toStopId } : {}),
    };
    try {
      await api(closure ? `/admin/closures/${closure.id}` : "/admin/closures", { method: closure ? "PUT" : "POST", body });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!closure || !confirm(`Delete closure "${closure.title}"? Journey planning will use the affected services again.`)) return;
    setBusy(true);
    try {
      await api(`/admin/closures/${closure.id}`, { method: "DELETE" });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Drawer
      open
      title={closure ? `Edit ${closure.id}` : "New closure"}
      onClose={onClose}
      footer={
        <>
          {closure && <Button variant="danger" onClick={remove} disabled={busy}>Delete</Button>}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy}>{busy ? "Saving..." : "Save closure"}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {err && <Alert>{err}</Alert>}
        <Field label="What is closed">
          <select className="input" value={form.type} onChange={(e) => set("type", e.target.value as ClosureType)}>
            {(Object.keys(TYPE_LABEL) as ClosureType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </Field>
        <Field label="Title" hint="Shown to commuters, e.g. “Blue line: Old High Court–Kankaria East closed”">
          <input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Reason" hint="Included in every advisory as written">
          <input className="input" value={form.reason} onChange={(e) => set("reason", e.target.value)} />
        </Field>
        {form.type !== "stop" && (
          <Field label="Line">
            <select className="input" value={form.lineId} onChange={(e) => set("lineId", e.target.value)}>
              <option value="">Select a line</option>
              {lines.data?.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.id})</option>)}
            </select>
          </Field>
        )}
        {form.type === "section" && form.lineId && (
          <div className="grid grid-cols-2 gap-3">
            {(["fromStopId", "toStopId"] as const).map((k) => (
              <Field key={k} label={k === "fromStopId" ? "From stop" : "To stop"}>
                <select className="input" value={form[k]} onChange={(e) => set(k, e.target.value)}>
                  <option value="">Select</option>
                  {lineStops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            ))}
          </div>
        )}
        {form.type === "stop" && (
          <Field label="Stop / station" hint={form.stopId ? `Selected: ${form.stopId}` : undefined}>
            <input className="input mb-2" placeholder="Search stops" value={stopQuery} onChange={(e) => setStopQuery(e.target.value)} />
            <select className="input" size={6} value={form.stopId} onChange={(e) => set("stopId", e.target.value)}>
              {stops.data?.items.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.mode} ({s.id})</option>)}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts (IST)"><input className="input" type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></Field>
          <Field label="Ends (IST)"><input className="input" type="datetime-local" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} /></Field>
        </div>
      </div>
    </Drawer>
  );
}
