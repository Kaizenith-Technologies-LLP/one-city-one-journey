"use client";

import { useApi } from "@/lib/api";
import { metres, minutes, modeLabel } from "@/lib/format";
import type { Hub, Overlap } from "@/lib/types";
import { WalkIcon } from "./icons";
import TransitMap from "./TransitMap";
import { Card, ErrorState, Loading, ModeTag } from "./ui";

export default function InterchangesView() {
  const hubs = useApi<Hub[]>("/hubs");
  const overlaps = useApi<Overlap[]>("/overlaps");

  if (hubs.error) return <ErrorState message={hubs.error} onRetry={hubs.reload} />;
  if (!hubs.data) return <Loading label="Loading interchanges" />;

  const list = [...hubs.data].sort((a, b) => b.modes.length - a.modes.length || a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      {list.length ? (
        <TransitMap
          label="Map of interchange stations"
          className="h-72 sm:h-96"
          markers={list.map((h) => ({ id: h.id, kind: "hub", lat: h.lat, lng: h.lng, label: `${h.name}: ${h.modes.map(modeLabel).join(", ")}` }))}
        />
      ) : null}

      <section aria-labelledby="hubs-heading">
        <h2 id="hubs-heading" className="mb-3 text-lg font-bold">
          {list.length} {list.length === 1 ? "interchange" : "interchanges"}
        </h2>
        {!list.length ? <p className="text-muted">No interchange stations are listed right now.</p> : null}
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((h) => (
            <li key={h.id}>
              <Card className="h-full">
                <h3 className="font-semibold">{h.name}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {h.modes.map((m) => (
                    <ModeTag key={m} mode={m} />
                  ))}
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {h.members.map((s) => (
                    <li key={s.stopId}>
                      <span className="font-medium">{modeLabel(s.mode)}:</span> {s.name}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
                  <WalkIcon className="h-4 w-4" />
                  Longest walk between stops: {metres(h.maxWalkM)} (about {minutes(h.maxWalkMin)})
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="overlaps-heading">
        <h2 id="overlaps-heading" className="mb-2 text-lg font-bold">
          Shared corridors
        </h2>
        <p className="mb-3 text-sm text-muted">Lines of different operators that run through the same consecutive interchanges.</p>
        {overlaps.error ? <ErrorState message={overlaps.error} onRetry={overlaps.reload} /> : null}
        {overlaps.data && !overlaps.data.length ? (
          <p className="text-muted">No shared corridors are identified with the lines that have verified data today.</p>
        ) : null}
        {overlaps.data?.length ? (
          <ul className="space-y-2">
            {overlaps.data.map((o) => (
              <li key={o.id}>
                <Card>
                  <p className="font-medium">
                    {o.lineAName} and {o.lineBName}
                  </p>
                  <p className="text-sm text-muted">Via {o.hubNames.join(", ")}</p>
                </Card>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
