"use client";

import { useMemo, useSyncExternalStore } from "react";

const KEY = "oj-my-tickets";
const EVENT = "oj-my-tickets-change";

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): string[] {
  try {
    const list: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Storage is blocked; the ticket stays reachable by its code.
  }
}

export function rememberTicket(id: string) {
  write([id, ...parse(read()).filter((x) => x !== id)]);
}

export function forgetTicket(id: string) {
  write(parse(read()).filter((x) => x !== id));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** Ticket codes booked on this device, newest first. Null until the browser has been read. */
export function useMyTickets(): string[] | null {
  const raw = useSyncExternalStore(subscribe, () => read() ?? "[]", () => null);
  return useMemo(() => (raw === null ? null : parse(raw)), [raw]);
}
