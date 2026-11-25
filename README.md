# APEX CIRCUIT

A full 3D racing + tuning game that runs in a browser on **Windows, macOS, Linux and Chromebook**. No downloads, no installs — just a modern browser with WebGL.

**Live demo:** enable GitHub Pages on this repo (see below) and open the `https://<user>.github.io/apex-circuit/` URL.

## Features

- **10 car models** from [Kenney's Car Kit](https://kenney.nl/assets/car-kit) (CC0), sourced from [OpenGameArt](https://opengameart.org/content/car-kit)
- **Full engine swaps** — 6 engines from a 1.6L I4 to a 5.2L V10 plus a 400V electric motor, each with real hp/torque/redline/weight differences
- **Gearboxes** (5/6/7/8-speed) with distinct ratios, final drives and shift speeds
- **Drivetrain swaps** (FWD / RWD / AWD), 4 tire compounds, 3 suspension setups
- **Cosmetics** — paint, accent stripes, 3 wheel styles, spoilers, body kits, window tint, underglow and a custom race number
- **Arcade driving physics** — weight, power-to-weight, grip, slip, drift handbrake, off-track penalties and barrier collisions
- **3 circuits**, AI rivals using the same physics, lap timing, best laps, position tracking, minimap
- **Credits economy** — buy and fit parts with cash earned from races; progress saves in `localStorage`
- **Procedural audio** — engine note, tire scrub, impacts and UI beeps via Web Audio (no sound files)
- **Touch controls** for tablets and touchscreen Chromebooks

## Controls

| Key | Action |
|---|---|
| `W` / `↑` | Throttle |
| `S` / `↓` | Brake / reverse |
| `A` `D` / `←` `→` | Steer |
| `Space` | Handbrake (drift) |
| `C` | Cycle camera (chase / close / hood) |
| `R` | Respawn on track |
| `P` / `Esc` | Pause |
| `M` | Mute |
| `Enter` | Start race from menu |

## Run locally

Because the game uses ES modules, serve it over HTTP rather than opening the file directly:

```bash
cd apex-circuit
python3 -m http.server 8000
# open http://localhost:8000
```

Any static server works (`npx serve`, `php -S localhost:8000`, etc.).

## Deploy to GitHub Pages

The included workflow publishes the `apex-circuit/` folder automatically:

1. Create a new public GitHub repository (e.g. `apex-circuit`) and push this folder to `main`.
2. In the repo, go to **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**.
3. Any push to `main` triggers `.github/workflows/deploy.yml` and publishes the site.

If you'd rather use the classic flow: **Settings → Pages → Source = Deploy from a branch → `main` / `/ (root)`** (this folder should be the repository root).

The workflow uploads the repository root as the Pages artifact. Push `apex-circuit/` as the repo root, not as a subfolder.

## Credits & licensing

- **Code:** MIT — see [LICENSE](LICENSE).
- **Car and wheel models:** [Kenney Car Kit](https://kenney.nl/assets/car-kit) v3.1, CC0 1.0, mirrored on [OpenGameArt](https://opengameart.org/content/car-kit). Original license text in `assets/models/KENNEY-LICENSE.txt`. No attribution required, but credit to Kenney.nl is appreciated.
- **Three.js** r160 (MIT), vendored in `vendor/`.

All other geometry (tracks, barriers, scenery, effects) is generated in code.
