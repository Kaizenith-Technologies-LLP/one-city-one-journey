import { modeLabel } from "@/lib/format";
import type { Meta, Mode, NotRunning, Weather } from "@/lib/types";
import { ClockIcon, SunIcon } from "./icons";
import { Notice } from "./ui";

export function HeatNotice({ weather }: { weather: Weather | null }) {
  if (!weather?.heatMode) return null;
  return (
    <Notice tone="warning" icon={<SunIcon className="h-5 w-5 text-accent-ink" />} title={`Heat alert: feels like ${Math.round(weather.feelsLikeC)} °C`}>
      Journeys with less walking are preferred, and long walks are flagged. Carry water and use shade where you can.
    </Notice>
  );
}

const notRunningText = (n: NotRunning) =>
  n.status === "ended"
    ? `finished for the day${n.lastDeparture ? ` (last departure ${n.lastDeparture})` : ""}`
    : n.status === "notStarted"
      ? `not started yet${n.firstDeparture ? ` (first departure ${n.firstDeparture})` : ""}`
      : "no service today";

export function NotRunningNotice({ items }: { items: NotRunning[] }) {
  if (!items.length) return null;
  return (
    <Notice tone="warning" icon={<ClockIcon className="h-5 w-5 text-accent-ink" />} title="Not running at your departure time">
      <ul className="space-y-0.5">
        {items.map((n) => (
          <li key={n.lineId}>
            <span className="font-medium">{n.name}</span> ({modeLabel(n.mode)}): {notRunningText(n)}
          </li>
        ))}
      </ul>
    </Notice>
  );
}

/** States plainly which modes the planner can and cannot route today. */
export function CoverageNotice({ meta }: { meta: Meta }) {
  const routable = meta.modes.filter((m) => m.lines > 0);
  const byMode = new Map<Mode, Meta["unroutableLines"]>();
  for (const l of meta.unroutableLines) byMode.set(l.mode, [...(byMode.get(l.mode) ?? []), l]);
  if (!byMode.size) return null;
  const list = [...byMode.entries()].map(([mode, lines]) => `${modeLabel(mode)} (${lines.length} ${lines.length === 1 ? "route" : "routes"})`);
  const joined = list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : list[0];
  return (
    <Notice
      title={
        routable.length
          ? `Journey planning covers ${routable.map((m) => `${m.label} (${m.lines} ${m.lines === 1 ? "line" : "lines"})`).join(", ")} today`
          : "No line can be planned right now"
      }
    >
      <p>
        {joined} cannot be planned yet because their verified timetables or fares are not available. Their stops still appear in search and on maps.
      </p>
      <details className="mt-2">
        <summary className="cursor-pointer font-medium text-brand">What is missing, route by route</summary>
        <ul className="mt-2 space-y-1">
          {meta.unroutableLines.map((l) => (
            <li key={l.id}>
              <span className="font-medium">{modeLabel(l.mode)}</span> {l.name}: missing {l.missing.map((m) => (m.startsWith("fares.") ? "fares" : m)).join(", ")}
            </li>
          ))}
        </ul>
      </details>
    </Notice>
  );
}
