# Apex Circuit Native (Godot 4.7.2)

A native 3D racing game. No HTML, JavaScript or Electron.

## Run

```bash
godot --path .
```

## Validate

```bash
godot --headless --path . --quit-after 90
godot --headless --path . --script res://scripts/test_reverse.gd
```

## Export

Install the matching export templates once (Godot → Editor → Manage Export Templates), then:

```bash
godot --headless --path . --export-release "macOS"           ../dist/godot/macos/Apex\ Circuit.app
godot --headless --path . --export-release "Windows Desktop" ../dist/godot/windows/Apex\ Circuit.exe
godot --headless --path . --export-release "Linux"           ../dist/godot/linux/Apex\ Circuit.x86_64
godot --headless --path . --export-release "Web"             ../dist/godot/web/index.html
```

Presets are in `export_presets.cfg`. The Web build is suitable for Chromebook via a static server.

## Controls

| Key | Action |
|---|---|
| `W` / `↑` | Throttle |
| `S` / `↓` | Brake / reverse |
| `A` `D` / `←` `→` | Steer |
| `Shift` | Nitro (NOS Ready engine) |
| `C` | Cycle camera (chase / close / hood) |
| `R` | Reset to grid |
| `Enter` | Start race from menu |
| `G` | Open garage from menu |
| `Esc` | Return to menu |

## Credits

See [CREDITS.md](CREDITS.md) for all Sketchfab model authors and licenses.
