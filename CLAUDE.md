# Impressionist Art Collection — Claude context

## What this is
A personal PWA for curating Impressionist artworks from the Art Institute of Chicago (AIC) and Cleveland Museum of Art (CMA). No build tools or frameworks — plain HTML, CSS, and JavaScript.

## Live URL
https://mchughde.github.io/art-collection-app/

## File structure
- `index.html` — app shell
- `app.js` — all app logic
- `seeds.js` — seed artwork data
- `styles.css` — all styles
- `sw.js` — service worker (currently disabled/unregistered)
- `manifest.json` — PWA manifest
- `icon-192.png`, `icon-512.png` — app icons

## GitHub
- Repo: https://github.com/mchughde/art-collection-app
- Hosted via GitHub Pages from the `main` branch

## Pushing updates
```bash
cd "/Users/diannemchugh/Library/CloudStorage/GoogleDrive-mchughde@gmail.com/My Drive/Art Collection app"
git add -A
git commit -m "describe change"
git push https://mchughde@github.com/mchughde/art-collection-app.git main
```
Note: gh CLI not yet installed — authentication uses a personal access token pasted as password. TODO: install gh CLI via Homebrew.

## Important notes
- Collection data is stored in browser IndexedDB — it is NOT in the repo and does NOT sync across devices
- Export/Import buttons in the header allow manual backup and transfer between devices
- GitHub Pages requires relative paths — `start_url` and `scope` in manifest must be `"./"` not `"/"`
- When testing on iPhone after changes, clear Safari website data (Settings → Apps → Safari → Advanced → Website Data → delete github.io entry) to avoid stale cache issues
- Never commit sensitive or personal data to this public repo
