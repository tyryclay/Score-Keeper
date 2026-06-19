# 🎮 Game Night Tracker

Score tracker for **Flip 7**, **Farkle**, and **Phase 10** — built as a single HTML file, no dependencies.

## Features
- Persistent player roster saved across sessions
- Round-by-round scoring with navigable round history (tap ← → to edit any past round)
- Phase tracking for Phase 10
- Farkle scoring reference built in
- Auto-detects winner and recalculates if you edit past rounds
- Works offline — no internet needed after first load
- Mobile-friendly (tested on iPhone 16 / iOS 18)

---

## Deploy to Vercel via GitHub

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "init"
gh repo create game-night-tracker --public --push --source=.
```
Or create the repo on github.com and push manually.

### 2. Connect to Vercel
1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Leave all settings as default — Vercel will detect the static file automatically
4. Click **Deploy**

That's it. You'll get a live URL like `https://game-night-tracker.vercel.app` to share with everyone.

---

## Sharing
Send the Vercel URL to anyone — it works in any modern browser on phone or desktop. Each device stores its own scores locally.

## Local use
Just open `index.html` in any browser. No server needed.
