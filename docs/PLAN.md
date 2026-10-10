# PS-08 — One City, One Journey (Ahmedabad + Gandhinagar)

A single journey planner covering Metro (incl. Phase 2 to Gandhinagar / GIFT City), BRTS, AMTS, GSRTC and Gandhinagar city bus (if it exists), across Ahmedabad and Gandhinagar.

## Structure

```
Temp/
  backend/   Node + Express API: data, overlap detection, route engine, fares, fare sharing
  web/       Next.js web: planner, overlapping stations map, operator settlement dashboard
  app/       Flutter app: commuter journey planner (main deliverable)
```

The backend is the single source of truth. The web and the app are thin clients over the same API.

## 1. Sample data (backend/data)
- **Metro:** Blue line (Thaltej → Vastral Gam) and Red line (Motera → APMC). Real station names, approximate coordinates.
- **BRTS:** 3–4 corridors.
- **AMTS:** 4–5 routes.
- **GSRTC:** state buses. Bus stations in Ahmedabad/Gandhinagar (Geeta Mandir, Ranip, Nehrunagar, …) and 4–6 routes, limited to the city stretch.
- **Per line:** mode, ordered stops, average speed, headway, fare slabs.

## 2. Overlapping stations (key feature)
- **Station hubs:** stops from different modes/lines are grouped into one interchange hub when they are:
  - within 300 m of each other, or
  - within 800 m with a matching normalised name (e.g. "Paldi" Metro + "Paldi" BRTS).
  - Grouping uses union-find.
- **Per hub:** member stops, modes covered, maximum walking distance between members, and a rating (Metro + BRTS + AMTS = triple interchange).
- **Corridor overlap:** stretches where two lines pass through 2+ consecutive shared hubs. These show where services duplicate each other.
- **Uses:** hubs are the transfer points in the route graph, they are highlighted on maps, and they are exposed through the API.

## 3. Route engine
- **Graph nodes:** (stop, line). Edges:
  - ride to the next stop
  - board, with a wait of half the headway
  - alight
  - walking transfer within a hub or between stops ≤ 500 m apart, at 80 m/min
- **Search:** Dijkstra with three weightings: fastest, cheapest, least walking.
- **Results:** duplicates removed, the exact fare recomputed per ride from its distance slab, then labelled routes returned.

## 4. Fare sharing
- **Integrated ticket:** sum of the leg fares, minus 10% when the journey combines modes.
- **Revenue split:** in proportion to each operator's passenger-km × cost weight.
- **Settlement:** a simulated day of N random trips, showing each operator's total.

## API
| Method | Path | Purpose |
|---|---|---|
| GET | /api/stops?q= | search stops |
| GET | /api/lines | all lines with geometry |
| GET | /api/hubs | overlapping stations (interchange hubs) |
| GET | /api/overlaps | corridor overlaps between lines |
| GET | /api/plan?from=&to= | route options + itineraries + fare split |
| GET | /api/settlement?trips= | simulated operator revenue split |

## Clients
- **Flutter app:**
  - search start/destination
  - route cards (fastest / cheapest / least walking)
  - step-by-step itinerary
  - map (flutter_map + OpenStreetMap)
  - fare-split sheet
- **Next.js web:**
  - same planner
  - overlapping stations map + table
  - operator settlement dashboard

## Build order
1. backend data + overlap detection
2. route engine + fares
3. API
4. Flutter app
5. Next.js web
6. polish
