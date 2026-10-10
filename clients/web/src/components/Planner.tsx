"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { qs, useApi } from "@/lib/api";
import { DAY_LABEL, TAGS, TAG_LABEL } from "@/lib/format";
import type { Meta, Option, PlanResult, Tag } from "@/lib/types";
import { DisruptionsBanner } from "./Alerts";
import { RefreshIcon, SearchIcon, SwapIcon } from "./icons";
import MapPicker from "./MapPicker";
import OptionCard from "./OptionCard";
import { CoverageNotice, HeatNotice, NotRunningNotice } from "./ServiceNotices";
import StopSearch, { type Endpoint } from "./StopSearch";
import { ErrorState, Loading, Notice, btn } from "./ui";

type Query = { from: string; fromName: string; to: string; toName: string; depart: string };

function readQuery(p: URLSearchParams): Query {
  return {
    from: p.get("from") ?? "",
    fromName: p.get("fromName") ?? "",
    to: p.get("to") ?? "",
    toName: p.get("toName") ?? "",
    depart: p.get("depart") ?? "",
  };
}

const endpoint = (id: string, name: string): Endpoint | null => (id ? { id, name: name || id } : null);

const pad = (n: number) => String(n).padStart(2, "0");

function PlannerForm({ initial }: { initial: Query }) {
  const router = useRouter();
  const [from, setFrom] = useState(endpoint(initial.from, initial.fromName));
  const [to, setTo] = useState(endpoint(initial.to, initial.toName));
  const [leaveAt, setLeaveAt] = useState(initial.depart);
  const [picking, setPicking] = useState<"start" | "destination" | null>(null);
  const same = !!from && !!to && from.id === to.id;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!from || !to || same) return;
    router.push(`/${qs({ from: from.id, fromName: from.name, to: to.id, toName: to.name, depart: leaveAt })}`, { scroll: false });
  };

  const chooseLeaveAt = () => {
    const d = new Date();
    setLeaveAt(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-6" aria-label="Plan a journey">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <StopSearch label="From" placeholder="Search a stop or station" value={from} onChange={setFrom} onPickOnMap={() => setPicking("start")} />
        <button
          type="button"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
          className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-line text-brand hover:border-brand sm:mb-0"
          aria-label="Swap start and destination"
        >
          <SwapIcon className="h-5 w-5 sm:rotate-90" />
        </button>
        <StopSearch label="To" placeholder="Search a stop or station" value={to} onChange={setTo} onPickOnMap={() => setPicking("destination")} />
      </div>

      <fieldset className="mt-4">
        <legend className="mb-1 text-sm font-medium text-ink">Departure</legend>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-line p-0.5">
            <button
              type="button"
              aria-pressed={!leaveAt}
              onClick={() => setLeaveAt("")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${!leaveAt ? "bg-brand text-on-brand" : "text-muted hover:text-brand"}`}
            >
              Leave now
            </button>
            <button
              type="button"
              aria-pressed={!!leaveAt}
              onClick={() => !leaveAt && chooseLeaveAt()}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${leaveAt ? "bg-brand text-on-brand" : "text-muted hover:text-brand"}`}
            >
              Leave at
            </button>
          </div>
          {leaveAt ? (
            <label className="flex items-center gap-2 text-sm text-ink">
              <span className="sr-only">Departure time (today)</span>
              <input type="time" required value={leaveAt} onChange={(e) => setLeaveAt(e.target.value)} className="field w-auto py-1.5" />
              <span className="text-muted">today</span>
            </label>
          ) : null}
        </div>
      </fieldset>

      {same ? <p className="mt-3 text-sm text-accent-ink">Start and destination are the same. Choose a different destination.</p> : null}

      <button type="submit" disabled={!from || !to || same} className={`${btn.primary} mt-5 w-full sm:w-auto`}>
        <SearchIcon className="h-5 w-5" />
        Find journeys
      </button>
      {!from || !to ? <p className="mt-2 text-sm text-muted">Choose a start and a destination from the suggestions, or pick them on the map.</p> : null}

      <MapPicker
        target={picking}
        onClose={() => setPicking(null)}
        onPick={(p) => (picking === "start" ? setFrom(p) : setTo(p))}
      />
    </form>
  );
}

