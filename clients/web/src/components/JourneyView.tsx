"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { qs, useApi } from "@/lib/api";
import { changes, lineLabel, metres, minutes, modeLabel, rupees } from "@/lib/format";
import type { Leg, Option, PlanResult } from "@/lib/types";
import { DisruptionsBanner } from "./Alerts";
import BookTicket from "./BookTicket";
import { ArrowLeftIcon, ClockIcon, ModeIcon, PinIcon, SunIcon, WalkIcon } from "./icons";
import type { MapLine, MapMarker } from "./mapTypes";
import { LegSummary } from "./OptionCard";
import { HeatNotice } from "./ServiceNotices";
import TransitMap from "./TransitMap";
import { Card, ErrorState, Loading, Notice, Stat } from "./ui";

function Step({ time, icon, children, last }: { time?: string; icon: ReactNode; children: ReactNode; last?: boolean }) {
  return (
    <li className="grid grid-cols-[3.5rem_2rem_1fr] gap-x-2">
      <span className="pt-1 text-right text-sm font-semibold tabular-nums text-ink">{time}</span>
      <span className="flex flex-col items-center">
        <span className="grid h-8 w-8 place-items-center rounded-full border border-line bg-card text-brand">{icon}</span>
        {last ? null : <span className="w-0.5 flex-1 bg-line" aria-hidden />}
      </span>
      <div className="pb-5 pt-1 text-ink">{children}</div>
    </li>
  );
}

function legSteps(leg: Leg, i: number): ReactNode[] {
  if (leg.type === "walk") {
    return [
      <Step key={`w${i}`} time={leg.departTime} icon={<WalkIcon className="h-4 w-4" />}>
        <p className="font-medium">
          {leg.kind === "transfer" ? "Change: walk" : "Walk"} {metres(leg.distanceM)} to {leg.to.name}
          {leg.to.mode ? ` (${modeLabel(leg.to.mode)})` : ""}
        </p>
        <p className="text-sm text-muted">About {minutes(leg.durationMin)}</p>
        {leg.heatWarning ? (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-accent-ink">
            <SunIcon className="h-4 w-4" />
            Heat warning: {leg.heatWarning}
          </p>
        ) : null}
      </Step>,
    ];
  }
  const steps: ReactNode[] = [];
  if (leg.waitMin > 0) {
    steps.push(
      <Step key={`q${i}`} icon={<ClockIcon className="h-4 w-4" />}>
        <p className="text-sm text-muted">
          Wait {minutes(leg.waitMin)} at {leg.from.name}
        </p>
      </Step>,
    );
  }
  steps.push(
    <Step key={`r${i}`} time={leg.departTime} icon={<ModeIcon mode={leg.mode} className="h-4 w-4" />}>
      <p className="font-medium">
        Board {lineLabel(leg)} at {leg.from.name}
      </p>
      <p className="text-sm text-muted">
        Towards {leg.towards}. {leg.stopCount} {leg.stopCount === 1 ? "stop" : "stops"}, {minutes(leg.rideMin)}
        {leg.headwayMin ? `. Runs every ${leg.headwayMin} min` : ""}
      </p>
      {leg.path.length > 2 ? (
        <details className="mt-1 text-sm">
          <summary className="cursor-pointer text-brand">Show stops</summary>
          <ol className="mt-1 list-inside list-decimal text-muted">
            {leg.path.map((p) => (
              <li key={p.stopId}>{p.name}</li>
            ))}
          </ol>
        </details>
      ) : null}
    </Step>,
    <Step key={`a${i}`} time={leg.arriveTime} icon={<PinIcon className="h-4 w-4" />}>
      <p className="font-medium">Get off at {leg.to.name}</p>
    </Step>,
  );
  return steps;
}

function mapData(plan: PlanResult, option: Option) {
  const lines: MapLine[] = option.legs.map((l, i) =>
    l.type === "ride"
      ? { id: `l${i}`, kind: "ride", points: l.path.map((p) => [p.lat, p.lng]), label: lineLabel(l) }
      : { id: `l${i}`, kind: "walk", points: [[l.from.lat, l.from.lng], [l.to.lat, l.to.lng]], label: `Walk ${metres(l.distanceM)}` },
  );
  const markers: MapMarker[] = [
    { id: "start", kind: "start", lat: plan.from.lat, lng: plan.from.lng, label: `Start: ${plan.from.name}` },
    { id: "end", kind: "end", lat: plan.to.lat, lng: plan.to.lng, label: `Destination: ${plan.to.name}` },
  ];
  return { lines, markers };
}

