import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** Legacy JSON storage, imported into the database once when its tables are empty. */
export const STORAGE_DIR = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../storage');

/** Mode and operator metadata, plus tunable constants for the planner. */
export const MODES = {
  metro: {
    label: 'Metro',
    operator: 'GMRC',
    operatorName: 'Gujarat Metro Rail Corporation',
    color: '#1E5BC6',
    // Transfers inside the paid area (e.g. Blue <-> Red) keep one ticket.
    sharedTicketWithinMode: true,
  },
  brts: {
    label: 'BRTS',
    operator: 'AJL',
    operatorName: 'Ahmedabad Janmarg Ltd (BRTS)',
    color: '#D7263D',
    sharedTicketWithinMode: true,
  },
  amts: {
    label: 'AMTS',
    operator: 'AMTS',
    operatorName: 'Ahmedabad Municipal Transport Service',
    color: '#F4A300',
    sharedTicketWithinMode: false,
  },
  gsrtc: {
    label: 'GSRTC',
    operator: 'GSRTC',
    operatorName: 'Gujarat State Road Transport Corporation',
    color: '#2A9D8F',
    sharedTicketWithinMode: false,
  },
  gmcbus: {
    label: 'Gandhinagar City Bus',
    operator: 'GMC',
    operatorName: 'Gandhinagar Municipal Corporation',
    color: '#8E44AD',
    sharedTicketWithinMode: false,
  },
};

export const PLANNER = {
  walkSpeedMpm: 80, // 4.8 km/h
  transferWalkMaxM: 500, // walking link between any two nearby stops
  accessWalkMaxM: 1500, // walk from a raw lat/lng to the first stop
  accessMinStops: 3, // always offer at least this many nearest stops
  transferBufferMin: 2, // spare time required at every change, on top of any walk
  maxRides: 5, // up to 4 changes
  similarArrivalMin: 3, // arrivals this close count as equally fast when recommending
  maxOptions: 5,
};

// Heat-aware routing. 40 °C is IMD's minimum maximum-temperature for a heatwave over the plains.
export const HEAT = {
  thresholdC: 40, // feels-like temperature at which walking is weighed down
  longWalkM: 300, // walks this long get a heat warning
  windowMin: 10, // in heat, prefer less walking among routes arriving within this of the fastest
};

export const OVERLAP = {
  nearM: 300, // different-mode stops this close are one hub
  sameNameM: 800, // ...or this close when their names match
};

export const FARE_SHARE = {
  integrationDiscount: 0.1, // off the summed fare when a trip uses 2+ operators
  fareWeight: 0.5, // half of each share follows standalone fares, half follows weighted km
};

// Shipped values, so an override can always be reset.
export const SETTINGS_DEFAULTS = {
  integrationDiscount: FARE_SHARE.integrationDiscount,
  fareWeight: FARE_SHARE.fareWeight,
  // Relative operating cost per passenger-km for each mode. Unset until an admin
  // enters real figures; until then fares are split on standalone fares alone.
  costWeights: {},
};

/** Merges admin overrides into FARE_SHARE and MODES in place (defaults first, so removed keys reset). */
export function applySettings(overrides = {}) {
  const o = { ...SETTINGS_DEFAULTS, ...overrides, costWeights: { ...SETTINGS_DEFAULTS.costWeights, ...overrides.costWeights } };
  FARE_SHARE.integrationDiscount = o.integrationDiscount;
  FARE_SHARE.fareWeight = o.fareWeight;
  for (const [k, m] of Object.entries(MODES)) m.costWeight = o.costWeights[k];
  return o;
}
