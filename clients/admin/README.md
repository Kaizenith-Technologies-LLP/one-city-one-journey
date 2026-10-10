# One Journey Admin Portal

Next.js (App Router, TypeScript, Tailwind) portal for operators to manage the network, fares, tickets, closures and reports of the One City, One Journey service.

Live: https://admin-production-3546.up.railway.app

## Run

```bash
npm install
npm run dev      # http://localhost:3001
npm run build
npm start        # serves the build on port 3001
npm run lint
```

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_BASE` if the API is not at `http://localhost:4000/api`. The value is baked in at build time.

**Sign in:** use the API's `ADMIN_TOKEN` value as the password. The token is kept in the browser's localStorage, and any `401` from the API returns you to the sign-in page.

## Pages

| Page | What you can do |
|---|---|
| Dashboard | Network counts, ticket stats, revenue per operator, 14-day revenue |
| Morning brief | One-page daily report: per-operator tickets and revenue vs the 7-day average, exceptions with possible causes, closures and changes that day. Printable. |
| Diversions | Close a line, a line section or a stop for a time window. Shows advisories in English, Gujarati and Hindi, with copy buttons for each and a WhatsApp-ready message. |
| Stations | Search, create, edit and delete stops (force delete also removes them from lines); edit platforms |
| Lines & routes | Edit lines, reorder stops, suspend or resume a line |
| Interchange hubs | Overlapping stations found by the API |
| Fares | Fare slab editor per mode |
| Fare sharing | Integration discount, fare weight and per-mode cost weights, with a live split preview |
| Tickets | Filter, inspect, validate and cancel tickets; revenue per operator |
| Audit log | Every admin change, with before and after values |

Changes to stops, lines and fares are written to the API's data files and applied to journey planning immediately.

## Structure

```
src/
  app/
    login/page.tsx
    (admin)/layout.tsx       authenticated shell
    (admin)/<section>/page.tsx
  components/Shell.tsx       sidebar navigation
  components/ui.tsx          shared UI primitives
  lib/api.ts                 fetch wrapper with auth and errors
  lib/types.ts               API types
  lib/modes.ts               mode labels and formatting
```
