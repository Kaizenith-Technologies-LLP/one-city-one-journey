import { loadNetwork } from './services/network.js';
import { detectHubs, detectCorridorOverlaps } from './services/overlap.js';
import { Planner } from './services/planner.js';

/** Everything derived from the network data, rebuilt whenever it changes. */
let state = null;
let loadError = null;

export function initState(docs) {
  try {
    const network = loadNetwork(docs);
    const { hubs, stopToHub, links } = detectHubs(network);
    const overlaps = detectCorridorOverlaps(network, stopToHub);
    const planner = new Planner(network, stopToHub);
    state = { network, hubs, hubById: new Map(hubs.map((h) => [h.id, h])), stopToHub, links, overlaps, planner };
    loadError = null;
  } catch (err) {
    state = null;
    loadError = err;
  }
  return { state, loadError };
}

export function getState() {
  if (!state) {
    const err = new Error(`Transit data not loaded: ${loadError?.message ?? 'unknown error'}`);
    err.status = 503;
    throw err;
  }
  return state;
}
