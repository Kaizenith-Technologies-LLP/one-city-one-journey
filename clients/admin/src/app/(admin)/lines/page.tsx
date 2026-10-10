"use client";

import { useEffect, useState } from "react";
import { api, qs } from "@/lib/api";
import type { Line, LineDetail, LineStop, Mode, Paged, Stop } from "@/lib/types";
import { MODE_KEYS, MODES } from "@/lib/modes";
import { Alert, Button, Drawer, Empty, Field, ModeBadge, PageHeader, StatusBadge, TableWrap, useLoad, useToast } from "@/components/ui";

export default function LinesPage() {
  const [mode, setMode] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const { toast, toastNode } = useToast();
  const { data, error, loading, reload } = useLoad(() => api<Line[]>(`/admin/lines${qs({ mode, status })}`), [mode, status]);

  const rows = (data ?? []).filter((l) => !q || [l.id, l.name, l.shortName].some((v) => v.toLowerCase().includes(q.toLowerCase())));

  async function toggle(l: Line) {
    const reason = l.active ? prompt(`Suspend ${l.name}? Optional reason:`, "Maintenance") : "";
    if (reason === null) return;
    try {
      await api(`/admin/lines/${encodeURIComponent(l.id)}/status`, { method: "POST", body: { active: !l.active, reason } });
      toast(l.active ? `${l.shortName} suspended: planner no longer routes on it` : `${l.shortName} resumed`);
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <>
      <PageHeader title="Lines & routes" subtitle="Stop order, frequency, speed and service status per line" actions={<Button variant="primary" onClick={() => setEditing("new")}>New line</Button>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Filter by name or id" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-[12rem]" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="">All modes</option>
          {MODE_KEYS.map((m) => <option key={m} value={m}>{MODES[m].label}</option>)}
        </select>
        <select className="input max-w-[12rem]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          <option value="active">Running</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <TableWrap>
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Line</th>
              <th className="th">Mode</th>
              <th className="th hidden md:table-cell">Route</th>
              <th className="th text-right">Stops</th>
              <th className="th hidden text-right sm:table-cell">Km</th>
              <th className="th hidden text-right sm:table-cell">Every</th>
              <th className="th">Status</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((l) => (
              <tr key={l.id} className={`hover:bg-slate-50 ${l.active ? "" : "bg-amber-50/40"}`}>
                <td className="td cursor-pointer" onClick={() => setEditing(l.id)}>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex min-w-9 justify-center rounded px-1.5 py-0.5 text-xs font-semibold text-white" style={{ background: l.color }}>{l.shortName}</span>
                    <div>
                      <div className="font-medium text-slate-900">{l.name}</div>
                      <div className="font-mono text-[11px] text-slate-400">{l.id}</div>
                    </div>
                  </div>
                </td>
                <td className="td"><ModeBadge mode={l.mode} /></td>
                <td className="td hidden text-xs md:table-cell">{l.from} &rarr; {l.to}</td>
                <td className="td text-right tabular-nums">{l.stopCount}</td>
                <td className="td hidden text-right tabular-nums sm:table-cell">{l.lengthKm}</td>
                <td className="td hidden text-right tabular-nums sm:table-cell">{l.headwayMin == null ? "not set" : `${l.headwayMin} min`}</td>
                <td className="td">
                  <StatusBadge status={l.active ? "active" : "suspended"} />
                  {l.suspendedReason && <div className="mt-0.5 max-w-[10rem] truncate text-[11px] text-slate-500" title={l.suspendedReason}>{l.suspendedReason}</div>}
                </td>
                <td className="td whitespace-nowrap text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(l.id)}>Edit</Button>
                  <Button size="sm" variant={l.active ? "danger" : "secondary"} onClick={() => toggle(l)}>{l.active ? "Suspend" : "Resume"}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty>{loading ? "Loading..." : "No lines match."}</Empty>}
      </TableWrap>
      {editing && (
        <LineDrawer
          key={editing}
          id={editing}
          onClose={() => setEditing(null)}
          onSaved={(msg, close) => {
            toast(msg);
            reload();
            if (close) setEditing(null);
          }}
        />
      )}
      {toastNode}
    </>
  );
}

type Form = { id: string; name: string; shortName: string; mode: Mode; operator: string; color: string; avgSpeedKmph: string; headwayMin: string; active: boolean; suspendedReason: string };

function LineDrawer({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: (msg: string, close: boolean) => void }) {
  const isNew = id === "new";
  const [form, setForm] = useState<Form>({ id: "", name: "", shortName: "", mode: "brts", operator: "", color: MODES.brts.color, avgSpeedKmph: "", headwayMin: "", active: true, suspendedReason: "" });
  const [stops, setStops] = useState<LineStop[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    api<LineDetail>(`/admin/lines/${encodeURIComponent(id)}`)
      .then((l) => {
        setForm({ id: l.id, name: l.name, shortName: l.shortName, mode: l.mode, operator: l.operator, color: l.color, avgSpeedKmph: l.avgSpeedKmph == null ? "" : String(l.avgSpeedKmph), headwayMin: l.headwayMin == null ? "" : String(l.headwayMin), active: l.active, suspendedReason: l.suspendedReason ?? "" });
        setStops(l.stops);
      })
      .catch((e) => setError(e.message));
  }, [id, isNew]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const move = (i: number, d: number) =>
    setStops((s) => {
      const n = [...s];
      [n[i], n[i + d]] = [n[i + d], n[i]];
      return n;
    });

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...(isNew && form.id ? { id: form.id } : {}),
        name: form.name,
        shortName: form.shortName,
        mode: form.mode,
        operator: form.operator || undefined,
        color: form.color,
        avgSpeedKmph: form.avgSpeedKmph ? Number(form.avgSpeedKmph) : undefined,
        headwayMin: form.headwayMin ? Number(form.headwayMin) : undefined,
        active: form.active,
        suspendedReason: form.active ? undefined : form.suspendedReason || undefined,
        stops: stops.map((s) => s.id),
      };
      await api(isNew ? "/admin/lines" : `/admin/lines/${encodeURIComponent(id)}`, { method: isNew ? "POST" : "PUT", body });
      onSaved(isNew ? "Line created" : "Line saved", true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete line ${form.name}? This cannot be undone.`)) return;
    try {
      await api(`/admin/lines/${encodeURIComponent(id)}`, { method: "DELETE" });
      onSaved("Line deleted", true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Drawer
      open
      title={isNew ? "New line" : `Edit ${form.name}`}
      onClose={onClose}
      footer={
        <>
          {!isNew && <Button variant="danger" className="mr-auto" onClick={remove}>Delete</Button>}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy || !form.name || stops.length < 2}>{busy ? "Saving..." : "Save line"}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Short name"><input className="input" value={form.shortName} onChange={(e) => set("shortName", e.target.value)} placeholder="e.g. 15, Blue" /></Field>
          <Field label="Mode">
            <select className="input" value={form.mode} disabled={!isNew} onChange={(e) => { const m = e.target.value as Mode; setForm((f) => ({ ...f, mode: m, color: MODES[m].color })); }}>
              {MODE_KEYS.map((m) => <option key={m} value={m}>{MODES[m].label}</option>)}
            </select>
          </Field>
          <Field label="Id" hint={isNew ? "Optional, auto-generated" : undefined}>
            <input className="input font-mono" value={form.id} disabled={!isNew} placeholder="auto" onChange={(e) => set("id", e.target.value)} />
          </Field>
          <Field label="Operator"><input className="input" value={form.operator} placeholder={MODES[form.mode].operator} onChange={(e) => set("operator", e.target.value)} /></Field>
          <Field label="Colour">
            <div className="flex gap-2">
              <input type="color" className="h-9 w-12 cursor-pointer rounded border border-slate-300" value={form.color} onChange={(e) => set("color", e.target.value.toUpperCase())} />
              <input className="input font-mono" value={form.color} onChange={(e) => set("color", e.target.value)} />
            </div>
          </Field>
          <Field label="Headway (min)"><input className="input" type="number" min={1} max={240} value={form.headwayMin} onChange={(e) => set("headwayMin", e.target.value)} /></Field>
          <Field label="Avg speed (km/h)"><input className="input" type="number" min={5} max={120} value={form.avgSpeedKmph} onChange={(e) => set("avgSpeedKmph", e.target.value)} /></Field>
        </div>

        <div className={`rounded-lg border p-3 ${form.active ? "border-slate-200" : "border-amber-300 bg-amber-50"}`}>
          <label className="flex items-center justify-between gap-2 text-sm font-medium text-slate-800">
            <span>{form.active ? "In service" : "Suspended: excluded from journey planning"}</span>
            <button
              type="button"
              role="switch"
              aria-checked={form.active}
              onClick={() => set("active", !form.active)}
              className={`relative h-6 w-11 rounded-full transition ${form.active ? "bg-emerald-500" : "bg-slate-300"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${form.active ? "left-5" : "left-0.5"}`} />
            </button>
          </label>
          {!form.active && <input className="input mt-2" placeholder="Reason (shown to staff)" value={form.suspendedReason} onChange={(e) => set("suspendedReason", e.target.value)} />}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Stops in order ({stops.length})</h3>
            {stops.length > 1 && <Button size="sm" variant="ghost" onClick={() => setStops((s) => [...s].reverse())}>Reverse</Button>}
          </div>
          <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {stops.map((s, i) => (
              <li key={`${s.id}-${i}`} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                <span className="w-6 text-right text-xs tabular-nums text-slate-400">{i + 1}</span>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2" style={{ borderColor: form.color }} />
                <span className={`flex-1 truncate ${s.missing ? "text-red-600" : "text-slate-800"}`}>
                  {s.name} <span className="font-mono text-[11px] text-slate-400">{s.id}</span>
                </span>
                {s.mode && s.mode !== form.mode && <ModeBadge mode={s.mode} />}
                <div className="flex shrink-0">
                  <button className="rounded px-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">&uarr;</button>
                  <button className="rounded px-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" disabled={i === stops.length - 1} onClick={() => move(i, 1)} aria-label="Move down">&darr;</button>
                  <button className="rounded px-1.5 text-red-500 hover:bg-red-50" onClick={() => setStops((st) => st.filter((_, k) => k !== i))} aria-label="Remove">&times;</button>
                </div>
              </li>
            ))}
            {!stops.length && <li className="px-3 py-3 text-xs text-slate-500">No stops yet. Add at least two below.</li>}
          </ol>
          <StopPicker mode={form.mode} onPick={(s) => setStops((st) => [...st, s])} />
        </div>
      </div>
    </Drawer>
  );
}

function StopPicker({ mode, onPick }: { mode: Mode; onPick: (s: LineStop) => void }) {
  const [q, setQ] = useState("");
  const [sameMode, setSameMode] = useState(true);
  const [results, setResults] = useState<Stop[]>([]);

  useEffect(() => {
    if (!q.trim()) return;
    const t = setTimeout(() => {
      api<Paged<Stop>>(`/admin/stops${qs({ q, mode: sameMode ? mode : undefined, limit: 8 })}`)
        .then((r) => setResults(r.items))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q, mode, sameMode]);

  const shown = q.trim() ? results : [];
  return (
    <div className="mt-3 rounded-lg border border-dashed border-slate-300 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <input className="input flex-1" placeholder="Search a station to append" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={sameMode} onChange={(e) => setSameMode(e.target.checked)} /> {MODES[mode].label} only
        </label>
      </div>
      {shown.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100 rounded border border-slate-200">
          {shown.map((s) => (
            <li key={s.id}>
              <button className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => { onPick({ id: s.id, name: s.name, mode: s.mode }); setQ(""); }}>
                <span>{s.name} <span className="font-mono text-[11px] text-slate-400">{s.id}</span></span>
                <ModeBadge mode={s.mode} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
