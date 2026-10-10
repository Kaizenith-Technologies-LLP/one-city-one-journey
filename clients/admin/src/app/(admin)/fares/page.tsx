"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { FareTable, Mode, Slab } from "@/lib/types";
import { inr, MODE_KEYS } from "@/lib/modes";
import { Alert, Button, Card, PageHeader, useLoad, useToast } from "@/components/ui";

type Row = { uptoKm: string; fare: string };

/** Client-side mirror of the server rules, so errors show before saving. */
function problems(rows: Row[]): string | null {
  if (!rows.length) return "Add at least one slab";
  for (let i = 0; i < rows.length; i++) {
    const u = Number(rows[i].uptoKm);
    const f = Number(rows[i].fare);
    if (!rows[i].uptoKm || !(u > 0)) return `Row ${i + 1}: distance must be positive`;
    if (rows[i].fare === "" || !(f >= 0)) return `Row ${i + 1}: fare must be 0 or more`;
    if (i && u <= Number(rows[i - 1].uptoKm)) return `Row ${i + 1}: distance must be greater than the row above`;
  }
  if (Number(rows[rows.length - 1].uptoKm) !== 999) return "Last slab must be 999 km (catch-all)";
  return null;
}

function SlabEditor({ mode, table, onSaved }: { mode: Mode; table: FareTable[Mode]; onSaved: (msg: string, kind?: "success" | "error") => void }) {
  const toRows = (s: Slab[]) => s.map((x) => ({ uptoKm: String(x.uptoKm), fare: String(x.fare) }));
  const [rows, setRows] = useState<Row[]>(toRows(table.slabs.length ? table.slabs : [{ uptoKm: 999, fare: 10 }]));
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(rows) !== JSON.stringify(toRows(table.slabs));
  const err = problems(rows);

  const set = (i: number, k: keyof Row, v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const addRow = () =>
    setRows((r) => {
      // Insert before the 999 catch-all, halfway between neighbours.
      const last = r[r.length - 1];
      const prev = r.length > 1 ? Number(r[r.length - 2].uptoKm) : 0;
      const fare = r.length > 1 ? r[r.length - 2].fare : last?.fare ?? "10";
      if (last && Number(last.uptoKm) === 999) return [...r.slice(0, -1), { uptoKm: String(prev + 5), fare }, last];
      return [...r, { uptoKm: "999", fare }];
    });

  async function save() {
    setBusy(true);
    try {
      await api(`/admin/fares/${mode}`, { method: "PUT", body: { slabs: rows.map((r) => ({ uptoKm: Number(r.uptoKm), fare: Number(r.fare) })) } });
      onSaved(`${table.label} fares saved. New plans use them now.`);
    } catch (e) {
      onSaved((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm" style={{ background: table.color }} />
          {table.label} <span className="text-xs font-normal text-slate-500">{table.operator}</span>
          {!table.configured && <span className="rounded bg-amber-100 px-1.5 text-[11px] font-normal text-amber-800">not configured</span>}
        </span>
      }
      actions={
        <div className="flex gap-2">
          {dirty && <Button size="sm" variant="ghost" onClick={() => setRows(toRows(table.slabs))}>Reset</Button>}
          <Button size="sm" variant="primary" onClick={save} disabled={busy || !dirty || !!err}>Save</Button>
        </div>
      }
    >
      <table className="w-full">
        <thead>
          <tr>
            <th className="th pl-0">Up to (km)</th>
            <th className="th">Fare (INR)</th>
            <th className="th" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            return (
              <tr key={i}>
                <td className="py-1 pr-2">
                  <input className="input font-mono" type="number" min={0} step="0.5" value={r.uptoKm} onChange={(e) => set(i, "uptoKm", e.target.value)} />
                </td>
                <td className="py-1 pr-2">
                  <input className="input font-mono" type="number" min={0} value={r.fare} onChange={(e) => set(i, "fare", e.target.value)} />
                </td>
                <td className="w-8 py-1 text-right">
                  <button className="rounded px-1.5 text-red-500 hover:bg-red-50 disabled:opacity-30" disabled={rows.length === 1} onClick={() => setRows((x) => x.filter((_, j) => j !== i))} aria-label="Remove slab">&times;</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-2 flex items-center justify-between gap-2">
        <Button size="sm" onClick={addRow}>Add slab</Button>
        <span className="text-xs text-slate-500">
          {rows.length > 0 && !err && `Min ${inr(Number(rows[0].fare))}, max ${inr(Math.max(...rows.map((r) => Number(r.fare))))}`}
        </span>
      </div>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      {table.source && <p className="mt-2 truncate text-[11px] text-slate-400" title={table.source}>Source: {table.source}</p>}
    </Card>
  );
}

export default function FaresPage() {
  const { data, error, reload } = useLoad(() => api<FareTable>("/admin/fares"), []);
  const { toast, toastNode } = useToast();
  return (
    <>
      <PageHeader title="Fares & ticket types" subtitle="Distance-slab fares per mode. A single-mode ticket costs the slab for its km; integrated tickets sum the slabs and then apply the integration discount." />
      {error && <Alert>{error}</Alert>}
      {data && (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {MODE_KEYS.map((m) => (
            <SlabEditor key={`${m}-${JSON.stringify(data[m].slabs)}`} mode={m} table={data[m]} onSaved={(msg, kind) => { toast(msg, kind); if (kind !== "error") reload(); }} />
          ))}
        </div>
      )}
      {toastNode}
    </>
  );
}
