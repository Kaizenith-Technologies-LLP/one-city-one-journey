# One City, One Journey

**One planner, one ticket for public transport across Ahmedabad and Gandhinagar:** Metro (GMRC), BRTS (Janmarg), AMTS, GSRTC and the Gandhinagar city bus.

Built for **Metro Hacks, Track 2, PS-08: One City, One Journey**. It also borrows from PS-10 (diversions), PS-11 (heat-aware routing) and PS-13 (management brief).

---

## Quick access for judges

| | |
|---|---|
| **Android app** | [Download one-journey-v1.0.1.apk](https://github.com/Kaizenith-Technologies-LLP/one-city-one-journey/releases/download/v1.0.1/one-journey-v1.0.1.apk) ([release page](https://github.com/Kaizenith-Technologies-LLP/one-city-one-journey/releases/tag/v1.0.1)) |
| **Booking website** | https://web-production-72210.up.railway.app (plan and book in a browser, no install) |
| **Admin portal** | https://admin-production-3546.up.railway.app |
| **Admin password** | `OneJourney-PS08-Judges` (full access) |
| **Live API** | https://api-production-1452.up.railway.app/api |
| **Source code** | https://github.com/Kaizenith-Technologies-LLP/one-city-one-journey |

**Install the app:** open the APK link on an Android phone (Android 7.0 or later). Allow "Install unknown apps" when asked. The APK is signed for sideloading.

**Open in a browser, no install needed:**
- [Journey plan: Thaltej Gam → APMC at 09:00](https://api-production-1452.up.railway.app/api/plan?from=metro-thaltej-gam&to=metro-apmc&depart=09:00)
- [Overlapping stations (interchange hubs)](https://api-production-1452.up.railway.app/api/hubs)
- [Corridor overlaps between operators](https://api-production-1452.up.railway.app/api/overlaps) (empty on today's data)
- [Network summary and data coverage](https://api-production-1452.up.railway.app/api/meta)
- [Live weather used for heat-aware routing](https://api-production-1452.up.railway.app/api/weather)
- [Active service alerts](https://api-production-1452.up.railway.app/api/closures)
- [Operator fare settlement](https://api-production-1452.up.railway.app/api/settlement)

> Admin edits to stations, lines and fares are reset to the sourced data on each redeploy. Tickets, closures and settings persist.

---

## Evaluation walkthrough (about 5 minutes)

1. **Plan a journey (app, Plan tab).**
   - Set *From: Thaltej Gam* and *To: APMC*.
   - The recommended route takes Metro Blue, changes at **Old High Court** and continues on Metro Red.
   - Clock times come from the official GMRC timetable, and the change wait is computed from real departures.
   - A short line explains why this route is recommended.
2. **Compare options.** Use the filter chips *Recommended, Fastest, Fewest changes, Least walking, Cheapest*. Each card shows leave and arrive times, number of changes, walking distance and total fare.
3. **Open the journey.** You get a map plus a step-by-step timeline: where to walk and for how long, which direction to board, how many stops, and where to get off.
4. **Book one ticket.**
   - The sheet shows the integrated fare and the **revenue split between operators**. Confirm.
   - The ticket appears under **Tickets**, with a ticket code, validity countdown and live status.
5. **Validate it (admin portal → Tickets).** Find the ticket and press *Validate*. Its status in the app changes to *used*.
6. **Create a disruption (admin portal → Diversions).**
   - Close *Metro Blue* for the next hour.
   - Open *Advisory* to see the notice in **English, Gujarati and Hindi**, plus a WhatsApp-ready message.
7. **Re-plan in the app.**
   - The planner avoids the closed line.
   - The alert banner appears with a language toggle.
   - The empty or alternative result explains what is not running.
8. **See the overlapping stations (app → Interchanges).** These are places where Metro, BRTS, AMTS and GSRTC stops meet, such as Kalupur, Ranip and Geeta Mandir, with the longest walk between them.
9. **Read the management view (admin portal).**
   - *Morning brief*: per-operator tickets and revenue against the 7-day average, with exceptions and possible causes.
   - *Fare sharing*: change the discount or weights and watch the live split preview.
   - *Audit log*: every change you made, with before and after values.

---

## PS-08 requirements and where to see them

| PS-08 asks for | How it is met | Where to see it |
|---|---|---|
| Combine Metro, BRTS and AMTS into one planner | One connected network of 179 stops and 22 lines across 5 operators. Transfers between modes come from the detected interchange hubs. | App → Plan; `/api/meta` |
| Enter a start and a destination | Search any stop, or drop a pin anywhere on the map; the nearest stops within walking range are used | App → Plan |
| Compare alternative routes | Up to 5 options: the fastest for each number of changes, plus alternatives that avoid each line of the fastest route | App → Results |
| One estimated total fare | Each leg is priced on its operator's distance slabs and combined into one integrated fare | Results cards, booking sheet |
| Transfer walking distance and time | Every walk shows metres and minutes, and every change includes the wait until the next departure | Journey timeline |
| Step-by-step itinerary | Clock time, line, direction, stop count and get-off stop for every leg | Journey timeline |
| Fastest, cheapest or least-walking route | Each option is tagged; filter chips re-sort by each criterion | Results filter chips |
| Route-finding algorithm | **RAPTOR** (round-based public transit routing) on timetabled trips | `backend/src/services/planner.js` |
| Fare and travel-time calculations | Fares from operator slab tables; times from published timetables and run times | `fares.js`, `schedules.js` |
| *Bonus:* fare sharing between operators | Integrated-ticket discount plus a transparent revenue split; settlement from issued tickets | Booking sheet, App → Fare share, Admin → Fare sharing |
| *Use sample data* | Uses **real, sourced data** instead. Each record cites its source. | `backend/data/*.json` |

## Beyond the brief

| Feature | What it adds |
|---|---|
| **Overlapping stations** | Stops of different modes within 300 m, or within 800 m with a matching name, are merged into interchange hubs: 21 on today's data, including 3-mode hubs such as Kalupur and Ranip. *Corridor overlaps* show where two operators run through the same consecutive hubs; none are found on today's data, because only consecutive shared hubs count. |
| **Schedule-aware feasibility** | A change is offered only if you can make it: at least a 2-minute buffer plus the walking time, inside each line's service hours. Late at night, when nothing is running, it shows the first trips of the next morning and lets you book them. A "Tomorrow" departure option is also available. Stops without a timetabled line walk you to the nearest Metro station. |
| **Diversions (PS-10)** | Close a line, a line section or a stop for a time window. The planner routes around it. Advisories are generated in English, Gujarati and Hindi, with a WhatsApp-ready text. |
| **Heat-aware routing (PS-11)** | Live feels-like temperature from Open-Meteo. At 40 °C and above (the IMD heatwave threshold for the plains), the recommendation favours less walking among routes arriving within 10 minutes, and walks of 300 m or more are flagged. |
| **Morning brief (PS-13)** | A one-page daily report across operators, with flagged ±25% moves against the 7-day average. Possible causes are drawn from closures, line suspensions, fare changes and observed rain or heat. |
| **Integrated ticket lifecycle** | Signed QR code, validity window, validate, cancel with refund, revenue reports. |
| **Operator admin portal** | Manage stations and platforms, lines (reorder, suspend), fares, fare-sharing rules, tickets and closures, with a full audit log. |

---

## How it works

### Route planning
1. **Network.**
   - Each line runs as two patterns, one per direction.
   - Stop times come from the published run time, spread over the line by distance.
   - Trips come from the published timetable, or are generated from the published headway bands for the day of the week (IST).
2. **Search.** RAPTOR round *k* finds the earliest arrival at every stop using at most *k* rides (up to 5), giving the fastest journey for each number of changes.
   - Walking links: up to 500 m between any two stops, plus any distance within an interchange hub. One walk is allowed after each ride.
3. **Alternatives.** The search re-runs without each line of the fastest journey. Options that are no better on arrival, changes, walking or fare are dropped.
4. **Recommendation.** Among options arriving within 3 minutes of the earliest, pick fewest changes, then least walking, then lowest fare. In heat, pick least walking within 10 minutes. The reason is returned with the option.

### Fares and fare sharing
- **Ticketing.** Consecutive Metro or BRTS legs share one ticket priced on total distance, since both allow in-system transfers. AMTS, GSRTC and the city bus charge per boarding.
- **Integrated fare** = sum of leg fares × (1 − 10% discount) when a trip uses two or more operators.
- **Each operator's share** = 50% × (its standalone fare ÷ total standalone fare) + 50% × (its cost-weighted passenger-km ÷ total).
  - Until an admin enters a cost weight for every operator in the trip, the split follows standalone fares only. No cost figures are assumed.
  - Discount, fare weight and cost weights can all be changed in the admin portal.
- **Settlement** totals the split of every issued ticket, net of refunds.

### Overlapping stations
- Pairs of stops from different modes are joined with union-find when they are within 300 m of each other, or within 800 m with a matching normalised name ("Paldi" Metro and "Paldi" BRTS).
- Each hub records its modes, lines and longest internal walk.
- Lines from different operators that pass through 2 or more of the same consecutive hubs are reported as corridor overlaps.

---

## Architecture

```
 Commuters ──>  Flutter app (clients/app)        Public website (clients/web)
                         │   HTTPS / JSON                  │
                         └──────────────┬──────────────────┘
                                        v
                ┌────────────────────────────────────────────────┐
                │ API: backend/ (Node.js 20+, Express 5)        │
                │ RAPTOR planner · hubs & overlaps · fares       │
                │ tickets · closures · brief · weather           │
                └────────┬───────────────────────────┬───────────┘
                         │                           │
            backend/data/*.json            storage/*.json on a persistent
            transit network (in git)       volume: tickets, closures,
                                           settings, audit log
                         ^
 Operators ──>  Admin portal (clients/admin, Next.js)
```

The **API is the single source of truth**. Every client uses the same endpoints.

| Layer | Technology |
|---|---|
| API | Node.js, Express 5, ES modules (dependencies: `express`, `cors`) |
| Mobile app | Flutter 3.47 (`http`, `flutter_map`, `latlong2`) |
| Admin portal | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Public website | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Leaflet |
| Maps | OpenStreetMap tiles |
| Weather | Open-Meteo |
| Hosting | Railway (API with a persistent volume, admin portal, website); GitHub Releases (APK) |

## Data and sources

All data is **real and cited**. Values that could not be verified are left empty, never estimated.

| Data | Source |
|---|---|
| Stops and line geometry | OpenStreetMap (incl. Metro route relations 9521935, 14658372, 18391195, 18084556), Wikipedia, yometro route pages |
| Metro timetables | GMRC timetable and frequency card valid from 18 May 2026 |
| GSRTC timetables | GIFT City GSRTC timetable |
| AMTS timetables | AMTS timetable, May 2024 (archived copy) |
| Fares | GMRC (metrofare.in), AMTS July 2023 revision, Gandhinagar city bus (June 2026) |
| Weather | Open-Meteo |

**Coverage today:**
- **Routed:** all 4 Metro lines (Blue, Red, Yellow, Violet).
- **Present but not routed** (used for interchange detection):
  - BRTS: no published timetable or fare-slab table.
  - GSRTC: no fare table.
  - AMTS: run times not published.
  - Gandhinagar city bus: the timetable cannot be reached.
- `/api/meta` lists every unroutable line and exactly what it is missing. Entering that data in the admin portal makes the line routable immediately.

---

## API examples

```bash
API=https://api-production-1452.up.railway.app/api

# Journey options, leaving at 09:00 today (IST)
curl "$API/plan?from=metro-thaltej-gam&to=metro-apmc&depart=09:00"

# From a map point to a stop
curl "$API/plan?from=23.0225,72.5714&fromName=Home&to=metro-motera-stadium"

# Search stops
curl "$API/stops?q=kalupur"

# Book an integrated ticket for the recommended option
curl -X POST "$API/tickets" -H "Content-Type: application/json" \
  -d '{"from":"metro-thaltej-gam","to":"metro-apmc","depart":"09:00"}'

# Admin: sign in, then use the returned token as a bearer token
curl -X POST "$API/admin/login" -H "Content-Type: application/json" \
  -d '{"password":"OneJourney-PS08-Judges"}'
```

The full endpoint list is in [`backend/README.md`](backend/README.md).

## Run locally

Requirements: Node.js 20+; Flutter 3.47+ for the app.

```bash
# API on http://localhost:4000
cd backend && npm install
ADMIN_TOKEN=<secret> TICKET_SECRET=<secret> npm run dev

# Admin portal on http://localhost:3001 (sign in with ADMIN_TOKEN)
cd clients/admin && npm install && npm run dev

# App against the live API
cd clients/app && flutter pub get
flutter run --dart-define=API_BASE=https://api-production-1452.up.railway.app/api
```

## Deployment

Railway project `one-city-one-journey`:

| Service | Folder | Configuration |
|---|---|---|
| `api` | `backend/` | Volume at `/data`; `STORAGE_DIR=/data/storage`, `ADMIN_TOKEN`, `TICKET_SECRET` |
| `admin` | `clients/admin/` | `NEXT_PUBLIC_API_BASE` = the API URL; `PORT=3001` |
| `web` | `clients/web/` | `NEXT_PUBLIC_API_BASE` = the API URL |

To deploy: run `railway link` once in the folder, then `railway up --service <name>`. The APK is published as a GitHub Release.

## Repository layout

| Path | Contents |
|---|---|
| [`backend/`](backend/README.md) | API, planner, business logic, transit data, data validator |
| [`clients/app/`](clients/app/README.md) | Flutter commuter app |
| [`clients/admin/`](clients/admin/README.md) | Admin portal |
| `clients/web/` | Public commuter website: plan, book, my tickets, alerts |
| `docs/PLAN.md` | Original build plan |

## Not in this version

- **Payments:** tickets are issued without payment, and refunds are a status change only.
- **Storage:** JSON files on a persistent volume, not a database.
- **Admin accounts:** one shared password; no individual accounts or roles.
- **API protection:** no rate limiting; CORS is open.
- **Map tiles:** the public OpenStreetMap tile servers, whose usage policy does not allow heavy production traffic.
- **Day-specific exceptions:** GSRTC runs no service on Sundays or the 2nd and 4th Saturdays, and these exceptions are not modelled.
- **Ticket storage in the app:** booked tickets are kept for the current app session only.
- **Automated tests:** none in the repository. Verification was done by end-to-end API runs, `flutter analyze` and production builds.
