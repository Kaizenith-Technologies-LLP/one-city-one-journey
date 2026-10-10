import Link from "next/link";
import { TAG_LABEL, changes, lineLabel, metres, minutes, rupees } from "@/lib/format";
import type { Option } from "@/lib/types";
import { ArrowRightIcon, ChevronRightIcon, ModeIcon, SunIcon, WalkIcon } from "./icons";

export function LegSummary({ option }: { option: Option }) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="Journey legs">
      {option.legs.map((l, i) => (
        <li key={i} className="inline-flex items-center gap-1.5">
          {i > 0 ? <ChevronRightIcon className="h-4 w-4 text-muted" /> : null}
          <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink">
            {l.type === "ride" ? (
              <>
                <ModeIcon mode={l.mode} className="h-4 w-4 text-brand" />
                <span className="font-medium">{lineLabel(l)}</span>
              </>
            ) : (
              <>
                <WalkIcon className="h-4 w-4 text-muted" />
                <span>Walk {metres(l.distanceM)}</span>
              </>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function OptionCard({ option, href, featured }: { option: Option; href: string; featured: boolean }) {
  const heat = option.legs.some((l) => l.type === "walk" && l.heatWarning);
  return (
    <article
      className={`rounded-xl border bg-card p-4 sm:p-5 ${featured ? "border-brand shadow-md ring-1 ring-brand" : "border-line"}`}
      aria-label={`${option.leaveTime} to ${option.arriveTime}, ${minutes(option.totalMin)}`}
    >
      {option.tags.length ? (
        <ul className="mb-3 flex flex-wrap gap-1.5" aria-label="Highlights">
          {option.tags.map((t) => (
            <li
              key={t}
              className={`rounded-md px-2 py-0.5 text-xs font-semibold ${t === "recommended" ? "bg-accent text-on-accent" : "bg-brand-soft text-brand"}`}
            >
              {TAG_LABEL[t]}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="flex items-center gap-2 text-2xl font-bold tabular-nums text-ink">
          {option.leaveTime}
          <ArrowRightIcon className="h-5 w-5 text-muted" />
          <span className="sr-only">to</span>
          {option.arriveTime}
        </p>
        <p className="text-lg font-semibold text-ink">{minutes(option.totalMin)}</p>
      </div>
      {featured ? <p className="mt-1 text-sm text-muted">{option.reason}</p> : null}
      <div className="mt-3">
        <LegSummary option={option} />
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        <div className="flex gap-1">
          <dt className="sr-only">Changes</dt>
          <dd>{changes(option.transfers)}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Walking</dt>
          <dd className="text-ink">{option.walkM ? `${metres(option.walkM)} (${minutes(option.walkMin)})` : "None"}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Waiting</dt>
          <dd className="text-ink">{minutes(option.waitMin)}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Fare</dt>
          <dd className="font-semibold text-ink">
            {rupees(option.fare)}
            {option.fareSplit.savings > 0 ? <span className="font-normal text-muted"> (saves {rupees(option.fareSplit.savings)})</span> : null}
          </dd>
        </div>
      </dl>
      {heat ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-accent-ink">
          <SunIcon className="h-4 w-4" />
          Includes a long walk in the heat
        </p>
      ) : null}
      <Link
        href={href}
        className={`mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${featured ? "bg-brand text-on-brand hover:bg-brand/90" : "border border-line text-brand hover:border-brand"}`}
      >
        Steps, map and ticket
        <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </article>
  );
}
