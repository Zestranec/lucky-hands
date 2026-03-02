# Lucky Hands

A browser-based gambling-style mini-game built with **Vite + TypeScript + PixiJS**.

Pick Rock / Paper / Scissors for each of 5 tiles, press PLAY, and watch the
house reveal its choices one by one. Three volatility modes with ~95% RTP by
design.

---

## Quick Start

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview the production build
npm run simulate   # run the RTP simulation (1 M rounds × 3 modes)
```

---

## How to Play

1. **Select a choice** on each of the 5 tiles by clicking/tapping. Each click
   cycles through Rock → Paper → Scissors.
2. Choose a **volatility mode** (LOW / MED / HIGH) using the buttons at the top.
3. Press **PLAY** once all 5 tiles have a selection.
4. Watch the house reveal its picks tile by tile.
5. See your result in the summary overlay, then press **Next Round**.

Bet is fixed at **10 FUN** per round. Starting balance is **1 000 FUN**.

---

## Volatility Modes & Payouts

Payout is *gross return*: `balance = balance - bet + payout`.

| Mode | Win count | Multiplier |
|------|-----------|-----------|
| LOW  | 0 | 0.00× |
| LOW  | 1 | 0.57× |
| LOW  | 2 | 1.14× |
| LOW  | 3 | 1.71× |
| LOW  | 4 | 2.28× |
| LOW  | 5 | 2.85× |
| MED  | 0–1 | 0.00× |
| MED  | 2 | 1.10× |
| MED  | 3 | 2.10× |
| MED  | 4 | 3.80× |
| MED  | 5 | 20.80× |
| HIGH | 0–2 | 0.00× |
| HIGH | 3 | 2.60× |
| HIGH | 4 | 11.20× |
| HIGH | 5 | 14.90× |

All three modes target **~95% RTP** (verified via simulation below).

---

## RTP Simulation

```
npm run simulate
```

Example output (1 000 000 rounds per mode, ~3 s):

```
Lucky Hands RTP Simulation — 1 000 000 rounds per mode
────────────────────────────────────────────────────
  LOW    RTP = 94.88%   (delta vs 95%: -0.12%)
  MED    RTP = 94.94%   (delta vs 95%: -0.06%)
  HIGH   RTP = 94.72%   (delta vs 95%: -0.28%)
────────────────────────────────────────────────────
```

### Why ~95% is correct by design

- `P(win per tile) = 1/3`.
- For LOW mode: `E[payout/bet] = 0.57 × E[wins] = 0.57 × 5/3 ≈ 0.9500` (exact).
- For MED/HIGH: multipliers are chosen so
  `Σ P(w) × mult(w) ≈ 0.95` (verifiable in `Paytables.ts`).
- Simulation variance at 1 M rounds is ±0.3%, which is expected for a
  high-variance HIGH-mode distribution.

---

## Architecture

```
src/
├── main.ts                         Bootstrap — creates GameApp
└── game/
    ├── GameApp.ts                  Top-level coordinator (balance, seed, UI wiring)
    ├── state/
    │   └── GameStateMachine.ts     State enum + guarded transitions
    │                               idle → betting → running → resolve → result → reset
    ├── controllers/
    │   ├── RNG.ts                  Mulberry32 seeded PRNG
    │   ├── OutcomeController.ts    House moves, win count, payout (pure functions)
    │   ├── Paytables.ts            Per-mode multiplier tables + RTP commentary
    │   ├── Simulation.ts           simulateRTP() / runAllSimulations()
    │   └── simulateRTP.ts          CLI entry-point for `npm run simulate`
    ├── models/
    │   └── Types.ts                RPSChoice, VolatilityMode, RoundResult, etc.
    ├── ui/
    │   ├── HUD.ts                  Title, balance, bet, volatility buttons
    │   ├── Board.ts                Row of 5 Tiles
    │   ├── Tile.ts                 Single interactive tile + flip animation
    │   └── ResultPanel.ts          Modal overlay shown after all reveals
    └── utils/
        ├── tween.ts                Ticker-based tween() / wait() helpers
        └── layout.ts               Canvas/tile/button constants + colour palette
```

### Deterministic RNG

Each round is assigned a **seed** (`++seedCounter`, starting from `Date.now()`
at session start). The seed is captured the moment **PLAY is pressed**. All
five house picks are derived from that seed via `RNG (Mulberry32)`. Animation
only reveals pre-decided values — no randomness is used during the animation.

Given the same seed + same player moves + same volatility mode, `OutcomeController.resolveRound()` always returns the identical `RoundResult`.

### State Machine

The state machine in `GameStateMachine.ts` is the single source of truth for
which actions are permitted. The Play button and tile interactions check the
machine's state before doing anything. During `running` and `resolve` phases all
input is locked.

Volatility changes while a round is in progress are queued as `nextVol` and
applied only when the next round begins.

---

## GitHub Pages Deployment

```bash
# Build with the /lucky-hands/ base path
GITHUB_PAGES=true npm run build
```

Or pass it directly to Vite:

```bash
npx vite build --base=/lucky-hands/
```

Then push the `dist/` folder to the `gh-pages` branch (e.g. with
[`gh-pages`](https://www.npmjs.com/package/gh-pages)):

```bash
npx gh-pages -d dist
```

The `import.meta.env.BASE_URL` value in the source code automatically reflects
the `base` option, so any future static assets will resolve correctly.
