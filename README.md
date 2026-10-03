# Triage

**Know which jobs deserve your time.** Triage searches LinkedIn, Indeed, and
Glassdoor at once, merges duplicate postings, X-rays every posting for what job
boards bury (real work style, level, visa stance, pace, red flags, pay hidden in
the text), and ranks everything by how well it fits *you*, including
dealbreakers you write in plain English.

Built with React 19 (Create React App + PWA template), Express 5, MongoDB
(Mongoose 9), [Apify](https://apify.com) scrapers, and TypeSafe's **Jev**
System One model.

## What it does

| | |
| --- | --- |
| **Hunt** | One search runs three Apify scrapers in parallel. Results stream in per board, duplicates across boards are merged (e.g. "ERCOT/Electric Reliability Council of Texas" on Indeed = "Electric Reliability Council of Texas, Inc." on Glassdoor), and repeat searches within 6 hours are served from cache at no scraping cost. |
| **X-ray** | Jev reads each posting once (shared by all users): remote / hybrid / on-site, seniority, employment type, years required, degree, visa sponsorship, pace, clarity, and red flags. When a board gives no salary, code finds candidate money spans and Jev picks the one that's actually the pay. |
| **Fit Lens** | Your profile vs. each job: skills coverage, level match, role match, commute, pay vs. your floor, posting quality, must-haves, and dealbreakers. Weights are sliders; re-ranking is instant and makes no API calls. |
| **Requirement check** | On demand, every requirement bullet is judged against your profile (met / partly / weak / not met, required vs. preferred), with "lead with these skills" and "keywords you haven't listed". |
| **Tracker** | Kanban pipeline (Saved → Applied → Interviewing → Offer → Closed, with Hired / Rejected / Withdrew / Ghosted), drag and drop, follow-up reminders, notes, contacts, excitement, and a timeline. |
| **Insights** | Pipeline, weekly activity, response rate, the skills employers in your searches ask for (with your gaps highlighted), pay distribution vs. your floor, work style and board mix. |
| **Saved searches** | Re-run a search later and see only postings that are new since last time. |
| **Profile** | Target roles, skills (with suggestions pulled from your resume), PDF / DOCX / text resume import, locations, accepted work styles, salary floor, dealbreakers, must-haves, hidden companies. |

Guests can search all three boards and see each posting's X-ray. The profile
is an account feature: signing up unlocks the profile page and everything built
on it (fit scores, requirement checks, hiding companies), plus the tracker,
insights, and saved searches. A guest's recent searches move into the account
on sign-up. The server enforces this too: profile, resume, fit, and
requirement endpoints all require a signed-in user.

Keyboard: `/` search · `j`/`k` next/previous · `o` open apply page · `s` save ·
`f` filters · `?` help.

## How it uses Jev

Jev returns typed judgments (Choices, Scores, Nouls) with probabilities rather
than generated text. Code owns the workflow; Jev supplies the judgment calls.

1. **X-ray** (`server/lib/xray.js`): one request per job with 9–10 parallel
   questions over the posting only. Stored on the job, so it's paid once per
   posting. 12 jobs take about 0.4 s.
2. **Pay selection** (select, don't generate): `server/lib/salary.js` finds
   money spans with context; a Choice question picks which span is the pay (or
   none: bonus, funding round, revenue). Code parses and annualizes it, and only
   accepts picks with probability ≥ 0.55.
3. **Fit** (`server/lib/fit.js`): skills, level, role, and commute questions,
   plus one Noul per dealbreaker and must-have. Questions the profile can't
   support (no locations → no commute) are skipped. Cached per job + profile
   hash for 14 days.
4. **Requirement check** (`server/lib/requirements.js`): code extracts bullets
   by section; Jev scores each (met?), and checks whether it's a must-have and
   whether it's a qualification at all (vs. a duty or perk).

Arithmetic stays in code: salary math, the weighted fit score
(`client/src/lib/fit.js`), dates, and counting.

## Setup

Requires **Node 22+** (developed on Node 24).

```bash
npm run install:all
```

Create `server/.env` from `server/.env.example`:

| Variable | Purpose |
| --- | --- |
| `TYPESAFE_API_KEY` | Jev key. Server only. Without it, search works but X-ray and fit are off. |
| `APIFY_TOKEN` | Apify API token. Without it, live searches are off. |
| `MONGODB_URI` | Atlas connection string **without** a database name |
| `MONGODB_DB` | Database name (default `triage_jobs`) |
| `JWT_SECRET` | Long random string for signing sessions |
| `API_PORT` | API port (default 5070; the React dev server runs on 3200. Avoid 5060, which Chrome blocks) |

Optional tuning (results per board, Apify spend cap per run, cache hours, search
quotas, which Apify actors to use) is documented in `server/.env.example`.

Without `MONGODB_URI` (or if Atlas is unreachable), Triage runs in **guest
mode**: searches and X-rays work from in-memory storage; accounts, profiles,
fit scoring, the tracker, and insights are unavailable.

## Run

```bash
npm run dev        # API on :5070 + React dev server on :3200 (proxied)
npm test           # server (node:test) + client (Jest) tests
npm run build      # production build of the client
npm start          # Express serves the API and client/build on API_PORT
```

The production build registers a service worker, so the app is installable and
its shell opens offline (searching still needs the server).

## Cost controls

- Scrapers used: `valig/linkedin-jobs-scraper` (~$0.40 / 1,000 jobs),
  `valig/indeed-jobs-scraper` (~$0.10 / 1,000), `valig/glassdoor-jobs-scraper`
  (~$0.40 / 1,000), plus about $0.001 per run start. A 25-per-board search costs
  about $0.03.
- Every run passes `maxItems` and `maxTotalChargeUsd` (default $0.25), and runs
  still going after 5 minutes are aborted.
- Identical searches within `SEARCH_CACHE_HOURS` reuse results.
- Live searches are capped per guest IP per hour and per account per day.
- Jev is billed on input tokens only (about $0.04 per million). X-ray results
  are shared across users; fit and requirement results are cached.

## Security

- Passwords: bcrypt (12 rounds), timing-safe login for unknown emails, rate
  limited. Sessions: HS256 JWTs; changing the password revokes other sessions.
- All input is validated with zod; MongoDB queries never take raw user objects.
- Scraped HTML is converted to plain text blocks on the server and rendered as
  React elements, so posting markup never reaches the DOM.
- helmet sets a strict CSP when the server hosts the build (no inline scripts;
  the theme bootstrap is `public/theme-init.js` and CRA's runtime chunk isn't
  inlined).
- API keys stay in `server/.env` and are never sent to the browser. `.env` is
  git-ignored.

## Project layout

```
server/
  index.js                Express app, helmet/CSP, compression, error handling, static hosting
  config.js, db.js        Environment and MongoDB connection (guest-mode fallback)
  lib/sources.js          Apify actor inputs + normalizers for LinkedIn, Indeed, Glassdoor
  lib/apify.js            Run with spend cap, wait, read dataset, friendly errors
  lib/searches.js         Search orchestration: parallel runs, merge, dedupe, X-ray, resume after restart
  lib/normalize.js        Shared job shape and cross-board duplicate detection
  lib/html.js             Posting HTML → typed text blocks
  lib/salary.js           Pay parsing, annualizing, candidate spans
  lib/skills.js           Skill lexicon (tags, resume suggestions, missing keywords)
  lib/xray.js, fit.js, requirements.js   Jev questions and answer readers
  lib/jev.js              TypeSafe client: timeout, retries, concurrency cap
  lib/store.js            MongoDB or in-memory storage behind one interface
  routes/                 auth, profile (+ resume upload), searches, saved-searches, jobs, applications, insights
  models/                 User (+ profile, saved searches), Job, Search, Application, Judgment (cache)
client/src/
  views/                  Hunt, Job, Tracker, Insights (lazy-loaded), Profile
  components/             Search bar, progress, filters, job card, detail panels, dialogs
  hooks/                  Auth + profile sync, router, searches, fit scoring, tracker
  lib/fit.js, filters.js  Fit scoring and filtering in the browser
```

## Notes on the dependency updates

- **Mongoose 5 → 9**: `useNewUrlParser`, `useUnifiedTopology`, `useCreateIndex`,
  and `useFindAndModify` no longer exist (passing them throws), so `db.js`
  connects without them and appends the database name and
  `retryWrites=true&w=majority` to `MONGODB_URI`.
- **bcrypt 4 → 6** (prebuilt binaries for current Node), **jsonwebtoken 8 → 9**,
  **Express 4 → 5** (async errors reach the error handler), **dotenv 18**,
  **nodemon 3**, **concurrently 10**, **babel-loader 7 → 10** (babel-loader 7
  only worked with Babel 6).
- Added: `apify-client`, `helmet`, `compression`, `express-rate-limit`, `zod`,
  `multer`, `pdf-parse`, `mammoth`, `htmlparser2`, `morgan` (server);
  `@tanstack/react-query`, `recharts`, `lucide-react`, Workbox (client).
- Create React App is no longer maintained. `react-scripts` 5.0.1 works with
  React 19 here, but moving the client to Vite would be the natural next upgrade.
