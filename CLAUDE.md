# CLAUDE.md — Morning Briefing

## Project Overview

Automated morning commute briefing system for a Korean daily commuter. Every weekday at 07:30 KST, the system fetches real-time traffic, weather, and calendar data, then pushes a briefing via KakaoTalk, Telegram, and ntfy.sh push notifications. A static widget JSON and voice script are also generated for iOS Scriptable and Siri Shortcuts.

**Language note:** This codebase is written in Korean — log messages, comments, variable names, and user-facing strings are all in Korean. Maintain this convention.

---

## Repository Structure

```
morning-briefing/
├── server.js               # Express server + cron scheduler (local dev mode)
├── package.json
├── .env.example            # Template for all required env vars
├── .gitignore
├── services/
│   ├── briefing.js         # Orchestrator: calls all services, sends all notifications
│   ├── tmap.js             # T-map API: geocoding + route (traffic time, congestion)
│   ├── weather.js          # Open-Meteo API: weather + air quality + outfit recommendation
│   ├── telegram.js         # Telegram Bot API sender (supports multiple chat IDs)
│   ├── kakao.js            # KakaoTalk "send to me" API + OAuth token management
│   ├── notification.js     # ntfy.sh push notification + voice script generator
│   ├── calendar.js         # iCal URL parser for today's events
│   └── holiday.js          # Korean public holiday list (hardcoded through 2026)
├── scripts/
│   ├── run-briefing.js     # Entry point for GitHub Actions (writes widget.json + voice.txt)
│   ├── kakao-setup.js      # Helper to set up Kakao OAuth tokens
│   └── get-chat-id.js      # Helper to retrieve Telegram chat ID
├── public/
│   ├── index.html          # Web dashboard (served by Express, deployed to GitHub Pages)
│   ├── widget.json         # Static data for Scriptable lock-screen widget
│   └── voice.txt           # Voice script for iOS Shortcuts TTS
└── .github/
    └── workflows/
        └── morning-briefing.yml  # GitHub Actions: cron 22:30 UTC Sun-Thu = 07:30 KST Mon-Fri
```

---

## Two Operating Modes

### 1. Local Server (`npm start` / `npm run dev`)
- `server.js` runs an Express server on `PORT` (default 3000)
- A `node-cron` job fires at `CRON_SCHEDULE` (default `30 7 * * 1-5`, Asia/Seoul)
- Before sending, the scheduler calls `isHoliday()` and skips on holidays
- Kakao tokens are refreshed automatically via `refreshAccessToken()` before each run

### 2. GitHub Actions (serverless, no persistent state)
- Workflow: `.github/workflows/morning-briefing.yml`
- Trigger: `cron: '30 22 * * 0-4'` (UTC) = 07:30 KST weekdays
- Entry: `scripts/run-briefing.js` — runs briefing, writes `public/widget.json` and `public/voice.txt`
- After run: `peaceiris/actions-gh-pages@v3` deploys `./public` to GitHub Pages
- **Note:** GitHub Actions does NOT use Kakao (no OAuth token persistence). Active channels: Telegram + ntfy.sh

---

## Environment Variables

Copy `.env.example` to `.env` and fill in values.

| Variable | Required | Description |
|---|---|---|
| `TMAP_APP_KEY` | Yes | SK Open API key for T-map routing |
| `TELEGRAM_BOT_TOKEN` | Yes (GH Actions) | Telegram bot token |
| `TELEGRAM_CHAT_ID` | Yes (GH Actions) | Comma-separated chat IDs for multi-recipient |
| `NTFY_TOPIC` | Yes | ntfy.sh topic name (e.g. `wife-commute-1234`) |
| `ICAL_URL` | Optional | iCal URL for calendar events |
| `KAKAO_REST_API_KEY` | Local only | Kakao app REST API key |
| `KAKAO_ACCESS_TOKEN` | Local only | Kakao OAuth access token |
| `KAKAO_REFRESH_TOKEN` | Local only | Kakao OAuth refresh token (auto-renewed) |
| `WEATHER_API_KEY` | Not used | Open-Meteo is keyless; this key is unused |
| `ORIGIN_ADDRESS` | Optional | Departure address (default: 부산진구 동평로 176) |
| `DEST_ADDRESS` | Optional | Destination address (default: 김해시 경원로 73번길 15) |
| `CRON_SCHEDULE` | Optional | node-cron expression (default: `30 7 * * 1-5`) |
| `PORT` | Optional | Express port (default: 3000) |