function FareBreakdown({ option }: { option: Option }) {
  const split = option.fareSplit;
  return (
    <Card>
      <h2 className="text-lg font-bold">Fare</h2>
      <ul className="mt-3 space-y-1 text-sm">
        {option.tickets.map((t, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span className="flex items-center gap-1.5">
              <ModeIcon mode={t.mode} className="h-4 w-4 text-brand" />
              {modeLabel(t.mode)} ({t.operator}), {t.km.toFixed(1)} km
            </span>
            <span className="tabular-nums">{rupees(t.fare)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Separate tickets would cost</dt>
          <dd className="tabular-nums">{rupees(split.standaloneFare)}</dd>
        </div>
        {split.discountPct > 0 ? (
          <div className="flex justify-between">
            <dt className="text-muted">Integrated ticket discount</dt>
            <dd className="tabular-nums">
              {split.discountPct}% (save {rupees(split.savings)})
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between text-base font-semibold">
          <dt>You pay</dt>
          <dd className="tabular-nums">{rupees(split.integratedFare)}</dd>
        </div>
      </dl>
      <h3 className="mt-4 text-sm font-semibold">How the fare is shared between operators</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="py-1 pr-2 font-medium">Operator</th>
              <th scope="col" className="py-1 pr-2 text-right font-medium">Share</th>
              <th scope="col" className="py-1 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {split.shares.map((s) => (
              <tr key={s.operator} className="border-t border-line">
                <td className="py-1.5 pr-2">
                  {s.operatorName}
                  <span className="block text-xs text-muted">
                    {modeLabel(s.mode)}, {s.km.toFixed(1)} km
                  </span>
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{s.sharePct}%</td>
                <td className="py-1.5 text-right tabular-nums">{rupees(s.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">Split method: {split.method}.</p>
    </Card>
  );
}

export default function JourneyView() {
  const p = useSearchParams();
  const request = {
    from: p.get("from") ?? "",
    fromName: p.get("fromName") ?? undefined,
    to: p.get("to") ?? "",
    toName: p.get("toName") ?? undefined,
    depart: p.get("depart") ?? "",
  };
  const signature = p.get("option");
  const valid = !!request.from && !!request.to && !!request.depart && !!signature;
  const { data, error, reload } = useApi<PlanResult>(valid ? `/plan${qs(request)}` : null);
  const backHref = `/${qs({ from: request.from, fromName: request.fromName, to: request.to, toName: request.toName, depart: request.depart })}`;

  const back = (
    <Link href={backHref} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline">
      <ArrowLeftIcon className="h-4 w-4" />
      All journeys
    </Link>
  );

  if (!valid)
    return (
      <Notice tone="warning" title="This journey link is incomplete">
        <Link href="/" className="font-medium text-brand underline">
          Plan a journey
        </Link>{" "}
        to see steps and book a ticket.
      </Notice>
    );
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading label="Loading journey" />;

  const option = data.options.find((o) => o.signature === signature);
  if (!option)
    return (
      <div>
        {back}
        <Notice tone="warning" title="This journey is no longer available">
          Services may have changed since it was planned. Go back to see the journeys available now.
        </Notice>
      </div>
    );

  const { lines, markers } = mapData(data, option);
  const steps = option.legs.flatMap(legSteps);

  return (
    <div>
      {back}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {data.from.name} to {data.to.name}
        </h1>
        <p className="mt-1 text-muted">{option.reason}</p>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Leave" value={option.leaveTime} />
          <Stat label="Arrive" value={option.arriveTime} />
          <Stat label="Journey time" value={minutes(option.totalMin)} />
          <Stat label="Fare" value={rupees(option.fare)} />
        </dl>
        <div className="mt-4">
          <LegSummary option={option} />
        </div>
        <p className="mt-2 text-sm text-muted">
          {changes(option.transfers)}, {option.distanceKm.toFixed(1)} km, walking {option.walkM ? metres(option.walkM) : "none"}
        </p>
      </div>

      <div className="space-y-4">
        <DisruptionsBanner alerts={data.disruptions} />
        <HeatNotice weather={data.weather} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <TransitMap label="Map of this journey" className="h-72 sm:h-96" lines={lines} markers={markers} />
          <Card>
            <h2 className="mb-4 text-lg font-bold">Step by step</h2>
            <ol>
              <Step time={option.leaveTime} icon={<span className="text-xs font-bold">A</span>}>
                <p className="font-medium">Start at {data.from.name}</p>
              </Step>
              {steps}
              <Step time={option.arriveTime} icon={<span className="text-xs font-bold">B</span>} last>
                <p className="font-medium">Arrive at {data.to.name}</p>
              </Step>
            </ol>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <BookTicket request={request} fromName={data.from.name} toName={data.to.name} option={option} />
          </Card>
          <FareBreakdown option={option} />
        </div>
      </div>
    </div>
  );
}
