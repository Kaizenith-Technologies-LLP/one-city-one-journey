"use client";

import { useEffect, useState } from "react";
import { api, ApiError, qs } from "@/lib/api";
import type { Mode, Paged, Platform, Stop, StopDetail } from "@/lib/types";
import { MODE_KEYS, MODES } from "@/lib/modes";
import { Alert, Button, Drawer, Empty, Field, ModeBadge, PageHeader, Pager, TableWrap, useLoad, useToast } from "@/components/ui";

const LIMIT = 50;
type Form = { id: string; name: string; mode: Mode; lat: string; lng: string; approx: boolean };
const blank: Form = { id: "", name: "", mode: "metro", lat: "", lng: "", approx: false };

export default function StationsPage() {
  const [mode, setMode] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const { toast, toastNode } = useToast();

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q);
      setOffset(0);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data, error, loading, reload } = useLoad(() => api<Paged<Stop>>(`/admin/stops${qs({ mode, q: query, limit: LIMIT, offset })}`), [mode, query, offset]);

  return (
    <>
      <PageHeader title="Stations" subtitle="Stops for every mode. Edits apply to the live planner immediately." actions={<Button variant="primary" onClick={() => setEditing("new")}>New station</Button>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search name or id" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-[12rem]" value={mode} onChange={(e) => { setMode(e.target.value); setOffset(0); }}>
          <option value="">All modes</option>
          {MODE_KEYS.map((m) => <option key={m} value={m}>{MODES[m].label}</option>)}
        </select>
      </div>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <TableWrap>
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Name</th>
              <th className="th">Mode</th>
              <th className="th hidden md:table-cell">Id</th>
              <th className="th hidden sm:table-cell">Location</th>
              <th className="th">Lines</th>
              <th className="th hidden sm:table-cell">Platforms</th>
              <th className="th hidden lg:table-cell">Hub</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.items.map((s) => (
              <tr key={s.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setEditing(s.id)}>
                <td className="td font-medium text-slate-900">{s.name}{s.approx && <span className="ml-1.5 text-xs text-amber-600" title="Approximate location">~</span>}</td>
                <td className="td"><ModeBadge mode={s.mode} /></td>
                <td className="td hidden font-mono text-xs md:table-cell">{s.id}</td>
                <td className="td hidden font-mono text-xs sm:table-cell">{s.lat.toFixed(4)}, {s.lng.toFixed(4)}</td>
                <td className="td">{s.lines.length ? <span className="text-xs">{s.lines.length} line{s.lines.length > 1 ? "s" : ""}</span> : <span className="text-xs text-amber-600">unused</span>}</td>
                <td className="td hidden sm:table-cell">{s.platformCount || "-"}</td>
                <td className="td hidden font-mono text-xs lg:table-cell">{s.hubId ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && !data.items.length && <Empty>{loading ? "Loading..." : "No stations match."}</Empty>}
        {data && <Pager total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />}
      </TableWrap>

      {editing && (
        <StationDrawer
          id={editing}
          onClose={() => setEditing(null)}
          onSaved={(msg, id) => {
            toast(msg);
            reload();
            setEditing(id);
          }}
        />
      )}
      {toastNode}
    </>
  );
}

function StationDrawer({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: (msg: string, id: string | null) => void }) {
  const isNew = id === "new";
  const [form, setForm] = useState<Form>(blank);
  const [detail, setDetail] = useState<StopDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forceAsk, setForceAsk] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    api<StopDetail>(`/admin/stops/${encodeURIComponent(id)}`)
      .then((s) => {
        setDetail(s);
        setForm({ id: s.id, name: s.name, mode: s.mode, lat: String(s.lat), lng: String(s.lng), approx: s.approx });
      })
      .catch((e) => setError(e.message));
  }, [id, isNew]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = { name: form.name, mode: form.mode, lat: Number(form.lat), lng: Number(form.lng), approx: form.approx, ...(isNew && form.id ? { id: form.id } : {}) };
      const s = await api<{ id: string }>(isNew ? "/admin/stops" : `/admin/stops/${encodeURIComponent(id)}`, { method: isNew ? "POST" : "PUT", body });
      onSaved(isNew ? "Station created" : "Station saved", s.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(force = false) {
    if (!force && !confirm(`Delete station ${form.name}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ removedFromLines: string[] }>(`/admin/stops/${encodeURIComponent(id)}${force ? "?force=1" : ""}`, { method: "DELETE" });
      onSaved(r.removedFromLines.length ? `Deleted and removed from ${r.removedFromLines.length} line(s)` : "Station deleted", null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && !force && /force/.test(e.message)) setForceAsk(e.message);
      else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open
      title={isNew ? "New station" : form.name || id}
      onClose={onClose}
      footer={
        <>
          {!isNew && <Button variant="danger" onClick={() => remove()} disabled={busy} className="mr-auto">Delete</Button>}
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={save} disabled={busy || !form.name || !form.lat || !form.lng}>{busy ? "Saving..." : "Save"}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}
        {forceAsk && (
          <Alert>
            <p>{forceAsk}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="danger" onClick={() => { setForceAsk(null); void remove(true); }}>Force delete</Button>
              <Button size="sm" onClick={() => setForceAsk(null)}>Keep it</Button>
            </div>
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Mode">
            <select className="input" value={form.mode} disabled={!isNew} onChange={(e) => set("mode", e.target.value as Mode)}>
              {MODE_KEYS.map((m) => <option key={m} value={m}>{MODES[m].label}</option>)}
            </select>
          </Field>
          <Field label="Id" hint={isNew ? "Optional. Defaults to mode-name." : "Ids are permanent; lines reference them."}>
            <input className="input font-mono" value={form.id} disabled={!isNew} placeholder="auto" onChange={(e) => set("id", e.target.value)} />
          </Field>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.approx} onChange={(e) => set("approx", e.target.checked)} /> Location is approximate
            </label>
          </div>
          <Field label="Latitude" hint="22.90 to 23.35"><input className="input font-mono" inputMode="decimal" value={form.lat} onChange={(e) => set("lat", e.target.value)} /></Field>
          <Field label="Longitude" hint="72.40 to 72.80"><input className="input font-mono" inputMode="decimal" value={form.lng} onChange={(e) => set("lng", e.target.value)} /></Field>
        </div>
        {form.lat && form.lng && (
          <a className="text-xs text-brand underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${form.lat}&mlon=${form.lng}#map=17/${form.lat}/${form.lng}`}>
            View on OpenStreetMap
          </a>
        )}

        {detail && (
          <>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Lines serving this station</h3>
              {detail.lines.length ? (
                <div className="flex flex-wrap gap-2">
                  {detail.lines.map((l) => (
                    <span key={l.id} className="inline-flex items-center gap-1.5 rounded border border-slate-200 px-2 py-1 text-xs">
                      <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                      {l.shortName ?? l.name}
                      {!l.active && <span className="text-amber-600">(suspended)</span>}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No lines use this station.</p>
              )}
              {detail.hubId && <p className="mt-2 text-xs text-slate-500">Part of interchange hub <span className="font-mono">{detail.hubId}</span>.</p>}
            </div>
            <PlatformsEditor stopId={detail.id} lines={detail.lines} initial={detail.platforms} />
          </>
        )}
      </div>
    </Drawer>
  );
}

type PForm = { id?: string; name: string; lineIds: string[]; direction: string; accessible: boolean };

function PlatformsEditor({ stopId, lines, initial }: { stopId: string; lines: StopDetail["lines"]; initial: Platform[] }) {
  const [items, setItems] = useState<Platform[]>(initial);
  const [edit, setEdit] = useState<PForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = `/admin/stops/${encodeURIComponent(stopId)}/platforms`;

  async function save() {
    if (!edit) return;
    setError(null);
    try {
      const body = { name: edit.name, lineIds: edit.lineIds, direction: edit.direction, accessible: edit.accessible };
      if (edit.id) await api(`${base}/${encodeURIComponent(edit.id)}`, { method: "PUT", body });
      else await api(base, { method: "POST", body });
      setItems(await api<Platform[]>(base));
      setEdit(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(pid: string) {
    if (!confirm("Delete this platform?")) return;
    try {
      await api(`${base}/${encodeURIComponent(pid)}`, { method: "DELETE" });
      setItems(await api<Platform[]>(base));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const lineName = (id: string) => lines.find((l) => l.id === id)?.shortName ?? id;

  return (
    <div className="rounded-lg border border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <h3 className="text-sm font-semibold text-slate-800">Platforms</h3>
        {!edit && <Button size="sm" onClick={() => setEdit({ name: `Platform ${items.length + 1}`, lineIds: [], direction: "", accessible: true })}>Add platform</Button>}
      </div>
      <div className="space-y-2 p-3">
        {error && <Alert>{error}</Alert>}
        {!items.length && !edit && <p className="text-xs text-slate-500">No platforms defined. Platforms are optional.</p>}
        {items.map((p) => (
          <div key={p.id} className="flex items-start justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
            <div>
              <div className="font-medium text-slate-800">
                {p.name} <span className="font-mono text-xs text-slate-400">{p.id}</span>
                {p.accessible && <span className="ml-2 rounded bg-emerald-100 px-1.5 text-[11px] text-emerald-800">step-free</span>}
              </div>
              <div className="text-xs text-slate-500">
                {p.direction || "Any direction"} · {p.lineIds.length ? p.lineIds.map(lineName).join(", ") : "no lines assigned"}
              </div>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEdit({ ...p })}>Edit</Button>
              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(p.id)}>Delete</Button>
            </div>
          </div>
        ))}
        {edit && (
          <div className="space-y-3 rounded-md border border-brand/30 bg-brand/5 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Platform name"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="Direction"><input className="input" placeholder="e.g. towards Thaltej" value={edit.direction} onChange={(e) => setEdit({ ...edit, direction: e.target.value })} /></Field>
            </div>
            <div>
              <span className="label">Lines boarding here</span>
              {lines.length ? (
                <div className="flex flex-wrap gap-3">
                  {lines.map((l) => (
                    <label key={l.id} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={edit.lineIds.includes(l.id)}
                        onChange={(e) => setEdit({ ...edit, lineIds: e.target.checked ? [...edit.lineIds, l.id] : edit.lineIds.filter((x) => x !== l.id) })}
                      />
                      {l.shortName ?? l.name}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No lines serve this station yet.</p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.accessible} onChange={(e) => setEdit({ ...edit, accessible: e.target.checked })} /> Step-free / wheelchair accessible
            </label>
            <div className="flex justify-end gap-2">
              <Button size="sm" onClick={() => setEdit(null)}>Cancel</Button>
              <Button size="sm" variant="primary" onClick={save} disabled={!edit.name}>Save platform</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
