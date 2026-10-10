import type { Mode, RideLeg, Tag } from "./types";

export const MODE_LABEL: Record<Mode, string> = {
  metro: "Metro",
  brts: "BRTS",
  amts: "AMTS",
  gsrtc: "GSRTC",
  gmcbus: "Gandhinagar City Bus",
};

export const modeLabel = (mode: string) => MODE_LABEL[mode as Mode] ?? mode.toUpperCase();

/** "Metro Blue", "BRTS 15" and so on. */
export const lineLabel = (leg: Pick<RideLeg, "mode" | "lineShortName">) => `${modeLabel(leg.mode)} ${leg.lineShortName}`;

export const TAG_LABEL: Record<Tag, string> = {
  recommended: "Recommended",
  fastest: "Fastest",
  fewestTransfers: "Fewest changes",
  leastWalking: "Least walking",
  cheapest: "Cheapest",
};

export const TAGS = Object.keys(TAG_LABEL) as Tag[];

export function minutes(total: number) {
  const m = Math.round(total);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

export const rupees = (n: number) => `₹${Number.isInteger(n) ? n : n.toFixed(2)}`;

export const metres = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

export const changes = (n: number) => (n === 0 ? "No changes" : n === 1 ? "1 change" : `${n} changes`);

const IST_DATE_TIME = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Date and time in India Standard Time, e.g. "12 Oct, 09:30". */
export const istDateTime = (iso: string) => IST_DATE_TIME.format(new Date(iso));

export const DAY_LABEL: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};
