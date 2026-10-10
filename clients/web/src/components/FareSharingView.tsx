"use client";

import { useApi } from "@/lib/api";
import { modeLabel, rupees } from "@/lib/format";
import type { Settlement } from "@/lib/types";
import { Card, ErrorState, Loading, ModeTag, Notice, Stat } from "./ui";

export default function FareSharingView() {
  const { data, error, reload } = useApi<Settlement>("/settlement");

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading label="Loading fare sharing" />;

  const { rules } = data;
  const weights = Object.entries(rules.costWeights);
  const kmPct = 100 - rules.fareWeightPct;

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-bold">The rules</h2>
        <ol className="mt-3 list-inside list-decimal space-y-2 text-ink">
          <li>One integrated ticket covers the whole journey, even across operators.</li>
          <li>
            When a journey uses two or more operators, the fare is the sum of their standalone fares less a{" "}
            <strong>{rules.integrationDiscountPct}%</strong> integration discount. Single-operator journeys pay the standalone fare.
          </li>
          <li>
            Each operator&apos;s share of the fare is <strong>{rules.fareWeightPct}%</strong> based on its standalone fare and{" "}
            <strong>{kmPct}%</strong> based on the passenger-km it carries, weighted by its operating cost.
          </li>
          <li>
            {weights.length ? (
              <>
                Operating cost weights:{" "}
                {weights.map(([mode, w], i) => (
                  <span key={mode}>
                    {i ? ", " : ""}
                    {modeLabel(mode)} {w}
                  </span>
                ))}
                . The passenger-km part applies only when every operator on a trip has a weight.
              </>
            ) : (
              "Operating cost weights are not configured yet, so today every share follows standalone fares alone."
            )}
          </li>
        </ol>
      </Card>

      <section aria-labelledby="settlement-heading">
        <h2 id="settlement-heading" className="mb-3 text-lg font-bold">
          Settlement from tickets issued
        </h2>
        <Card>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="Trips" value={data.trips} />
            <Stat label="Multi-operator trips" value={data.multimodalTrips} />
            <Stat label="Passenger-km" value={data.passengerKm} />
            <Stat label="Standalone fares" value={rupees(data.standaloneRevenue)} />
            <Stat label="Integrated fares collected" value={rupees(data.integratedRevenue)} />
            <Stat label="Saved by commuters" value={rupees(data.commuterSavings)} />
          </dl>
        </Card>
      </section>

      {data.operators.length ? (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <caption className="mb-2 text-left font-semibold">Revenue by operator</caption>
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">Operator</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Trips</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Passenger-km</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Standalone</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Settled</th>
                <th scope="col" className="py-2 text-right font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {data.operators.map((o) => (
                <tr key={o.operator} className="border-t border-line">
                  <td className="py-2 pr-3">
                    <span className="block font-medium">{o.operatorName}</span>
                    <ModeTag mode={o.mode} />
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{o.trips}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{o.passengerKm}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{rupees(o.standaloneRevenue)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{rupees(o.settledRevenue)}</td>
                  <td className="py-2 text-right tabular-nums">{o.revenueSharePct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <Notice title="No integrated tickets settled yet">The operator split appears here once tickets have been issued.</Notice>
      )}
    </div>
  );
}