function sortOptions(options: Option[], tag: Tag) {
  const list = [...options];
  const byArrival = (a: Option, b: Option) => a.arriveTime.localeCompare(b.arriveTime) || a.totalMin - b.totalMin;
  const order: Record<Tag, (a: Option, b: Option) => number> = {
    recommended: (a, b) => Number(b.tags.includes("recommended")) - Number(a.tags.includes("recommended")),
    fastest: byArrival,
    fewestTransfers: (a, b) => a.transfers - b.transfers || byArrival(a, b),
    leastWalking: (a, b) => a.walkM - b.walkM || byArrival(a, b),
    cheapest: (a, b) => a.fare - b.fare || byArrival(a, b),
  };
  return list.sort(order[tag]);
}

function Results({ query }: { query: Query }) {
  const path = `/plan${qs(query)}`;
  const { data, error, loading, reload } = useApi<PlanResult>(path);
  const [tag, setTag] = useState<Tag>("recommended");
  const sorted = useMemo(() => (data ? sortOptions(data.options, tag) : []), [data, tag]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading label="Finding journeys" />;

  const detailHref = (o: Option) =>
    `/journey${qs({ from: query.from, fromName: query.fromName, to: query.to, toName: query.toName, depart: data.departAt, option: o.signature })}`;

  return (
    <section aria-labelledby="results-heading" className="space-y-4" aria-busy={loading}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="results-heading" className="text-xl font-bold text-ink">
            {data.from.name} to {data.to.name}
          </h2>
          <p className="text-sm text-muted">
            Leaving {query.depart ? "at" : "now,"} {data.departAt}, {DAY_LABEL[data.day] ?? data.day}
            {data.weather ? `. ${Math.round(data.weather.tempC)} °C, feels like ${Math.round(data.weather.feelsLikeC)} °C` : ""}
          </p>
        </div>
        <button type="button" onClick={reload} className={`${btn.ghost} text-sm`} disabled={loading}>
          <RefreshIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <DisruptionsBanner alerts={data.disruptions} />
      <HeatNotice weather={data.weather} />
      <NotRunningNotice items={data.notRunning} />

      {data.options.length === 0 ? (
        <Notice tone="warning" title="No route right now">
          {data.notRunning.length
            ? "The services that connect these places are not running at this time. Try a later departure time."
            : "We could not find a journey between these places with the services we can plan today. Try a nearby Metro station."}
        </Notice>
      ) : (
        <>
          <div role="group" aria-label="Order journeys by" className="flex gap-2 overflow-x-auto pb-1">
            {TAGS.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tag === t}
                onClick={() => setTag(t)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                  tag === t ? "border-brand bg-brand text-on-brand" : "border-line bg-card text-ink hover:border-brand hover:text-brand"
                }`}
              >
                {TAG_LABEL[t]}
              </button>
            ))}
          </div>
          <ol className="space-y-3" aria-label={`${sorted.length} ${sorted.length === 1 ? "journey" : "journeys"}`}>
            {sorted.map((o, i) => (
              <li key={o.id}>
                <OptionCard option={o} featured={i === 0} href={detailHref(o)} />
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

export default function Planner() {
  const params = useSearchParams();
  const query = readQuery(params);
  const meta = useApi<Meta>("/meta");
  const ready = !!query.from && !!query.to;

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">One City, One Journey</h1>
        <p className="mt-2 text-muted">Plan a trip across Ahmedabad and Gandhinagar public transport and book one ticket for the whole journey.</p>
      </div>
      <PlannerForm key={params.toString()} initial={query} />
      {ready ? <Results key={params.toString()} query={query} /> : null}
      {meta.data ? <CoverageNotice meta={meta.data} /> : null}
    </div>
  );
}
