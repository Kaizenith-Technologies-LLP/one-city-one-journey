"use client";

import { useCallback, useEffect, useState } from "react";

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "https://api-production-1452.up.railway.app/api").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** JSON request against the One Journey API. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: init.method ?? "GET",
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "We could not reach the journey service. Check your connection and try again.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const qs = (params: Record<string, string | number | undefined | null>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : "";
};

type Loaded<T> = { path: string; nonce: number; data?: T; error?: string };

/**
 * Loads `path` on the client. Pass null to skip. `reload()` fetches again and
 * keeps the previous data visible until the new response arrives.
 */
export function useApi<T>(path: string | null) {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<Loaded<T> | null>(null);

  useEffect(() => {
    if (!path) return;
    let live = true;
    api<T>(path).then(
      (data) => live && setState({ path, nonce, data }),
      (e: Error) => live && setState({ path, nonce, error: e.message }),
    );
    return () => {
      live = false;
    };
  }, [path, nonce]);

  const samePath = !!path && state?.path === path;
  const settled = samePath && state?.nonce === nonce;
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return {
    data: samePath ? state?.data : undefined,
    error: settled ? state?.error : undefined,
    loading: !!path && !settled,
    reload,
  };
}