GitHub Actions secrets needed: `TMAP_APP_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NTFY_TOPIC`, `ICAL_URL`.

---

## Key Business Logic

### Route Calculation (`services/tmap.js`)
- Geocodes origin/destination addresses via T-map Full Address Geocoding API
- Fetches car route with real-time traffic (`trafficInfo: 'Y'`, `searchOption: '0'`)
- **Normal commute baseline:** 25 minutes
- **Delay threshold:** >7 minutes over baseline = `isDelayed: true`
- Congestion levels 3 (지체) and 4 (정체) are extracted as incident names (max 3)
- `getRecommendedDeparture(totalTime, '08:30')`: calculates departure = target arrival − totalTime − 5 min buffer

### Weather (`services/weather.js`)
- Uses Open-Meteo (free, no key) for weather + air quality
- **Hardcoded location:** 부산진구 (lat: 35.158, lon: 129.049) — not configurable via env
- Data is sampled at **index 8** of hourly arrays = 08:00 KST
- Umbrella recommended if rain probability ≥ 40% or weathercode indicates precipitation
- Dust: PM10 > 80 or PM2.5 > 35 = 나쁨; PM10 > 30 or PM2.5 > 15 = 보통
- Outfit recommendation is temperature-banded (8 tiers from 반팔 to 패딩)

### Notifications (`services/briefing.js`)
All three notification channels fire in parallel via `Promise.all`. Individual failures are caught and logged without stopping the others:
- `sendKakaoMessage` (local server only)
- `sendPushNotification` via ntfy.sh
- `sendTelegramMessage`

### Holiday Detection (`services/holiday.js`)
- Fixed Korean public holidays stored as `MM-DD` strings
- Variable holidays (설, 추석, 대체휴일) hardcoded as `YYYY-MM-DD` strings through 2026
- **Needs annual update** when new year's variable holidays are announced

### Telegram Multi-Recipient
`TELEGRAM_CHAT_ID` accepts comma-separated values (e.g. `123456,789012`). Messages are sent sequentially in a for-loop.

---

## API Endpoints (local server)

| Method | Path | Description |
|---|---|---|
| GET | `/api/briefing` | Manually trigger a briefing run |
| GET | `/api/latest` | Return the last generated briefing (in-memory) |
| GET | `/api/widget` | Compact 2-line summary for Scriptable widget |
| GET | `/api/voice` | Plain text voice script for iOS Shortcuts TTS |
| GET | `/api/status` | Server health: Kakao token status, last briefing time, schedule |
| GET | `/auth/kakao` | Start Kakao OAuth flow |
| GET | `/auth/kakao/callback` | Kakao OAuth callback — saves tokens to `.env` |

---

## Development Workflow

```bash
# Install dependencies
npm install

# Local dev with auto-restart
npm run dev

# Production
npm start

# Manually test a briefing run (mimics GitHub Actions)
node scripts/run-briefing.js

# Get Telegram chat ID
node scripts/get-chat-id.js

# Set up Kakao OAuth tokens
node scripts/kakao-setup.js
```

No test suite or linter is configured. Manual testing is done by hitting `/api/briefing` or running `scripts/run-briefing.js` directly.

---

## Conventions

- **Korean first:** All user-facing text, log messages, and comments are in Korean. Do not introduce English strings into UI or log output.
- **Graceful failure:** Every notification channel uses `.catch(e => console.error(...))` — a failed channel must never crash the briefing. Preserve this pattern.
- **In-memory state:** `lastBriefing` in `server.js` is the only shared state. There is no database. GitHub Actions runs are fully stateless.
- **No test framework:** Changes should be manually verified by running the briefing script.
- **Holiday list maintenance:** When adding support for a new year, append variable holidays to the `HOLIDAYS` array in `services/holiday.js`.
- **Weather location:** The weather coordinates in `services/weather.js` are hardcoded. If the commute origin changes, update `LAT`/`LON` in that file manually.

---

## GitHub Actions Notes

- The workflow uses `permissions: contents: write` to allow `peaceiris/actions-gh-pages` to push to `gh-pages` branch.
- `npm ci || npm install` is used for resilience if `package-lock.json` is missing.
- The `workflow_dispatch` trigger allows manual runs from the GitHub UI or via external cron services (e.g. cron-job.org).
- Kakao tokens are NOT available in Actions — only Telegram and ntfy.sh are active there.
