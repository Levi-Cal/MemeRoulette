# 🎰 Meme Roulette

Random memes from meme communities around the world, on your **Android phone** and **Windows PC**.

- **Tap/click a meme to save it** (phone: Gallery → Pictures/Meme Roulette · Windows: Pictures\Meme Roulette)
- **Next:** swipe left, press → or Space, or hit the big yellow button. **Back:** swipe right or ←
- **Pick a region:** 🌍 Global, 💻 Nerd, 🇵🇭 🇩🇪 🇫🇷 🇪🇸 🇧🇷 🇳🇱 🇮🇳 🇬🇧 🇮🇹 🇵🇱, or 🎲 Everywhere
- **Saved tab** keeps your stash; share or open the original post from any meme
- Never repeats a meme you've already seen (remembers the last 800)

## Where the memes come from

Reddit meme communities, fetched through [meme-api.com](https://github.com/D3vd/Meme_API),
with Reddit's public JSON as a backup. **NSFW and spoiler posts are always filtered out**, and so are videos.
Communities that stop working are skipped automatically.

Add or remove communities in [`web/sources.js`](web/sources.js).

## Project layout

```text
web/        the meme viewer itself (HTML/CSS/JS), shared by both apps
  sources.js   regions → subreddits
  memes.js     fetching, filtering, de-duplicating, queueing
  native.js    one interface over Android / Windows / browser
  app.js       the UI: roll, save, swipe, saved tab
android/    small Java app: full-screen WebView + fetch / save-to-Gallery / share bridge
desktop/    Electron app: same viewer, saves to Pictures
```

## Building

Every push to `main` builds both apps on GitHub Actions and publishes
`MemeRoulette.apk`, `MemeRoulette-Setup.exe` and `MemeRoulette-Portable.exe` under **Releases**.

- **Try the viewer in a browser:** open `web/index.html` (saving downloads the image instead)
- **Windows locally:** in `desktop/`, `npm install` then `npm start`
- **Android locally:** open `android/` in Android Studio and press Run
