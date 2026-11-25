# APEX CIRCUIT v2 — Build. Tune. Race.

A complete 3D racing + tuning game that ships as **native desktop apps** (macOS `.app` / `.dmg`, Windows `.exe`, Linux) **and** as a browser/GitHub Pages game. One codebase, every platform: Mac, Windows, Linux, Chromebook, tablet and phone.

**Play the published legacy game now:** [https://jz-collab.github.io/apex-circuit/](https://jz-collab.github.io/apex-circuit/)

## Native Godot edition (new)

The next-generation build lives in [`godot/`](godot/). It is a real Godot 4 project — no HTML, no
JavaScript, no Electron wrapper — with six real Sketchfab GLB cars, a procedurally generated banked
mountain circuit with terrain, curbs, guardrails, markings and a start gantry, vehicle-physics
racing, AI rivals, lap timing, chase/orbit cameras and a deep garage (paint, rim colour/style,
engine swaps, final drive, tires, suspension, spoiler and decals).

- **Run from source:** `godot --path godot`
- **Headless smoke test:** `godot --headless --path godot --quit-after 90`
- **Reverse → 1st regression:** `godot --headless --path godot --script res://scripts/test_reverse.gd`
- **Exports:** macOS, Windows, Linux and Web (Chromebook) presets are in
  [`godot/export_presets.cfg`](godot/export_presets.cfg).
- **Model licences and attribution:** [`godot/CREDITS.md`](godot/CREDITS.md).

The reverse-to-first-gear NaN glitch is fixed in both editions: the legacy JS fix is in
`js/physics.js`, and the native gearbox keeps the gear/ratio transition atomic in
`godot/scripts/car.gd`.

The GitHub Pages site continues to serve the legacy v2 build unchanged.

## Graphics / creator overhaul (legacy v2)

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

The native edition is a real Godot 4 game — no Electron, HTML or JavaScript runtime. Ready-to-run builds are published on the [Releases page](https://github.com/JZ-collab/apex-circuit/releases/latest).

### Download / use prebuilt apps

| Asset | Platform | Instructions |
|---|---|---|
| `Apex-Circuit-macOS.dmg` | macOS | Open the disk image and drag `Apex Circuit.app` to Applications. |
| `Apex-Circuit-macOS.zip` | macOS | Unzip and run `Apex Circuit.app`. |
| `Apex-Circuit-Windows.zip` | Windows x86_64 | Extract and run `Apex Circuit.exe`. Keep the `.pck` beside it. |
| `Apex-Circuit-Linux.zip` | Linux x86_64 | Extract, `chmod +x 'Apex Circuit.x86_64'`, then run it. Keep the `.pck` beside it. |
| `Apex-Circuit-Web.zip` | Chromebook / browser | Extract and serve the folder over HTTP (for example `python3 -m http.server`). |

macOS builds are not notarized. If Gatekeeper blocks the app, right-click `Apex Circuit.app` and choose **Open**, then confirm.

### Build them yourself

Requirements: Godot 4.7+ with export templates installed.

```bash
godot --headless --path godot --export-release "macOS" "../dist/godot/macos/Apex Circuit.app"
godot --headless --path godot --export-release "Windows Desktop" "../dist/godot/windows/Apex Circuit.exe"
godot --headless --path godot --export-release "Linux" "../dist/godot/linux/Apex Circuit.x86_64"
godot --headless --path godot --export-release "Web" "../dist/godot/web/index.html"
```

Run from source without packaging:

```bash
godot --path godot
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
