export type Mode = "metro" | "brts" | "amts" | "gsrtc" | "gmcbus";

export type Place = { stopId?: string; name: string; mode?: Mode; lat: number; lng: number; hubId?: string | null };

export type Stop = {
  id: string;
  name: string;
  mode: Mode;
  lat: number;
  lng: number;
  approx: boolean;
  lines: string[];
  hubId: string | null;
};

export type NearStop = Stop & { distanceM: number };

export type Weather = { time: string; tempC: number; feelsLikeC: number; precipMm: number; source: string; heatMode?: boolean };

export type NotRunning = {
  lineId: string;
  name: string;
  mode: Mode;
  status: "ended" | "notStarted" | "noServiceToday";
  lastDeparture?: string;
  firstDeparture?: string;
};

export type Lang = "en" | "gu" | "hi";

export type Alert = {
  id: string;
  type: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  en: string;
  gu: string;
  hi: string;
  whatsapp: string;
  affectedLines: string[];
};

export type Tag = "recommended" | "fastest" | "fewestTransfers" | "leastWalking" | "cheapest";

export type WalkLeg = {
  type: "walk";
  kind: "access" | "transfer" | "egress";
  from: Place;
  to: Place;
  distanceM: number;
  durationMin: number;
  departTime: string;
  arriveTime: string;
  instruction: string;
  heatWarning?: string;
};

export type RideLeg = {
  type: "ride";
  mode: Mode;
  operator: string;
  lineId: string;
  lineName: string;
  lineShortName: string;
  towards: string;
  from: Place;
  to: Place;
  stopCount: number;
  path: { stopId: string; name: string; lat: number; lng: number }[];
  distanceKm: number;
  headwayMin: number | null;
  departTime: string;
  arriveTime: string;
  waitMin: number;
  rideMin: number;
  instruction: string;
};

export type Leg = WalkLeg | RideLeg;

export type FareShare = {
  operator: string;
  operatorName: string;
  mode: Mode;
  standaloneFare: number;
  km: number;
  sharePct: number;
  amount: number;
};

export type Option = {
  id: string;
  tags: Tag[];
  reason: string;
  signature: string;
  leaveTime: string;
  arriveTime: string;
  totalMin: number;
  rideMin: number;
  waitMin: number;
  walkMin: number;
  walkM: number;
  distanceKm: number;
  transfers: number;
  modes: Mode[];
  operators: string[];
  fare: number;
  standaloneFare: number;
  tickets: { mode: Mode; operator: string; km: number; fare: number; legs: number[] }[];
  fareSplit: {
    standaloneFare: number;
    integratedFare: number;
    discountPct: number;
    savings: number;
    method: string;
    shares: FareShare[];
  };
  legs: Leg[];
};

export type PlanResult = {
  from: Place;
  to: Place;
  departAt: string;
  day: string;
  weather: Weather | null;
  notRunning: NotRunning[];
  disruptions: Alert[];
  options: Option[];
};

export type Meta = {
  region: string;
  modes: { key: Mode; label: string; operator: string; operatorName: string; stops: number; lines: number }[];
  counts: { stops: number; lines: number; hubs: number; corridorOverlaps: number };
  unroutableLines: { id: string; name: string; mode: Mode; missing: string[] }[];
  bounds: { south: number; west: number; north: number; east: number };
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

export type Overlap = {
  id: string;
  lineA: string;
  lineB: string;
  lineAName: string;
  lineBName: string;
  hubs: string[];
  hubNames: string[];
};

export type TicketStatus = "active" | "used" | "cancelled" | "expired";

export type Ticket = {
  id: string;
  status: TicketStatus;
  fare: number;
  standaloneFare: number;
  savings: number;
  from: Place;
  to: Place;
  modes: Mode[];
  operators: string[];
  split: FareShare[];
  legs: { mode: Mode; line: string; lineName: string; from: string; to: string; stops: number; distanceKm: number; departTime: string; arriveTime: string }[];
  qr: string;
  createdAt: string;
  validUntil: string;
};

export type Settlement = {
  trips: number;
  multimodalTrips: number;
  standaloneRevenue: number;
  integratedRevenue: number;
  commuterSavings: number;
  passengerKm: number;
  rules: { integrationDiscountPct: number; fareWeightPct: number; costWeights: Partial<Record<Mode, number>> };
  operators: {
    operator: string;
    operatorName: string;
    mode: Mode;
    trips: number;
    passengerKm: number;
    standaloneRevenue: number;
    settledRevenue: number;
    revenueSharePct: number;
    vsStandalone: number;
  }[];
};
