"use client";

import { useState } from "react";
import { api, qs } from "@/lib/api";
import type { Hub } from "@/lib/types";
import { MODE_KEYS, MODES, modeColor } from "@/lib/modes";
import { Alert, Empty, ModeBadge, PageHeader, useLoad } from "@/components/ui";

export default function HubsPage() {
  const [mode, setMode] = useState("");
  const [minModes, setMinModes] = useState(2);
  const [q, setQ] = useState("");
  const { data, error, loading } = useLoad(() => api<Hub[]>(`/hubs${qs({ mode, minModes })}`, { auth: false }), [mode, minModes]);
  const rows = (data ?? []).filter((h) => !q || h.name.toLowerCase().includes(q.toLowerCase()) || h.members.some((m) => m.name.toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      <PageHeader title="Interchange hubs" subtitle="Overlapping stations: stops of different modes close enough to transfer on foot. Detected automatically from station locations and names." />
      <div className="mb-4 flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search station" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-[12rem]" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="">Any mode</option>
          {MODE_KEYS.map((m) => <option key={m} value={m}>Includes {MODES[m].label}</option>)}
        </select>
        <select className="input max-w-[12rem]" value={minModes} onChange={(e) => setMinModes(Number(e.target.value))}>
          <option value={2}>2+ modes</option>
          <option value={3}>3+ modes</option>
          <option value={4}>4+ modes</option>
        </select>
      </div>
      {error && <Alert>{error}</Alert>}
      {!rows.length && <Empty>{loading ? "Loading..." : "No hubs match."}</Empty>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((h) => (
          <article key={h.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex h-1.5 overflow-hidden rounded-t-xl">
              {h.modes.map((m) => <span key={m} className="flex-1" style={{ background: modeColor(m) }} />)}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-slate-900">{h.name}</h2>
                  <div className="font-mono text-[11px] text-slate-400">{h.id} · {h.lat.toFixed(4)}, {h.lng.toFixed(4)}</div>
                </div>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">{h.type}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">{h.modes.map((m) => <ModeBadge key={m} mode={m} />)}</div>
              <div className="mt-3 text-xs text-slate-500">
                {h.lineCount} lines · operators {h.operators.join(", ")} · max transfer walk {h.maxWalkM} m ({h.maxWalkMin} min)
              </div>
              <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
                {h.members.map((m) => (
                  <li key={m.stopId} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: modeColor(m.mode) }} />
                      {m.name}
                    </span>
                    <span className="text-xs text-slate-500">{m.lines.length} line{m.lines.length === 1 ? "" : "s"}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
