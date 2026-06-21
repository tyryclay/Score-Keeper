# 🎮 Game Night Tracker

A React + Next.js score tracker for **Flip 7**, **Farkle**, **Nertz**, **Phase 10**, and **General Games**.

## Features

- **Players tab** — global roster with per-player stats: wins, games played, win rate, points, per-game breakdown, and recent game history
- **Games tab** — dropdown to switch between all 5 games; each game keeps its own state independently
- **Full persistence** — saves automatically on every change *and* on window close, so closing the app accidentally never loses your game
- **Round navigation** — ← → arrows to browse and edit any past round; "Save changes" recalculates totals and winner
- **Light / dark mode** — toggle in the top-right corner, preference saved across sessions
- **Game history** — completed games are saved automatically when a winner is declared; feeds the stats system
- Works offline after first load; mobile-first design tested on iPhone 16 / iOS 18

---

## Tech stack

**React + Next.js 14** (JavaScript — not Java). This is a proper React web app:
- `pages/index.js` — all components
- `styles/globals.css` — CSS variables for all 6 themes × 2 modes
- No database needed — all data lives in the browser's `localStorage`

---

## First-time deploy

### 1. Push to GitHub
```bash
npm install          # installs Next.js locally for development
git init
git add .
git commit -m "initial commit"
gh repo create game-night-tracker --public --push --source=.
```

### 2. Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Vercel auto-detects Next.js — leave all settings as defaults
4. Click **Deploy** → live in ~60 seconds

---

## Updating after changes

```bash
git add .
git commit -m "describe your change"
git push
```

Vercel auto-deploys on every push. The URL never changes.

### Editing directly on GitHub
1. Open the file → click ✏️ pencil icon
2. Make changes → **Commit changes**
3. Vercel picks it up in ~30 seconds

---

## Local development

```bash
npm install
npm run dev      # opens http://localhost:3000
```

Requires Node.js 18+. Download at [nodejs.org](https://nodejs.org).
