# One Journey: Flutter App

Commuter app for One City, One Journey. Plan a trip across Metro, BRTS, AMTS, GSRTC and the Gandhinagar city bus, then book one integrated ticket.

Package `com.kaizenith.one_journey`. Built with Flutter 3.47 / Dart 3.13.

## Features

- **Plan:**
  - "Where to?" search, starting from a stop or a point picked on the map
  - departure time ("Leave now" or a set time) and swap
  - recent trips for one-tap replanning, with a return-trip button
- **Results:**
  - The recommended route comes first, with the reason it was chosen.
  - Filters: Recommended, Fastest, Fewest changes, Least walking, Cheapest.
  - Each option shows leave and arrive times, changes, walking and fare.
  - Service-alert banners in English, Gujarati and Hindi; a heat notice when it is very hot.
  - A clear explanation when no line is running at that time.
- **Journey:** map plus a step-by-step timeline with clock times, waits, interchange walks and the direction to board.
- **Booking:** a confirm sheet with the integrated fare, savings against separate tickets and the operator split. Payment is at the counter; in-app payment is not part of this version.
- **My tickets:** ticket number and code, validity countdown and live status (active, used, cancelled, expired).
- **Service alerts** (closures, with a WhatsApp-ready share text), **Interchanges** (overlapping stations) and **Fare share** (how revenue is split between operators).

**Design:** three colours (navy `#0B3D91`, slate `#475569`, saffron `#F2A900`), icons only, light and dark themes, 48 dp touch targets and screen-reader labels.

## Run

```bash
flutter pub get
flutter run --dart-define=API_BASE=https://api-production-1452.up.railway.app/api
```

`API_BASE` is fixed at build time. Without it, the app uses `http://10.0.2.2:4000/api` on the Android emulator and `http://localhost:4000/api` elsewhere, for a locally running backend.

## Build the APK

```bash
flutter build apk --release --dart-define=API_BASE=https://api-production-1452.up.railway.app/api
```

The output is `build/app/outputs/flutter-apk/app-release.apk`.

To build against a backend on your PC's Wi-Fi address instead, run `./build-apk.ps1`. It detects the LAN IP; pass `-ApiBase` to override it. The script copies the APK to `dist/`.

## Install on a phone

1. Download the APK from the repository's **Releases** page.
2. Open it on the phone and allow "Install unknown apps" for your browser or file manager when asked.
3. The release APK is signed with a debug key, so it can be sideloaded but not published to the Play Store.

## Structure

```
lib/
  main.dart              app shell and bottom navigation
  config.dart            API base URL
  api.dart               HTTP client
  models.dart            API models
  store.dart             in-memory recent trips, places and tickets
  theme.dart             colour tokens, spacing, theme
  screens/               plan, stop search, map pick, results, journey,
                         tickets, ticket, alerts, hubs, settlement
  widgets/               route card, booking sheet, fare breakdown, ticket code,
                         departure chip, disruption card, heat note, map, states
```

Tickets and recent searches are kept for the current session only.
