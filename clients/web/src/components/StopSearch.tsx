"use client";

import { useEffect, useId, useState } from "react";
import { qs, useApi } from "@/lib/api";
import { modeLabel } from "@/lib/format";
import type { Stop } from "@/lib/types";
import { MapIcon, ModeIcon, PinIcon } from "./icons";

/** A planner endpoint: a stop id or a "lat,lng" string, with a display name. */
export type Endpoint = { id: string; name: string; mode?: string };

type Props = {
  label: string;
  placeholder: string;
  value: Endpoint | null;
  onChange: (value: Endpoint | null) => void;
  onPickOnMap: () => void;
};

export default function StopSearch({ label, placeholder, value, onChange, onPickOnMap }: Props) {
  const id = useId();
  const [text, setText] = useState(value?.name ?? "");
  const [shown, setShown] = useState(value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  if (value !== shown) {
    setShown(value);
    setText(value?.name ?? "");
  }

  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 200);
    return () => clearTimeout(t);
  }, [text]);

  const searching = open && !value && query.length >= 2;
  const { data, loading, error } = useApi<Stop[]>(searching ? `/stops${qs({ q: query, limit: 8 })}` : null);
  const results = searching ? (data ?? []) : [];
  const listOpen = searching && (loading || !!error || !!data);

  const choose = (s: Stop) => {
    onChange({ id: s.id, name: s.name, mode: s.mode });
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && listOpen && results[active]) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const listId = `${id}-list`;
  return (
    <div className="relative">
      <label htmlFor={`${id}-input`} className="mb-1 block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <PinIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            id={`${id}-input`}
            type="text"
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={listOpen}
            aria-controls={listId}
            aria-activedescendant={listOpen && active >= 0 ? `${id}-opt-${active}` : undefined}
            placeholder={placeholder}
            className="field pl-10"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
              setActive(-1);
              if (value) onChange(null);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKeyDown}
          />
        </div>
        <button
          type="button"
          onClick={onPickOnMap}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-line bg-card px-3 text-sm font-medium text-brand hover:border-brand"
          aria-label={`Pick ${label.toLowerCase()} on map`}
        >
          <MapIcon className="h-5 w-5" />
          <span className="hidden sm:inline">Map</span>
        </button>
      </div>
      <ul
        id={listId}
        role="listbox"
        aria-label={`${label} suggestions`}
        hidden={!listOpen}
        className="absolute inset-x-0 top-full z-[1200] mt-1 max-h-80 overflow-auto rounded-lg border border-line bg-card py-1 shadow-lg"
      >
        {loading && !data ? <li className="px-3 py-2 text-sm text-muted">Searching…</li> : null}
        {error ? <li className="px-3 py-2 text-sm text-muted">{error}</li> : null}
        {data && !results.length ? <li className="px-3 py-2 text-sm text-muted">No stop matches “{query}”.</li> : null}
        {results.map((s, i) => (
          <li
            key={s.id}
            id={`${id}-opt-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(s)}
            className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${i === active ? "bg-brand-soft" : "hover:bg-brand-soft"}`}
          >
            <ModeIcon mode={s.mode} className="h-5 w-5 text-brand" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-ink">{s.name}</span>
              <span className="block text-xs text-muted">
                {modeLabel(s.mode)}
                {s.hubId ? " · Interchange" : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
