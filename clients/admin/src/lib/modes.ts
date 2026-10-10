import type { Mode } from "./types";

export const MODES: Record<Mode, { label: string; operator: string; color: string }> = {
  metro: { label: "Metro", operator: "GMRC", color: "#1E5BC6" },
  brts: { label: "BRTS", operator: "AJL", color: "#D7263D" },
  amts: { label: "AMTS", operator: "AMTS", color: "#F4A300" },
  gsrtc: { label: "GSRTC", operator: "GSRTC", color: "#2A9D8F" },
  gmcbus: { label: "GMC Bus", operator: "GMC", color: "#8E44AD" },
};

export const MODE_KEYS = Object.keys(MODES) as Mode[];
export const OPERATORS = MODE_KEYS.map((m) => MODES[m].operator);

export const modeColor = (m: string) => MODES[m as Mode]?.color ?? "#64748b";
export const modeLabel = (m: string) => MODES[m as Mode]?.label ?? m;

export const inr = (n: number | null | undefined, dp = 0) =>
  `₹${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: 2 })}`;

export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";

/** Today in IST (matches the backend's settlement day). */
export const todayIST = () => new Date(Date.now() + 330 * 60e3).toISOString().slice(0, 10);
