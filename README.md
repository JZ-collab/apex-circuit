# APEX CIRCUIT v2 — Build. Tune. Race.

A complete 3D racing + tuning game that ships as **native desktop apps** (macOS `.app` / `.dmg`, Windows `.exe`, Linux) **and** as a browser/GitHub Pages game. One codebase, every platform: Mac, Windows, Linux, Chromebook, tablet and phone.

**Play it now:** [https://jz-collab.github.io/apex-circuit/](https://jz-collab.github.io/apex-circuit/)

## Graphics / creator overhaul

- **Cinematic rendering** — HDR-style bloom, filmic ACES tone mapping, FXAA, procedural PMREM environment reflections, 2048px soft shadows, cool fill lighting, glowing sun/moon discs and night starfields.
- **Creator Series** — three original, hand-authored 3D cars (GT, Rally and Hyper) built from real geometry, not imported assets. They take paint, metalness, lights, wheels, liveries and tuning exactly like the licensed models.
- **Your own models** — the garage has a **16 / YOUR MODEL** tab: import any `.glb` / `.gltf` (up to 2.5 MB) made by you or downloaded elsewhere. Models are auto-centred, auto-scaled and auto-oriented, then get the full paint/wheel/light/number treatment. Saved locally on your device.
- **Studio showroom** — reflective turntable, animated neon light strips, spot lighting and a rotating turntable camera.

## What's new in v2

- **6 circuits** — Sunset Loop, Industrial Sprint, Coastal Run, Neon District (night), Alpine Pass and Dust Devil desert, each with its own scenery, palette and lighting.
- **Time Trial + ghost racing** — your best run is saved locally and replayed as a translucent ghost car with a live gap readout.
- **Nitro kits** — fit Street NOS (+35%) or Race NOS (+62%), manage the bottle with `Shift`, watch the flames and hiss.
- **Weather** — Dry, Wet (less grip, reflective track, rain particles) and Fog (reduced visibility).
- **Difficulty tiers** — Rookie → Legend changes rival pace *and* credit rewards, with rubber-banding so races stay close.
- **Damage** — barrier hits dent and darken the paint, reduce grip and top speed, throw sparks and shake the camera.
- **Effects** — tyre smoke, boost sparks, rain, brake lamps, animated underglow and a redesigned neon HUD.
- **4 camera modes** — chase, close, hood and cinematic orbit.
- **Garage stat previews** — see HP/weight deltas before you buy, plus a livery shuffle button.
- **Offline PWA** — installable service-worker app shell for Chromebooks and phones.

Original v1 features are all still here: 10 CC0 Kenney car models, 6 engines (including an electric motor), 4 gearboxes, FWD/RWD/AWD, tires, suspension, wheels, spoilers, body kits, paint, accents, tint, underglow, race numbers, credits economy, AI rivals, lap timing, minimap, procedural audio and touch controls.

## Controls

| Key | Action |
|---|---|
| `W` / `↑` | Throttle |
| `S` / `↓` | Brake / reverse |
| `A` `D` / `←` `→` | Steer |
| `Space` | Handbrake (drift) |
| `Shift` / `N` | Nitro boost (if fitted) |
| `C` | Cycle camera (chase / close / hood / cinematic) |
| `R` | Respawn on track |
| `P` / `Esc` | Pause |
| `M` | Mute |
| `Enter` | Start race from menu |

Touch controls appear automatically on touchscreen devices.

## Native desktop builds

The desktop app is an Electron shell around the exact same game, served from an internal localhost HTTP server so ES modules and assets work identically to the web version. No internet connection is needed to play.

### Download / use prebuilt apps

After a build, find finished artifacts in `dist/`:

| File | Platform |
|---|---|
| `Apex-Circuit-macOS.dmg` + `dist/Apex Circuit-darwin-arm64/.../Apex Circuit.app` | macOS Apple Silicon |
| `Apex Circuit-darwin-x64/.../Apex Circuit.app` (+ tar.gz) | macOS Intel |
| `Apex-Circuit-win32-x64.zip` / `Apex-Circuit-win32-ia32.zip` | Windows (extract, run `Apex Circuit.exe`) |
| `Apex-Circuit-linux-x64.tar.gz` / `Apex-Circuit-linux-arm64.tar.gz` | Linux (extract, run `Apex Circuit`) |

### Build them yourself

Requirements: Node.js 18+, npm, `zip` and (on macOS) `hdiutil`.

```bash
cd apex-circuit
npm install
npm run build:all          # all six targets
# or: npm run build:mac / build:win / build:linux
```

Icons are generated from `electron/make-icons.py` (pure Python, no Pillow needed) and converted with `sips`/`iconutil` on macOS:

```bash
python3 electron/make-icons.py
# then build assets/icon.icns / icon.ico / icon.png as needed
```

Run the desktop app from source without packaging:

```bash
npm start
```

## Browser / GitHub Pages version

Because the game uses ES modules, serve it over HTTP rather than opening `index.html` directly:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Any static server works (`npx serve`, `php -S localhost:8000`, etc.). The app also installs as an offline PWA from any HTTPS host.

### Publish to GitHub Pages

1. Create a public GitHub repository and push **this folder as the repository root** to `main`.
2. In **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml` and publishes the site at `https://<user>.github.io/<repo>/`.

Alternatively use **Settings → Pages → Deploy from a branch → `main` / `/ (root)`**.

> This project is published at `https://jz-collab.github.io/apex-circuit/`. To fork it, push your fork to `main` and enable **Pages → GitHub Actions**.

## Project layout

```
index.html           UI shell / import map
css/style.css        v2 neon graphite UI + HUD
js/config.js         cars, parts, tracks, weather, modes, difficulties
js/main.js           renderer, race loop, camera, results, ghosts
js/ui.js             menus, garage, HUD, minimap
js/physics.js        shared vehicle dynamics (boost, damage, gears)
js/ai.js             rival racing line
js/env.js            procedural PMREM environment maps
js/original-models.js Creator Series original car geometry
js/effects.js        smoke, sparks, rain (GPU point pools)
js/car.js            customizable 3D car assembly + user model support
js/track.js          procedural circuits + themed scenery
js/storage.js        saves, credits, settings, ghosts
js/audio.js          procedural Web Audio engine/SFX
electron/main.js     native window + private localhost server
electron/build.js    multi-platform packaging + archives
vendor/              Three.js r160 + GLTFLoader (MIT, vendored)
assets/models/       Kenney Car Kit GLBs (CC0)
dist/                generated native apps (not committed)
```

## Credits & licensing

- **Code:** MIT — see [LICENSE](LICENSE).
- **Car and wheel models:** [Kenney Car Kit](https://kenney.nl/assets/car-kit) v3.1, CC0 1.0, mirrored on [OpenGameArt](https://opengameart.org/content/car-kit). Original license text in `assets/models/KENNEY-LICENSE.txt`. No attribution required, but credit to Kenney.nl is appreciated.
- **Three.js** r160 (MIT), vendored in `vendor/`.
- **Electron** (MIT) is used only by the native shell; browser builds do not include it.

All other geometry (tracks, barriers, scenery, effects) is generated in code.
