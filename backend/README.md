# One Journey API

Node.js + Express 5 (ES modules) API for the One City, One Journey planner. It holds the transit network, the schedule-aware route planner, interchange detection, fares and fare sharing, tickets, closures, the morning brief and weather.

## Run

```bash
npm install
npm run dev        # restarts on file changes
npm start          # production
npm run validate   # check data/*.json
```

### Environment

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | no (4000) | HTTP port |
| `ADMIN_TOKEN` | for admin | Bearer token and admin password. Without it every `/api/admin` endpoint returns 503. |
| `TICKET_SECRET` | yes in production | Signs ticket QR codes. Without it a per-process key is used, so QR codes stop verifying after a restart. |
| `STORAGE_DIR` | no (`./storage`) | Where tickets, closures, settings and the audit log are written |
| `DATA_DIR` | no (`./data`) | Where the transit network files are read from |

## Layout

```
src/
  index.js                 app setup and route registration
  config.js                modes and operators, planner, heat, overlap and fare-share settings
  state.js                 builds network, hubs, overlaps and planner from the data files
  routes/
    network.js             /meta, /stops, /lines
    overlaps.js            /hubs, /overlaps
    plan.js                /plan, /closures, /weather, /settlement
    tickets.js             public ticket issue and lookup
    admin.js               /admin/* (bearer token)
  services/
    network.js             loads data, decides which lines are routable
    schedules.js           service hours, headway bands and departures
    planner.js             RAPTOR planner, ranking, journey building
    overlap.js             interchange hubs and corridor overlaps
    fares.js               ticket grouping, slab fares, revenue split
    closures.js            diversions and multilingual advisories
    weather.js             Open-Meteo client (cached 15 min)
    admin/                 auth, audit, store, validation, network editing,
                           settings, tickets, dashboard, brief
data/                      stops.json, lines.json, fares.json, schedules.json
scripts/validate-data.mjs  data checks
storage/                   runtime state (ignored by git)
```

## How planning works

1. **Network.**
   - Lines run in both directions. Each direction is a pattern with stop offsets taken from the published run time, spread by distance.
   - A line is only routable when it has service hours, headway bands or departures, a run time and fares for its mode. Missing data is never filled in. `/api/meta` lists `unroutableLines` and what each is missing.
2. **Trips.** Departures come from the published timetable, or are generated from published headway bands for the day of the week (IST).
3. **RAPTOR.** Round *k* finds the earliest arrival at every stop using at most *k* rides (up to 5). That gives the fastest journey for each number of changes.
   - A change needs `transferBufferMin` (2 min) on top of any walk.
   - Walks: up to 500 m between any stops, any distance within an interchange hub, and one walk after each ride.
4. **Alternatives.** The search re-runs without each line of the fastest journey. Options that are worse on arrival, changes, walking and fare are dropped.
5. **Recommendation.**
   - Normally: among options arriving within 3 min of the earliest, pick fewest changes, then least walking, then lowest fare.
   - In heat (feels-like at or above 40 °C): among options within 10 min, pick least walking. Walks of 300 m or more get a `heatWarning`.
6. **Closures.** Active closures remove whole lines. They also block boarding, alighting and walking at closed stops, and riding through closed sections.

## Fares and fare sharing

- **Tickets.** Consecutive legs on Metro or BRTS share one ticket, priced on the total km. AMTS, GSRTC and the city bus charge per boarding.
- **Integrated fare.** The sum of the leg fares, minus the integration discount (10%) when two or more operators are used.
- **Split.**
  - Default rule: `fareWeight` (50%) by each operator's standalone fare, the rest by cost-weighted passenger-km.
  - Until an admin enters a cost weight for every operator in the trip, the split follows standalone fares only.
  - Discount, fare weight and cost weights are editable in the admin portal.

## API

Base path: `/api`. Errors are `{ "error": "message" }` with a matching HTTP status.

### Public

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness and whether data loaded |
| GET | `/meta` | Modes, counts, bounds, unroutable lines |
| GET | `/stops?q=&mode=&limit=` | Search stops |
| GET | `/stops/nearest?lat=&lng=&limit=` | Nearest stops |
| GET | `/stops/:id` | One stop |
| GET | `/lines?geometry=1` | Routable lines, with stops if requested |
| GET | `/lines/:id` | One line with stops |
| GET | `/hubs?minModes=&mode=` | Interchange hubs (overlapping stations) |
| GET | `/hubs/:id` | One hub with its corridor overlaps |
| GET | `/overlaps` | Corridor overlaps between operators |
| GET | `/plan?from=&to=&fromName=&toName=&depart=` | Journey options. `from`/`to` are a stop id or `lat,lng`; `depart` is `HH:MM` (today, IST) or ISO |
| GET | `/closures` | Active and upcoming service alerts with advisories |
| GET | `/weather` | Current weather and the heat threshold |
| GET | `/settlement?from=&to=` | Operator revenue split from issued tickets |
| POST | `/tickets` | Issue an integrated ticket: `{from, to, depart?, signature?, optionId?}` |
| GET | `/tickets/:id` | Ticket and its current status |

`/plan` returns `{from, to, departAt, day, weather, notRunning[], disruptions[], options[]}`. Each option carries leave and arrive times, legs with clock times, fare, the fare split and its tags.

### Admin (`Authorization: Bearer <ADMIN_TOKEN>`)

| Area | Endpoints |
|---|---|
| Auth | `POST /admin/login {password}` |
| Dashboard | `GET /admin/dashboard` |
| Stops | `GET, POST /admin/stops`; `GET, PUT, DELETE /admin/stops/:id` (`?force=1` also removes the stop from lines) |
| Platforms | `GET, POST /admin/stops/:id/platforms`; `PUT, DELETE /admin/stops/:id/platforms/:pid` |
| Lines | `GET, POST /admin/lines`; `GET, PUT, DELETE /admin/lines/:id`; `POST /admin/lines/:id/status {active, reason}` |
| Fares | `GET /admin/fares`; `PUT /admin/fares/:mode` |
| Fare sharing | `GET, PUT /admin/settings`; `POST /admin/settings/reset` |
| Tickets | `GET /admin/tickets`; `GET /admin/tickets/:id`; `POST /admin/tickets/:id/validate`; `POST /admin/tickets/:id/cancel`; `POST /admin/tickets/scan {qr}` |
| Reports | `GET /admin/reports/revenue?from=&to=` |
| Closures | `GET, POST /admin/closures`; `PUT, DELETE /admin/closures/:id` |
| Morning brief | `GET /admin/brief?date=YYYY-MM-DD` (defaults to yesterday, IST) |
| Audit | `GET /admin/audit` |

Every admin write is recorded in the audit log.

## Data files

| File | Content |
|---|---|
| `stops.json` | `{id, name, mode, lat, lng, approx?, platforms?}` |
| `lines.json` | `{id, name, shortName, mode, operator, color, stops[], source, active?}` |
| `fares.json` | `{<mode>: {currency, slabs[{uptoKm, fare}], source}}`; the last slab is `uptoKm: 999` |
| `schedules.json` | `{<lineId>: {source, note?, serviceStart, serviceEnd, runTimeMin, bands[{from, to, headwayMin, days?}] or departures[], reverse?}}` |

Run `npm run validate` after editing any of them.
