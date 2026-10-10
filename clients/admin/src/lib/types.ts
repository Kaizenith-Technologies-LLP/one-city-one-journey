export type Mode = "metro" | "brts" | "amts" | "gsrtc" | "gmcbus";

export type Platform = { id: string; name: string; lineIds: string[]; direction: string; accessible: boolean };

export type Stop = {
  id: string;
  name: string;
  mode: Mode;
  lat: number;
  lng: number;
  approx: boolean;
  lines: string[];
  platformCount: number;
  hubId: string | null;
};

export type StopDetail = Omit<Stop, "lines" | "platformCount"> & {
  platforms: Platform[];
  lines: { id: string; name: string; shortName?: string; mode: Mode; color: string; active: boolean }[];
};

export type Line = {
  id: string;
  name: string;
  shortName: string;
  mode: Mode;
  operator: string;
  color: string;
  stops: string[];
  avgSpeedKmph: number;
  headwayMin: number;
  active: boolean;
  suspendedReason?: string;
  suspendedAt?: string;
  stopCount: number;
  lengthKm: number;
  from?: string;
  to?: string;
};

export type LineStop = { id: string; name: string; mode?: Mode; lat?: number; lng?: number; missing?: boolean };
export type LineDetail = Omit<Line, "stops"> & { stops: LineStop[] };

export type Slab = { uptoKm: number; fare: number };
export type FareTable = Record<Mode, { label: string; operator: string; color: string; currency: string; slabs: Slab[]; source: string | null; configured: boolean }>;

export type Settings = {
  integrationDiscount: number;
  fareWeight: number;
  costWeights: Record<Mode, number>;
  modes: Record<Mode, { label: string; operator: string; color: string }>;
  defaults: { integrationDiscount: number; fareWeight: number; costWeights: Record<Mode, number> };
};

export type TicketStatus = "active" | "used" | "cancelled" | "expired";

export type Ticket = {
  id: string;
  status: TicketStatus;
  channel: string;
  from: { name: string; stopId?: string; lat: number; lng: number };
  to: { name: string; stopId?: string; lat: number; lng: number };
  optionId: string;
  tags: string[];
  fare: number;
  standaloneFare: number;
  savings: number;
  discountPct: number;
  currency: string;
  totalMin: number;
  distanceKm: number;
  transfers: number;
  modes: Mode[];
  operators: string[];
  split: { operator: string; operatorName: string; mode: Mode; km: number; sharePct: number; amount: number }[];
  splitMethod: string;
  legs: { mode: Mode; operator: string; lineId: string; line: string; lineName: string; color: string; from: string; to: string; stops: number; distanceKm: number }[];
  qr: string;
  createdAt: string;
  validUntil: string;
  usedAt: string | null;
  cancelledAt: string | null;
  refundAmount: number | null;
  cancelReason?: string;
  validatedBy?: string;
};

export type OperatorRevenue = { operator: string; operatorName: string; mode: Mode; color: string; tickets: number; passengerKm: number; gross: number; net: number; sharePct: number };

export type Dashboard = {
  dataLoaded: boolean;
  counts: { stops: number; lines: number; activeLines: number; suspendedLines: number; hubs: number; corridorOverlaps: number; platforms: number };
  modes: { key: Mode; label: string; operator: string; color: string; stops: number; lines: number; suspendedLines: number; hubs: number }[];
  hubTypes: Record<string, number>;
  tickets: { issued: number; active: number; used: number; cancelled: number; expired: number; multiOperator: number; revenueTotal: number; issuedToday: number; revenueToday: number; commuterSavings: number };
  revenueByOperator: OperatorRevenue[];
  revenueTodayByOperator: OperatorRevenue[];
  daily: { date: string; tickets: number; revenue: number }[];
};

export type Hub = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  modes: Mode[];
  type: string;
  operators: string[];
  lineCount: number;
  lines: string[];
  maxWalkM: number;
  maxWalkMin: number;
  members: { stopId: string; name: string; mode: Mode; lat: number; lng: number; lines: string[] }[];
};

export type AuditEntry = { id: string; at: string; action: string; entity: string; entityId: string | null; details: Record<string, unknown>; ip: string | null };

export type Paged<T> = { total: number; items: T[] };
