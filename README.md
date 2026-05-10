# Code System · Standalone

A self-contained Next.js 16 app demonstrating Push's per-customer
**rotating-code attribution** flow. No database, no auth, no external
services — everything runs on an in-memory dev-bus.

Drop this folder anywhere, run `npm install && npm run dev`, open
**`http://localhost:3000/code`**, and walk through the full 5-step
closed loop.

---

## Quick start

```bash
cd code-system-standalone
npm install
npm run dev          # starts on port 3000
open http://localhost:3000/code
```

Other scripts:
```bash
npm run typecheck    # tsc --noEmit
npm test             # jest (27 tests)
npm run build        # production build
npm start            # serve production build
```

---

## What this is

**The flow**: a merchant publishes a "code campaign" → invited creators
accept it → each creator gets a unique tracking link `/r/<token>` →
customers tap the link, see a **6-digit code that rotates every 60 s**
→ walk into the store, read the code aloud → staff types it into a
terminal → a sealed-position bracket lottery decides win/lose →
customer's page auto-flips to a reveal within 5 s.

It's anonymous (cookie sessions, no PII), instantly attributable (each
redemption back-references one creator), and gamified (bracket lottery
distributes prizes by position).

---

## The 5-step closed loop

Open `/code` to see this rendered as a vertical timeline with an
inline preview at every step. The **▶ Run demo** button populates a
campaign + 3 creators + 5 customer landings in one click.

| # | Actor | Action | URL |
|---|---|---|---|
| 1 | Merchant | Publish a campaign | `/code` Step 1 form |
| 2 | Creator | Accept it, mint a `/r/<token>` link | `/code` Step 2 inbox |
| 3 | Customer | Tap link, see rotating 6-digit code | `/r/<token>` |
| 4 | Staff | Type code into the terminal | `/code/terminal` |
| 5 | Customer | Page auto-flips to win/lose reveal | (their `/r/<token>` tab) |

---

## All routes

| URL | What |
|---|---|
| `/` | redirects to `/code` |
| `/code` | one-page playground · 5-step closed loop with inline previews |
| `/code/terminal` | staff numpad redemption terminal |
| `/code/stats` | creator personal analytics (Taps / Visits / Wins / Claim rate) |
| `/code/overview/[campaignId]` | merchant per-campaign aggregate dashboard |
| `/r/<token>` | customer landing — Ticket Panel + rotating code + auto-reveal |
| `/api/code/landing` | POST — mint customer session |
| `/api/code/current?session=<id>` | GET — current minute's TOTP code |
| `/api/code/session-status?session=<id>` | GET — polled by customer page |
| `/api/code/redeem` | POST — staff redemption |
| `/api/code/creator-stats?creator=<handle>&range=<7d/30d/90d/all>` | GET creator analytics |
| `/api/code/merchant-overview?campaign_id=<id>` | GET campaign aggregate |
| `/api/code/dev/state` | GET full bus dump (used by playground polling) |
| `/api/code/dev/publish-campaign` | POST campaign |
| `/api/code/dev/accept-campaign` | POST creator accept |
| `/api/code/dev/reset` | POST clear bus |

---

## Test data

### `/code/terminal` accepts these static codes when the bus is empty
| Code | Outcome |
|---|---|
| `111111` | WIN — Position #3, "Free Coffee" prize |
| `222222` | LOSE — Position #7 |
| `333333` | error · `CODE_ALREADY_USED` |
| `444444` | error · `CODE_NOT_FOUND` |
| `555555` | error · `CAMPAIGN_FULL` |
| anything else | LOSE (default) |

### Real codes
After publishing + accepting + minting a session, the customer page
shows a 6-digit code computed from HMAC-SHA256 of `(session.secret,
floor(unixSeconds / 60))`. Type that code into `/code/terminal` (or
the inline numpad in `/code` Step 4) within the current or previous
minute (±60 s grace).

---

## Bracket lottery

Merchant configures a campaign with a **prize total** + **entry cap**
+ **bracket preset**:
- **Front-Heavy** (default) — 70% of prizes in the first 30% of entries
- **Even** — uniform odds across all positions
- **Sleeper** — 20% of prizes in first 30%, 80% in the back

