# 🎮 Game Night Tracker

Score tracker for **Flip 7**, **Farkle**, **Phase 10**, and **any other game** — built as a single HTML file with no dependencies, works offline.

## Features
- Global player roster saved across all games and sessions
- Round-by-round scoring with navigable history (← → to edit any past round)
- Phase tracking for Phase 10
- Farkle scoring reference built in
- General Games tab for any game — name it, set highest or lowest wins, set a win score or end manually
- Auto-detects winner; recalculates if you edit past rounds
- Works offline after first load
- Mobile-friendly (iPhone 16 / iOS 18, Android)

---

## 🚀 First-time deploy to GitHub + Vercel

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "initial commit"
gh repo create game-night-tracker --public --push --source=.
```
Or go to github.com → New repository → upload the files manually.

### 2. Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Leave all settings as defaults — Vercel detects the static file automatically
4. Click **Deploy**

You'll get a live URL like `https://game-night-tracker.vercel.app` in about 30 seconds.

---

## 🔄 How to update after making changes

Once the GitHub repo and Vercel are connected, updating is two commands:

```bash
git add .
git commit -m "describe your change"
git push
```

That's it. Vercel watches your GitHub repo and **auto-deploys on every push** — no login, no manual steps. The live URL stays the same.

### If you're editing files directly on GitHub.com
1. Open the file on github.com and click the pencil ✏️ icon
2. Make your changes and click **Commit changes**
3. Vercel picks it up automatically within ~30 seconds

---

## Sharing
Send the Vercel URL to anyone — works in any modern browser on phone or desktop. Each device stores its own game data locally via `localStorage`.

## Local use (no server needed)
Just open `index.html` directly in any browser by double-clicking it.
