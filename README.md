# OPUS 46 — Virtual Club Experience

A WebXR hyperrealistic virtual nightclub environment built with Three.js. Designed for VR users who want to enjoy immersive club experiences from home.

## Features

### Environment
- **Club geometry** — Polished concrete floors, acoustic-panelled walls, exposed-beam industrial ceiling, lighting truss
- **DJ/VJ Booth** — Raised stage with dual CDJs, 4-channel mixer with animated VU meters, laptop, monitor wedges
- **Speaker stacks** — Sub-bass cabinets and HF horn tops flanking the stage
- **Bar area** — Full bar counter with stools, backbar shelves with bottles, under-glow LED
- **VIP booths** — Seating areas with tables and LED ring accents
- **Mirror ball** — Rotating disco ball with spot lighting

### Lighting System
- **11 moving heads** — Automated pan/tilt with color cycling
- **Spot lights** — Key spotlights on DJ booth and dance floor (with shadows)
- **Laser system** — Multi-color animated laser beams from stage
- **Strobes** — 6 programmable strobe units
- **PAR cans** — Colored wash lights
- **UV strips** — Blacklight strips along ceiling edges

**Lighting presets:** Club Night, Rave, Chill Lounge, Strobe Madness, Laser Show

### Dance Floor
- **12×12 LED tile grid** — Beat-reactive color patterns
- **6 patterns** — Pulse, Wave, Checkerboard, Radial, Random, Sweep
- **Edge trim lighting** — Color-synced border strips

### VJ Visuals
- **Waveform mode** — Particle-based wave formations
- **Spectrum bars** — Audio-reactive frequency display
- **Particle storm** — Swirling particle system
- **Tunnel mode** — Pulsing wireframe rings

### Audio
- **Load your own music** — Drag & drop or upload any audio file
- **Real-time frequency analysis** — Bass, mids, highs
- **Beat sync** — BPM-driven beat detection syncs all systems
- **DROP button** — Triggers smoke jets + full-intensity lightshow

### Atmosphere
- **Volumetric fog** — Drifting haze particles with density control
- **Haze planes** — Additive-blend atmospheric layers
- **CO2 smoke jets** — Stage-front particle jets triggered on drops

### WebXR / VR
- **Immersive VR mode** — Enter with any WebXR-compatible headset
- **Teleportation** — Point and click to move around the club
- **Controller models** — Automatic controller visualization
- **Hand tracking** — Optional if supported by device

### Post-Processing
- **Unreal Bloom** — Cinematic glow on all emissive elements
- **ACES Filmic tone mapping** — Realistic light falloff

---

## Quick Start

1. Serve the project with any static HTTP server:

```bash
# Using Python
python -m http.server 8080

# Using Node.js
npx serve .

# Using VS Code Live Server extension
# Right-click index.html → Open with Live Server
```

2. Open `http://localhost:8080` in a browser (Chrome recommended for WebXR).

3. Use the controls panel (gear icon) to adjust the experience.

4. Load a music file to enable audio-reactive visuals.

5. Press **ENTER VR** to enter immersive mode (requires VR headset).

---

## Controls

### Desktop
| Key | Action |
|-----|--------|
| **Space** | Trigger DROP (smoke + strobe burst) |
| **1-4** | Switch visual mode (Wave, Bars, Particles, Tunnel) |
| **Q/W/E/R/T** | Lighting preset (Club, Rave, Chill, Strobe, Laser) |
| **Mouse drag** | Orbit camera |
| **Scroll** | Zoom in/out |

### VR
| Input | Action |
|-------|--------|
| **Right trigger** | Point and teleport |
| **Left trigger** | Interact |
| **Squeeze** | Reserved for future interactions |

---

## Architecture

```
opus46club/
├── index.html              # Entry point
├── css/
│   └── style.css           # UI styling
├── js/
│   ├── main.js             # App initialization & render loop
│   ├── club-geometry.js    # Walls, floor, ceiling, bar, VIP booths
│   ├── dj-booth.js         # DJ equipment, screens, speakers
│   ├── lighting.js         # Moving heads, lasers, strobes, PARs
│   ├── dancefloor.js       # LED tile grid with patterns
│   ├── audio-engine.js     # Web Audio API analysis
│   ├── vj-visuals.js       # Particle & shader visuals
│   ├── atmosphere.js       # Fog, haze, smoke jets
│   ├── webxr-manager.js    # VR session & controllers
│   └── ui-controller.js    # HTML control bindings
└── README.md
```

## Browser Support

- **Chrome 90+** — Full WebXR support
- **Firefox** — Partial WebXR (needs flag)
- **Edge 90+** — Full WebXR support
- **Safari** — No WebXR (desktop mode only)

## VR Headsets

- Meta Quest 2/3/Pro (via Oculus Browser)
- Valve Index / HTC Vive (via SteamVR + Chrome)
- Windows Mixed Reality
- Pico 4

---

## License

MIT — Built for the virtual club community.
