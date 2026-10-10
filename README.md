# One City, One Journey

A single journey planner and integrated ticket for public transport across **Ahmedabad and Gandhinagar**: Metro (GMRC), BRTS (Janmarg), AMTS, GSRTC and the Gandhinagar city bus.

Built for **Metro Hacks, PS-08: One City, One Journey**. It also takes ideas from PS-10 (diversions), PS-11 (heat-aware routing) and PS-13 (management brief).

| | Link |
|---|---|
| **Android app (APK)** | [Download one-journey-v1.0.0.apk](https://github.com/Kaizenith-Technologies-LLP/one-city-one-journey/releases/download/v1.0.0/one-journey-v1.0.0.apk) ([release notes](https://github.com/Kaizenith-Technologies-LLP/one-city-one-journey/releases/tag/v1.0.0)) |
| API | https://api-production-1452.up.railway.app/api |
| Admin portal | https://admin-production-3546.up.railway.app |

**Install the app:** open the APK link on an Android phone (Android 7.0+), then allow "Install unknown apps" when asked.

**Try the API in a browser:** [a journey plan](https://api-production-1452.up.railway.app/api/plan?from=metro-thaltej-gam&to=metro-apmc&depart=09:00) · [interchange hubs](https://api-production-1452.up.railway.app/api/hubs) · [network summary](https://api-production-1452.up.railway.app/api/meta)

---

## What it does

- **Plans the journey across every operator.** It finds the fastest feasible route using the real timetables, so changes line up with actual departures.
  - Every change must leave at least a 2-minute buffer plus the walking time.
  - Routes respect each line's service hours.
  - Results show the trade-off between arrival time and number of changes.
- **Recommends a route and explains why.** By default it picks the earliest arrival, preferring fewer changes, less walking, then the lower fare. Every option is also tagged where it applies: *fastest*, *fewest changes*, *least walking* or *cheapest*.
- **Finds overlapping stations.** Stops of different modes within 300 m of each other, or within 800 m with the same name, are grouped into **interchange hubs**. Example: Kalupur Railway Station (Metro + BRTS + AMTS). Corridors where two operators' lines run through the same hubs are also detected.
- **Sells one integrated ticket** for the whole trip.
  - Each leg is priced on its operator's own fare slabs.
  - A discount applies when a trip uses two or more operators.
  - Each ticket gets a signed QR code. Inspectors can validate it, and admins can cancel it with a refund.
- **Shares fare revenue between operators** by a transparent rule: part by each operator's standalone fare, part by cost-weighted passenger-km. Settlement uses tickets actually issued.
- **Diversions (PS-10).** Admins close a line, a section of a line, or a stop for a time window.
  - The planner routes around the closure.
  - Advisories are generated in **English, Gujarati and Hindi**, plus a WhatsApp-ready message.
- **Heat-aware routing (PS-11).** Live feels-like temperature comes from Open-Meteo. At 40 °C and above (the IMD heatwave threshold for the plains), the recommendation prefers less walking, and long walks are flagged.
- **Morning brief (PS-13).** A one-page daily report for all operators.
  - Tickets and revenue per operator, compared with the 7-day average.
  - Flagged exceptions, with possible causes drawn from closures, suspensions, fare changes and observed weather.

## Architecture

```
            +--------------------+        +----------------------+
 Commuters  |  Flutter app       |        |  Public website      |
 --------->  |  clients/app       |        |  clients/web (Next)  |
            +---------+----------+        +-----------+----------+
                      |        HTTPS / JSON           |
                      v                               v
            +---------------------------------------------------+
            |  API  -  backend/ (Node.js + Express)             |
            |  RAPTOR planner | hubs & overlaps | fares & split |
            |  tickets | closures | brief | weather (Open-Meteo)|
            +-----------+-------------------------+-------------+
                        |                         |
          backend/data/*.json            backend/storage/*.json
          (transit network, in git)      (tickets, closures, settings,
                                          audit; persistent volume)
                        ^
            +-----------+----------+
 Operators  |  Admin portal        |
 --------->  |  clients/admin (Next)|
            +----------------------+
```

The **backend is the single source of truth**. The app, the website and the admin portal are clients of the same API.

## Repository layout

| Path | What it is |
|---|---|
| [`backend/`](backend/README.md) | Express API, route planner, all business logic and the transit data |
| [`clients/admin/`](clients/admin/README.md) | Next.js admin portal for operators |
| `clients/app/` | Flutter commuter app (Android, iOS, web) |
| `clients/web/` | Next.js public commuter website |
| `docs/PLAN.md` | The original build plan |

## Data

All transit data is **real and sourced**: no mock, sample or estimated values. Each line, schedule and fare entry carries its `source` URL.

| Data | Source |
|---|---|
| Stops and line geometry | OpenStreetMap (Metro route relations), Wikipedia, yometro route pages |
| Metro timetables | GMRC timetable and frequency card valid from 18 May 2026 |
| GSRTC timetables | GIFT City GSRTC timetable |
| AMTS timetables | AMTS timetable, May 2024 (archived copy) |
| Fares | GMRC (metrofare.in), AMTS July 2023 revision, Gandhinagar city bus (June 2026) |
| Weather | Open-Meteo |

**Coverage today:**
- **Routed:** all 4 Metro lines (Blue, Red, Yellow, Violet).
- **Not routed yet:**
  - BRTS: no published timetable or fare slab table was found.
  - GSRTC: no fare table.
  - AMTS: run times are not published.
  - Gandhinagar city bus: the timetable is not reachable.

These lines are still used for interchange detection. They join route planning as soon as their data is entered in the admin portal. `GET /api/meta` lists each unroutable line and what it is missing.

## Quick start (local)

Requirements: Node.js 20+, and Flutter 3.47+ for the app.

```bash
# 1. API on http://localhost:4000
cd backend
npm install
ADMIN_TOKEN=<choose-a-secret> TICKET_SECRET=<choose-a-secret> npm run dev

# 2. Admin portal on http://localhost:3001 (sign in with ADMIN_TOKEN)
cd clients/admin
npm install
npm run dev
```

See each component's README for details.

## Deployment

Both services run on **Railway** in the project `one-city-one-journey`:

| Service | Source folder | Notes |
|---|---|---|
| `api` | `backend/` | Volume `api-volume` mounted at `/data`; `STORAGE_DIR=/data/storage` |
| `admin` | `clients/admin/` | `NEXT_PUBLIC_API_BASE` points to the API; `PORT=3001` |

To deploy a service, link the folder to the project once (`railway link`), then from that folder run `railway up --service <name>`.

The admin password is the `ADMIN_TOKEN` variable of the `api` service. Read it in the Railway dashboard under api, Variables.

## Known limitations

- **No payments.** Tickets are issued without payment, and refunds are only a status change.
- **File-based storage.** Data is stored as JSON files on a persistent volume, not in a database.
- **Single shared admin token.** There are no individual accounts or roles.
- **Open API.** CORS is open to any website, and there are no rate limits.
- **Map tiles.** The public OpenStreetMap tile servers are used. Their usage policy does not allow heavy production traffic.
- **Schedule days.** Timetables with day-specific exceptions (GSRTC: no Sunday or 2nd/4th Saturday service) are not yet modelled per day.