When the campaign is published, the backend immediately seals a random
subset of "winning positions" and stores it in memory. When staff
redeems, the campaign's claim counter is atomically incremented to
assign a position; the system checks if that position is in the
sealed winning set; outcome is recorded.

This means **every redemption is anonymous lottery** — neither
customer nor staff knows the outcome until the moment of redemption.

See `lib/code/dev-bus.ts` for the full implementation
(`bracketsForPreset`, `sealWinningPositions`, `redeemCode`).

---

## Common edits

| What | Where |
|---|---|
| Add / change creator handles | `KNOWN_CREATORS` in `app/code/CodePlaygroundClient.tsx` |
| Tweak bracket presets | `bracketsForPreset()` in `lib/code/dev-bus.ts` |
| Change TOTP rotation period | `STEP_SECONDS` in `lib/code/totp.ts` (server) + countdown logic in `app/r/[token]/CustomerCodeClient.tsx` |
| Restyle Ticket Panel | `app/r/[token]/customer-code.css` |
| Restyle Staff Terminal Card | `components/code/staff-terminal-card.css` |
| Change demo merchant identity | `bus.merchant` initial in `lib/code/dev-bus.ts` |
| Add a new dev API endpoint | `app/api/code/dev/<name>/route.ts` (folder name **must not** start with `_` — Next treats those as private and won't route) |

---

## Architecture · the dev-bus

`lib/code/dev-bus.ts` exports a singleton stored on `globalThis`
(survives Next.js hot reload, cleared on dev restart). It holds:
- `campaigns` — published campaigns with sealed `winning_positions`
- `links` — per-creator share links
- `sessions` — per-customer sessions w/ TOTP secret
- `redemptions` — completed redemptions

Every API endpoint reads/writes this bus directly. **There's no
database in this build** — all state is memory, lost on restart.

---

## ⚠️ Dev-only — not production-safe

This standalone app is for prototyping and demo. Not suitable for
production:

- ❌ No database — every restart wipes campaigns + sessions
- ❌ No authentication — `/code/terminal` is publicly reachable; anyone
  can redeem any active code
- ❌ No rate limiting — `/api/code/redeem` can be brute-forced
  (1 M codespace, 60 s window)
- ❌ No CSRF protection on POST endpoints
- ❌ No real customer identity — purely cookie-based session
- ❌ No FTC §255 / GDPR consent persistence
- ❌ Multi-staff sub-accounts not supported
- ⚠️ Screenshot-share attack open: customer A's code in the wild for
  60 s; anyone who reads it can redeem under A's session

Production would need: Postgres / Supabase migration applied, real
auth flows (merchant + creator + per-staff), rate-limit middleware,
FTC consent_events writes, anti-fraud signal stream.

---

## File tree

```
code-system-standalone/
├── package.json
├── tsconfig.json
├── next.config.ts
├── jest.config.js
├── README.md
├── app/
│   ├── layout.tsx
│   ├── page.tsx                  → redirect("/code")
│   ├── globals.css               (design tokens + helper classes)
│   ├── code/
│   │   ├── page.tsx + CodePlaygroundClient.tsx + code-playground.css
│   │   ├── terminal/             (numpad + outcome reveal)
│   │   ├── stats/                (creator analytics)
│   │   └── overview/[campaignId]/ (merchant aggregate)
│   ├── r/[token]/                (customer landing)
│   └── api/code/                 (11 endpoints)
├── lib/
│   ├── code/                     (TOTP + format + dev-bus)
│   └── api/responses.ts
├── components/
│   ├── code/                     (StaffTerminalCard, CodeOutcomeReveal, CountdownRing)
│   └── shared/                   (PageHeader, KPICard, Sparkline, RecentActivity)
└── tests/
    └── unit/                     (TOTP + dev-bus, 27 tests)
```

---

## Extracting to a separate repo

To move this folder to its own GitHub repo:

```bash
cp -R code-system-standalone /tmp/code-system-standalone
cd /tmp/code-system-standalone
git init
git add -A
git commit -m "init from Push parent repo"
gh repo create code-system-standalone --public --source=. --push
```

Or use `git subtree split` from the parent repo to preserve history.
