"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Mode, Settings } from "@/lib/types";
import { inr, MODE_KEYS, modeColor, MODES } from "@/lib/modes";
import { Alert, Button, Card, Field, PageHeader, useLoad, useToast } from "@/components/ui";

type Form = { discountPct: number; fareWeightPct: number; costWeights: Partial<Record<Mode, number>> };

// Example trip for the live preview: Metro then BRTS.
const SAMPLE = [
  { operator: "GMRC", mode: "metro" as Mode, km: 8, fare: 15 },
  { operator: "AJL", mode: "brts" as Mode, km: 5, fare: 10 },
];

/** Same formula as backend services/fares.js fareSplit(). */
function preview(f: Form) {
  const standalone = SAMPLE.reduce((s, t) => s + t.fare, 0);
  const integrated = Math.round(standalone * (1 - f.discountPct / 100));
  // Without a cost weight for every operator the backend splits on standalone fares only.
  const useKm = SAMPLE.every((t) => (f.costWeights[t.mode] ?? 0) > 0);
  const fw = useKm ? f.fareWeightPct / 100 : 1;
  const weight = (t: (typeof SAMPLE)[number]) => t.km * (f.costWeights[t.mode] ?? 0);
  const totalW = SAMPLE.reduce((s, t) => s + weight(t), 0) || 1;
  return {
    standalone,
    integrated,
    shares: SAMPLE.map((t) => {
      const pct = fw * (t.fare / standalone) + (1 - fw) * (weight(t) / totalW);
      return { ...t, pct: pct * 100, amount: integrated * pct };
    }),
  };
}

export default function SettingsPage() {
  const { data, error, reload } = useLoad(() => api<Settings>("/admin/settings"), []);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, toastNode } = useToast();

  useEffect(() => {
    if (data) setForm({ discountPct: Math.round(data.integrationDiscount * 1000) / 10, fareWeightPct: Math.round(data.fareWeight * 100), costWeights: { ...data.costWeights } }); // eslint-disable-line react-hooks/set-state-in-effect
  }, [data]);

  async function save() {
    if (!form) return;
    setBusy(true);
    try {
      await api("/admin/settings", { method: "PUT", body: { integrationDiscount: form.discountPct / 100, fareWeight: form.fareWeightPct / 100, costWeights: form.costWeights } });
      toast("Fare-sharing settings saved and applied");
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!confirm("Reset all fare-sharing settings to defaults?")) return;
    await api("/admin/settings/reset", { method: "POST" });
    toast("Reset to defaults");
    reload();
  }

  const p = form ? preview(form) : null;

  return (
    <>
      <PageHeader
        title="Fare-sharing settings"
        subtitle="How an integrated ticket is priced and how its revenue is split between operators"
        actions={
          <>
            <Button onClick={reset}>Reset to defaults</Button>
            <Button variant="primary" onClick={save} disabled={busy || !form}>{busy ? "Saving..." : "Save settings"}</Button>
          </>
        }
      />
      {error && <Alert>{error}</Alert>}
      {form && data && p && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card title="Integrated ticket pricing">
              <Field label={`Integration discount: ${form.discountPct}%`} hint={`Off the summed fares when a trip uses 2+ operators. Default ${data.defaults.integrationDiscount * 100}%. Max 50%.`}>
                <input type="range" min={0} max={50} step={0.5} className="w-full accent-brand" value={form.discountPct} onChange={(e) => setForm({ ...form, discountPct: Number(e.target.value) })} />
              </Field>
            </Card>
            <Card title="Revenue split rule">
              <Field
                label={`Fare weight: ${form.fareWeightPct}% by standalone fare / ${100 - form.fareWeightPct}% by cost-weighted km`}
                hint={`Each operator's share = fareWeight x its standalone fare share + (1 - fareWeight) x its cost-weighted passenger-km share. Default ${data.defaults.fareWeight * 100}%.`}
              >
                <input type="range" min={0} max={100} step={5} className="w-full accent-brand" value={form.fareWeightPct} onChange={(e) => setForm({ ...form, fareWeightPct: Number(e.target.value) })} />
              </Field>
              <div className="mt-5">
                <span className="label">Cost weight per passenger-km</span>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {MODE_KEYS.map((m) => (
                    <label key={m} className="block rounded-lg border border-slate-200 p-2">
                      <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-700">
                        <span className="h-2 w-2 rounded-full" style={{ background: modeColor(m) }} />
                        {MODES[m].label}
                      </span>
                      <input
                        className="input font-mono"
                        type="number"
                        step={0.1}
                        min={0.1}
                        max={5}
                        placeholder="not set"
                        value={form.costWeights[m] ?? ""}
                        onChange={(e) => {
                          const next = { ...form.costWeights };
                          if (e.target.value === "") delete next[m];
                          else next[m] = Number(e.target.value);
                          setForm({ ...form, costWeights: next });
                        }}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <Card title="Live preview: Metro 8 km + BRTS 5 km">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Separate tickets</span><span className="tabular-nums">{inr(p.standalone)}</span></div>
              <div className="flex justify-between font-semibold"><span>Integrated ticket</span><span className="tabular-nums">{inr(p.integrated)}</span></div>
              <div className="flex justify-between text-emerald-700"><span>Commuter saves</span><span className="tabular-nums">{inr(p.standalone - p.integrated)}</span></div>
            </div>
            <div className="mt-5 flex h-4 overflow-hidden rounded-full bg-slate-100">
              {p.shares.map((s, i) => (
                <div key={s.operator} title={`${s.operator}: ${s.pct.toFixed(1)}%`} style={{ width: `${s.pct}%`, background: modeColor(s.mode), marginLeft: i ? 2 : 0 }} />
              ))}
            </div>
            <table className="mt-4 w-full">
              <thead>
                <tr><th className="th pl-0">Operator</th><th className="th text-right">Km</th><th className="th text-right">Own fare</th><th className="th text-right">Share</th><th className="th pr-0 text-right">Receives</th></tr>
              </thead>
              <tbody>
                {p.shares.map((s) => (
                  <tr key={s.operator}>
                    <td className="py-1.5 text-sm"><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: modeColor(s.mode) }} />{s.operator}</td>
                    <td className="py-1.5 text-right text-sm tabular-nums">{s.km}</td>
                    <td className="py-1.5 text-right text-sm tabular-nums">{inr(s.fare)}</td>
                    <td className="py-1.5 text-right text-sm tabular-nums">{s.pct.toFixed(1)}%</td>
                    <td className="py-1.5 text-right text-sm font-medium tabular-nums">{inr(s.amount, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-xs text-slate-500">Saved settings apply immediately to new journey plans and tickets. Tickets already issued keep their original split.</p>
          </Card>
        </div>
      )}
      {toastNode}
    </>
  );
}
