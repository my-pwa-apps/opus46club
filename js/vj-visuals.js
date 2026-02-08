/**
 * VJ Visuals — Immersive LED wall content for OPUS 46
 *
 * High-res canvas renders projected onto DJ booth screens + LED walls.
 * BRIGHT, saturated, full-screen content designed to fill massive LED panels.
 *
 * Design principles:
 *  • Every pixel should glow — no dead dark zones
 *  • Full-canvas coverage on every mode
 *  • Beat-reactive brightness pumping
 *  • Slow trail fade to build up luminance
 *  • Colour-matched spill lighting behind panels
 *
 * Modes (12 total — cycle every 8–16 bars)
 * ───────
 *  colorWash   — full-screen pulsing gradient wash
 *  waveform    — layered oscilloscope traces with glow
 *  bars        — FFT spectrum bars, full-height neon
 *  tunnel      — recursive polygon tunnel rush
 *  plasma      — animated plasma colour field (high-res)
 *  scope       — Lissajous oscilloscope figure
 *  flash       — beat-locked colour flash bursts
 *  shapes      — geometric shapes exploding outward
 *  grid        — perspective grid with scanlines
 *  noise       — digital glitch / datamosh
 *  radial      — radial starburst pattern
 *  logo        — OPUS 46 branding with glitch
 */

import * as THREE from 'three';

export class VJVisuals {

    constructor(scene) {
        this.scene = scene;
        this.modes = [
            'colorWash','waveform','bars','tunnel','plasma','scope',
            'flash','shapes','grid','noise','radial','logo'
        ];
        this.currentMode = 0;
        this.modeTimer   = 0;

        // High-res canvas for maximum LED panel clarity
        this.canvas  = document.createElement('canvas');
        this.canvas.width  = 2048;
        this.canvas.height = 1024;
        this.ctx     = this.canvas.getContext('2d');
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;

        // Fully opaque, emissive-like — LED walls glow bright, bypass tone mapping
        this.material = new THREE.MeshBasicMaterial({
            map: this.texture, toneMapped: false,
            side: THREE.DoubleSide,
        });

        // Peak history for bar hold
        this._peaks = new Float32Array(64);

        // Track glow planes for reactive spill lighting
        this._glowPlanes = [];
        // Track LED wall point lights for colour spill
        this._spillLights = [];

        // Dominant hue for glow sync
        this._dominantHue = 0;
        this._dominantColor = new THREE.Color();

        // Pre-allocate for shapes mode
        this._shapeParticles = [];
        for (let i = 0; i < 40; i++) {
            this._shapeParticles.push({
                angle: (i / 40) * Math.PI * 2,
                speed: 0.5 + Math.random() * 1.5,
                size: 15 + Math.random() * 35,
                type: i % 3,
                hueOff: Math.random(),
            });
        }

        // Draw initial content — bright so screens are visible immediately
        this._drawSplash();
    }

    _drawSplash() {
        const c = this.ctx, w = this.canvas.width, h = this.canvas.height;
        // Full bright gradient — immediately visible
        const grd = c.createLinearGradient(0, 0, w, h);
        grd.addColorStop(0, '#ff2060');
        grd.addColorStop(0.3, '#ff6020');
        grd.addColorStop(0.5, '#8020ff');
        grd.addColorStop(0.7, '#2060ff');
        grd.addColorStop(1, '#20ffcc');
        c.fillStyle = grd;
        c.fillRect(0, 0, w, h);
        c.font = 'bold 140px monospace';
        c.fillStyle = '#fff';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.shadowColor = '#ff2060';
        c.shadowBlur = 60;
        c.fillText('OPUS 46', w / 2, h / 2);
        c.shadowBlur = 0;
        this.texture.needsUpdate = true;
    }

    build() {
        // Apply VJ material to DJ booth screens
        const booth = this.scene.getObjectByName('DJBooth');
        if (booth) {
            booth.traverse(child => {
                if (child.isMesh && child.userData.isScreen) {
                    child.material = this.material;
                }
            });
        }

        // Apply VJ material to LED walls in ClubGeometry
        const club = this.scene.getObjectByName('ClubGeometry');
        if (club) {
            club.traverse(child => {
                if (child.isMesh && child.userData.isScreen) {
                    child.material = this.material;
                }
                // Collect glow planes for reactive colour sync
                if (child.isMesh && child.userData.isLEDGlow) {
                    this._glowPlanes.push(child);
                }
            });
        }

        // Add colour spill point lights near each LED wall
        // These cast coloured light into the room from the screens
        const spillConfigs = [
            { pos: [-14.5, 2.5, 0], name: 'led-spill-left' },
            { pos: [14.5, 2.5, 0], name: 'led-spill-right' },
            { pos: [0, 2.5, -14.5], name: 'led-spill-rear' },
        ];
        for (const sc of spillConfigs) {
            const light = new THREE.PointLight(0x4020ff, 2, 14, 1.5);
            light.position.set(...sc.pos);
            light.name = sc.name;
            this.scene.add(light);
            this._spillLights.push(light);
        }
    }

    setMode(value) {
        if (typeof value === 'number') {
            this.currentMode = value % this.modes.length;
        } else {
            const map = {
                wave: 1, waveform: 1, bars: 2, tunnel: 3, plasma: 4,
                scope: 5, particles: 5, flash: 6, strobe: 6,
                shapes: 7, grid: 8, noise: 9, radial: 10, logo: 11,
                color: 0, colorWash: 0,
            };
            this.currentMode = (map[value] ?? 0) % this.modes.length;
        }
    }

    /* ═══════════════════════════════════════════════════════════════
       MAIN UPDATE
       ═══════════════════════════════════════════════════════════ */

    update(time, dt, state) {
        // Cycle modes for variety — faster during drops
        this.modeTimer += dt;
        const barsPerCycle = state.dropActive ? 8 : 12;
        if (this.modeTimer > (60 / state.bpm) * 4 * barsPerCycle) {
            this.modeTimer = 0;
            this.currentMode = (this.currentMode + 1) % this.modes.length;
        }

        const c = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // LIGHT trail fade — keeps visuals BRIGHT by accumulating
        // Lower = brighter accumulated image
        const fade = state.dropActive ? 0.18 : 0.12;
        c.fillStyle = `rgba(0,0,0,${fade})`;
        c.fillRect(0, 0, w, h);

        const bass  = state.bass  || 0;
        const mids  = state.mids  || 0;
        const highs = state.highs || 0;
        const s = { ...state, bass, mids, highs };

        switch (this.modes[this.currentMode]) {
            case 'colorWash': this._drawColorWash(c, w, h, time, s); break;
            case 'waveform':  this._drawWaveform(c, w, h, time, s);  break;
            case 'bars':      this._drawBars(c, w, h, time, s);      break;
            case 'tunnel':    this._drawTunnel(c, w, h, time, s);    break;
            case 'plasma':    this._drawPlasma(c, w, h, time, s);    break;
            case 'scope':     this._drawScope(c, w, h, time, s);     break;
            case 'flash':     this._drawFlash(c, w, h, time, s);     break;
            case 'shapes':    this._drawShapes(c, w, h, time, s);    break;
            case 'grid':      this._drawGrid(c, w, h, time, s);      break;
            case 'noise':     this._drawNoise(c, w, h, time, s);     break;
            case 'radial':    this._drawRadial(c, w, h, time, s);    break;
            case 'logo':      this._drawLogo(c, w, h, time, s);      break;
        }

        // Beat flash overlay — punchy white on every detected beat
        if (s.isBeat) {
            const flash = s.dropActive ? 0.45 : 0.25;
            c.fillStyle = `rgba(255,255,255,${flash})`;
            c.fillRect(0, 0, w, h);
        }

        // Update glow planes — bright, colour-matched spill
        if (this._glowPlanes.length > 0) {
            const glowInt = 0.25 + bass * 0.45 + (s.isBeat ? 0.25 : 0);
            for (const g of this._glowPlanes) {
                g.material.color.copy(this._dominantColor);
                g.material.opacity = Math.min(0.85, glowInt);
            }
        }

        // Update spill lights — cast LED colour into the room
        if (this._spillLights.length > 0) {
            const spillIntensity = 1.5 + bass * 4 + (s.isBeat ? 3 : 0);
            for (const sl of this._spillLights) {
                sl.color.copy(this._dominantColor);
                sl.intensity = spillIntensity;
            }
        }

        this.texture.needsUpdate = true;
    }

    /* ═══════════════════════════════════════════════════════════════
       HELPER — set dominant colour from HSL
       ═══════════════════════════════════════════════════════════ */
    _setDominant(h, s, l) {
        this._dominantHue = h;
        this._dominantColor.setHSL(h, s || 0.8, l || 0.5);
    }

    /* ═══════════════════════════════════════════════════════════════
       VISUAL MODES — all designed for MAXIMUM LED wall brightness
       ═══════════════════════════════════════════════════════════ */

    /** Full-screen colour wash — immersive ambient fill */
    _drawColorWash(c, w, h, time, s) {
        const hue1 = (time * 0.03) % 1;
        const hue2 = (hue1 + 0.33) % 1;
        const hue3 = (hue1 + 0.66) % 1;
        const lum  = s.isBeat ? 80 : 65;
        this._setDominant(hue1, 0.9, 0.5);

        // Full-canvas gradient — BRIGHT
        const grd = c.createLinearGradient(0, 0, w, h);
        grd.addColorStop(0,   `hsl(${hue1 * 360}, 100%, ${lum}%)`);
        grd.addColorStop(0.35, `hsl(${hue2 * 360}, 95%, ${lum * 0.9}%)`);
        grd.addColorStop(0.65, `hsl(${hue3 * 360}, 100%, ${lum * 0.85}%)`);
        grd.addColorStop(1,   `hsl(${hue1 * 360}, 95%, ${lum}%)`);
        c.globalAlpha = 0.85;
        c.fillStyle = grd;
        c.fillRect(0, 0, w, h);
        c.globalAlpha = 1;

        // Bright pulsing centre bloom
        const r = 300 + s.bass * 500;
        const radGrd = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, r);
        radGrd.addColorStop(0, `hsla(${hue1 * 360}, 100%, 90%, ${0.5 + s.bass * 0.4})`);
        radGrd.addColorStop(0.4, `hsla(${hue2 * 360}, 100%, 70%, ${0.3 + s.bass * 0.3})`);
        radGrd.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = radGrd;
        c.fillRect(0, 0, w, h);

        // Sweeping colour bands — full width, high opacity
        for (let i = 0; i < 8; i++) {
            const y = ((i / 8 + time * 0.08) % 1) * h;
            const bh = h / 5;
            const hue = (hue1 + i * 0.12 + Math.sin(time * 0.6 + i) * 0.05) % 1;
            const bandGrd = c.createLinearGradient(0, y, 0, y + bh);
            bandGrd.addColorStop(0, 'rgba(0,0,0,0)');
            bandGrd.addColorStop(0.5, `hsla(${hue * 360}, 100%, ${s.isBeat ? 75 : 55}%, 0.5)`);
            bandGrd.addColorStop(1, 'rgba(0,0,0,0)');
            c.fillStyle = bandGrd;
            c.fillRect(0, y, w, bh);
        }
    }

    /** Tri-layer oscilloscope — thick glowing lines on bright background */
    _drawWaveform(c, w, h, time, s) {
        const cy = h / 2;
        this._setDominant(0.95, 0.9, 0.45);

        // Subtle background colour field
        const bgGrd = c.createLinearGradient(0, 0, 0, h);
        bgGrd.addColorStop(0, 'hsla(280, 80%, 15%, 0.25)');
        bgGrd.addColorStop(1, 'hsla(220, 80%, 12%, 0.25)');
        c.fillStyle = bgGrd;
        c.fillRect(0, 0, w, h);

        const layers = [
            { amp: s.bass, color: '#ff2060', glow: '#ff206040', freq: 3, speed: 1.4, width: 10 },
            { amp: s.mids, color: '#20ff80', glow: '#20ff8040', freq: 5, speed: 2.0, width: 7 },
            { amp: s.highs,color: '#4080ff', glow: '#4080ff40', freq: 8, speed: 2.8, width: 5 },
        ];

        for (let li = 0; li < layers.length; li++) {
            const l = layers[li];
            // Wide glow pass
            c.lineWidth = l.width + 30;
            c.strokeStyle = l.glow;
            c.beginPath();
            for (let x = 0; x < w; x += 2) {
                const t = x / w;
                const y1 = Math.sin(t * Math.PI * l.freq + time * l.speed + li) * l.amp * 350;
                const y2 = Math.sin(t * Math.PI * (l.freq + 2) + time * l.speed * 1.3) * l.amp * 120;
                const y = cy + y1 + y2 + (li - 1) * 60;
                x === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
            }
            c.stroke();

            // Sharp bright line
            c.lineWidth = l.width;
            c.strokeStyle = l.color;
            c.beginPath();
            for (let x = 0; x < w; x += 2) {
                const t = x / w;
                const y1 = Math.sin(t * Math.PI * l.freq + time * l.speed + li) * l.amp * 350;
                const y2 = Math.sin(t * Math.PI * (l.freq + 2) + time * l.speed * 1.3) * l.amp * 120;
                const y = cy + y1 + y2 + (li - 1) * 60;
                x === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
            }
            c.stroke();

            // Bright white core line
            c.lineWidth = 2;
            c.strokeStyle = 'rgba(255,255,255,0.7)';
            c.beginPath();
            for (let x = 0; x < w; x += 4) {
                const t = x / w;
                const y1 = Math.sin(t * Math.PI * l.freq + time * l.speed + li) * l.amp * 350;
                const y2 = Math.sin(t * Math.PI * (l.freq + 2) + time * l.speed * 1.3) * l.amp * 120;
                const y = cy + y1 + y2 + (li - 1) * 60;
                x === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
            }
            c.stroke();
        }
    }

    /** FFT spectrum bars — bright neon with mirror reflection */
    _drawBars(c, w, h, time, s) {
        const numBars = 64;
        const bw = w / numBars;
        const hueBase = (time * 0.04) % 1;
        this._setDominant(hueBase, 0.95, 0.5);

        // Background gradient for ambience
        const bgGrd = c.createLinearGradient(0, h, 0, 0);
        bgGrd.addColorStop(0, `hsla(${hueBase * 360}, 60%, 8%, 0.3)`);
        bgGrd.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = bgGrd;
        c.fillRect(0, 0, w, h);

        for (let i = 0; i < numBars; i++) {
            const frac = i / numBars;
            const val = frac < 0.3 ? s.bass : frac < 0.65 ? s.mids : s.highs;
            const barH = val * h * 0.95 * (0.6 + 0.4 * Math.sin(time * 2.5 + i * 0.4));

            if (barH > this._peaks[i]) this._peaks[i] = barH;
            else this._peaks[i] *= 0.97;

            const hue = (frac * 0.4 + hueBase) % 1;
            const lum = s.isBeat ? 78 : 62;

            // Wide glow behind bar
            c.fillStyle = `hsla(${hue * 360}, 100%, ${lum}%, 0.35)`;
            c.fillRect(i * bw - 4, h - barH - 8, bw + 8, barH + 16);

            // Main bar — gradient from dark base to bright top
            const barGrd = c.createLinearGradient(0, h, 0, h - barH);
            barGrd.addColorStop(0, `hsl(${hue * 360}, 100%, ${lum * 0.6}%)`);
            barGrd.addColorStop(0.5, `hsl(${hue * 360}, 100%, ${lum}%)`);
            barGrd.addColorStop(1, `hsl(${hue * 360}, 80%, ${Math.min(95, lum + 20)}%)`);
            c.fillStyle = barGrd;
            c.fillRect(i * bw + 1, h - barH, bw - 2, barH);

            // Peak dot — bright white
            c.fillStyle = '#fff';
            c.fillRect(i * bw + 1, h - this._peaks[i] - 4, bw - 2, 4);

            // Mirror reflection (top half)
            c.globalAlpha = 0.3;
            const mirGrd = c.createLinearGradient(0, 0, 0, barH * 0.5);
            mirGrd.addColorStop(0, `hsl(${hue * 360}, 80%, ${lum * 0.6}%)`);
            mirGrd.addColorStop(1, 'rgba(0,0,0,0)');
            c.fillStyle = mirGrd;
            c.fillRect(i * bw + 1, 0, bw - 2, barH * 0.5);
            c.globalAlpha = 1;
        }
    }

    /** Hexagonal/octagonal tunnel rush — BRIGHT filled rings */
    _drawTunnel(c, w, h, time, s) {
        const cx = w / 2, cy = h / 2;
        const rings = 24;
        const sides = s.isBeat ? 8 : 6;
        const hueBase = (time * 0.06) % 1;
        this._setDominant(hueBase, 0.9, 0.5);

        for (let i = rings; i >= 0; i--) {
            const maxR = Math.min(cx, cy) * 1.4;
            const r = (i / rings) * maxR * (1.0 + s.bass * 0.5);
            const z = ((time * 1.0 + i * 0.12) % 1);
            const scale = z * 1.6;
            const hue = (i / rings * 0.6 + hueBase) % 1;
            const alpha = (1 - z * 0.5);

            // FILLED polygon — bright
            c.fillStyle = `hsla(${hue * 360}, 100%, ${s.isBeat ? 50 : 30}%, ${alpha * 0.5})`;
            c.beginPath();
            for (let j = 0; j <= sides; j++) {
                const a = (j / sides) * Math.PI * 2 + time * 0.25 + i * 0.08;
                const px = cx + Math.cos(a) * r * scale;
                const py = cy + Math.sin(a) * r * scale;
                j === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
            }
            c.fill();

            // Bright glowing outline
            c.strokeStyle = `hsla(${hue * 360}, 100%, 75%, ${alpha * 0.9})`;
            c.lineWidth = 4 + s.bass * 3;
            c.beginPath();
            for (let j = 0; j <= sides; j++) {
                const a = (j / sides) * Math.PI * 2 + time * 0.25 + i * 0.08;
                const px = cx + Math.cos(a) * r * scale;
                const py = cy + Math.sin(a) * r * scale;
                j === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
            }
            c.stroke();
        }

        // Bright centre core
        const coreGrd = c.createRadialGradient(cx, cy, 0, cx, cy, 120 + s.bass * 100);
        coreGrd.addColorStop(0, `hsla(${hueBase * 360}, 100%, 95%, 0.9)`);
        coreGrd.addColorStop(0.3, `hsla(${hueBase * 360}, 100%, 60%, 0.4)`);
        coreGrd.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = coreGrd;
        c.fillRect(0, 0, w, h);
    }

    /** HIGH-RES animated plasma field — lava lamp colours, full screen */
    _drawPlasma(c, w, h, time, s) {
        // Step 8 for higher visual quality while still performant
        const step = 8;
        const hueShift = (time * 0.025) % 1;
        this._setDominant((hueShift + 0.3) % 1, 1, 0.5);

        const bassBoost = s.bass * 0.3;
        const beatLum = s.isBeat ? 22 : 0;

        for (let y = 0; y < h; y += step) {
            for (let x = 0; x < w; x += step) {
                const nx = x / w, ny = y / h;
                const v1 = Math.sin(nx * 8 + time * 0.8);
                const v2 = Math.sin(ny * 10 + time * 0.6);
                const v3 = Math.sin((nx + ny) * 6 + time * 1.1);
                const v4 = Math.sin(Math.sqrt(((nx - 0.5) ** 2 + (ny - 0.5) ** 2) * 50) + time * 1.4);
                const v5 = Math.sin(nx * 4 - ny * 3 + time * 0.9);
                const val = (v1 + v2 + v3 + v4 + v5) / 5;

                const hue = ((val + 1) * 0.5 * 0.7 + hueShift) % 1;
                const sat = 95 + val * 5;
                const lum = 42 + (val + 1) * 25 + beatLum + bassBoost * 20;
                c.fillStyle = `hsl(${hue * 360}, ${sat}%, ${Math.min(90, lum)}%)`;
                c.fillRect(x, y, step, step);
            }
        }
    }

    /** Lissajous oscilloscope with bright glow rings */
    _drawScope(c, w, h, time, s) {
        const cx = w / 2, cy = h / 2;
        const pts = 600;
        this._setDominant(0.35, 0.85, 0.5);

        // Background glow field
        const bgGrd = c.createRadialGradient(cx, cy, 0, cx, cy, 500);
        bgGrd.addColorStop(0, `hsla(${(time * 18) % 360}, 80%, 20%, 0.3)`);
        bgGrd.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = bgGrd;
        c.fillRect(0, 0, w, h);

        // Multiple concentric glow rings
        for (let ring = 0; ring < 3; ring++) {
            const rr = 100 + ring * 80 + s.highs * 200;
            c.strokeStyle = `hsla(${(time * 20 + ring * 120) % 360}, 90%, 60%, ${0.4 - ring * 0.1})`;
            c.lineWidth = 6 - ring * 1.5;
            c.beginPath();
            c.arc(cx, cy, rr, 0, Math.PI * 2);
            c.stroke();
        }

        // Main Lissajous figure — FAT glow
        c.lineWidth = 12;
        c.strokeStyle = s.isBeat ? 'rgba(255,48,96,0.5)' : 'rgba(32,255,128,0.3)';
        c.beginPath();
        for (let i = 0; i < pts; i++) {
            const t = (i / pts) * Math.PI * 2;
            const x = cx + Math.sin(t * 3 + time * 1.1) * (220 + s.bass * 350);
            const y = cy + Math.cos(t * 2 + time * 0.85) * (160 + s.mids * 300);
            i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
        c.closePath();
        c.stroke();

        // Sharp bright line
        c.lineWidth = 3;
        c.strokeStyle = s.isBeat ? '#ff3060' : '#40ff80';
        c.beginPath();
        for (let i = 0; i < pts; i++) {
            const t = (i / pts) * Math.PI * 2;
            const x = cx + Math.sin(t * 3 + time * 1.1) * (220 + s.bass * 350);
            const y = cy + Math.cos(t * 2 + time * 0.85) * (160 + s.mids * 300);
            i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
        c.closePath();
        c.stroke();

        // Second figure — bright overlay
        c.lineWidth = 8;
        c.strokeStyle = `hsla(${(time * 25) % 360}, 100%, 55%, 0.3)`;
        c.beginPath();
        for (let i = 0; i < pts; i++) {
            const t = (i / pts) * Math.PI * 2;
            const x = cx + Math.sin(t * 5 + time * 0.8) * (140 + s.mids * 250);
            const y = cy + Math.cos(t * 3 + time * 1.3) * (100 + s.highs * 200);
            i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
        c.closePath();
        c.stroke();

        c.lineWidth = 2;
        c.strokeStyle = `hsla(${(time * 25) % 360}, 100%, 75%, 0.8)`;
        c.beginPath();
        for (let i = 0; i < pts; i++) {
            const t = (i / pts) * Math.PI * 2;
            const x = cx + Math.sin(t * 5 + time * 0.8) * (140 + s.mids * 250);
            const y = cy + Math.cos(t * 3 + time * 1.3) * (100 + s.highs * 200);
            i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
        c.closePath();
        c.stroke();
    }

    /** Beat-locked full-screen colour flashes — MAXIMUM IMPACT */
    _drawFlash(c, w, h, time, s) {
        const beatDur = 60 / s.bpm;
        const phase = (time % beatDur) / beatDur;
        const hue = (Math.floor(time / beatDur) * 47) % 360;
        this._setDominant(hue / 360, 1, 0.6);

        // Background hue wash — always visible
        c.fillStyle = `hsla(${hue}, 80%, 20%, 0.4)`;
        c.fillRect(0, 0, w, h);

        const flash = phase < 0.12;
        if (flash || (s.dropActive && Math.random() < 0.6)) {
            const lum = s.dropActive ? 85 : 70;
            c.fillStyle = `hsl(${hue}, 100%, ${lum}%)`;
            c.fillRect(0, 0, w, h);
        }

        // Alternating white/colour flash
        if (flash && Math.floor(time / (beatDur * 4)) % 2 === 0) {
            c.fillStyle = `rgba(255,255,255,${s.dropActive ? 0.95 : 0.7})`;
            c.fillRect(0, 0, w, h);
        }

        // Colour invert blocks during drops
        if (s.dropActive && Math.random() < 0.3) {
            const bx = Math.random() * w * 0.6;
            const by = Math.random() * h * 0.4;
            const bw2 = 200 + Math.random() * 600;
            const bh2 = 100 + Math.random() * 400;
            c.fillStyle = `hsl(${(hue + 180) % 360}, 100%, 65%)`;
            c.fillRect(bx, by, bw2, bh2);
        }
    }

    /** Geometric shapes — BIG, BRIGHT, exploding outward with trails */
    _drawShapes(c, w, h, time, s) {
        const cx = w / 2, cy = h / 2;
        const hueBase = (time * 0.04 + 0.6) % 1;
        this._setDominant(hueBase, 0.95, 0.55);

        // Background radial glow
        const bgGrd = c.createRadialGradient(cx, cy, 0, cx, cy, 600);
        bgGrd.addColorStop(0, `hsla(${hueBase * 360}, 80%, 25%, 0.35)`);
        bgGrd.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = bgGrd;
        c.fillRect(0, 0, w, h);

        const count = s.isBeat ? 32 : 20;
        for (let i = 0; i < count; i++) {
            const sp = this._shapeParticles[i % this._shapeParticles.length];
            const angle = sp.angle + time * 0.4;
            const dist = ((time * 100 * sp.speed + i * 45) % 800) * (1 + s.bass * 0.5);
            const size = (sp.size + s.bass * 60 + (s.isBeat ? 40 : 0)) * (1 + dist / 1200);
            const hue = (sp.hueOff + hueBase) % 1;
            const alpha = Math.max(0, 1 - dist / 900);

            const px = cx + Math.cos(angle) * dist;
            const py = cy + Math.sin(angle) * dist;

            c.save();
            c.translate(px, py);
            c.rotate(time * 0.6 + i * 0.3);

            c.fillStyle = `hsla(${hue * 360}, 100%, 65%, ${alpha * 0.7})`;
            c.strokeStyle = `hsla(${hue * 360}, 100%, 85%, ${alpha})`;
            c.lineWidth = 3 + s.bass * 3;

            if (sp.type === 0) {
                c.beginPath();
                for (let j = 0; j < 3; j++) {
                    const a = (j / 3) * Math.PI * 2 - Math.PI / 2;
                    const tx = Math.cos(a) * size;
                    const ty = Math.sin(a) * size;
                    j === 0 ? c.moveTo(tx, ty) : c.lineTo(tx, ty);
                }
                c.closePath();
                c.fill(); c.stroke();
            } else if (sp.type === 1) {
                c.beginPath();
                c.moveTo(0, -size); c.lineTo(size * 0.6, 0);
                c.lineTo(0, size); c.lineTo(-size * 0.6, 0);
                c.closePath();
                c.fill(); c.stroke();
            } else {
                c.fillRect(-size / 2, -size / 2, size, size);
                c.strokeRect(-size / 2, -size / 2, size, size);
            }
            c.restore();
        }

        // Multiple pulse rings from centre
        for (let r = 0; r < 3; r++) {
            const pulseR = ((time * 120 + r * 150) % 700) * (1 + s.bass * 0.3);
            const alpha = Math.max(0, 1 - pulseR / 700);
            c.strokeStyle = `hsla(${(hueBase * 360 + r * 60) % 360}, 100%, 70%, ${alpha * 0.8})`;
            c.lineWidth = 5 + s.bass * 4;
            c.beginPath();
            c.arc(cx, cy, pulseR, 0, Math.PI * 2);
            c.stroke();
        }
    }

    /** Scrolling perspective grid — BRIGHT cyberpunk with colour fill */
    _drawGrid(c, w, h, time, s) {
        const cx = w / 2, cy = h * 0.45;
        const hue = (time * 0.03) % 1;
        const baseLum = s.isBeat ? 80 : 60;
        this._setDominant(hue, 0.85, 0.5);

        // Sky / horizon gradient wash
        const skyGrd = c.createLinearGradient(0, 0, 0, h);
        skyGrd.addColorStop(0, `hsla(${((hue + 0.55) % 1) * 360}, 80%, 15%, 0.4)`);
        skyGrd.addColorStop(0.45, `hsla(${hue * 360}, 100%, 50%, 0.35)`);
        skyGrd.addColorStop(0.5, `hsla(${hue * 360}, 100%, 70%, 0.5)`);
        skyGrd.addColorStop(0.55, `hsla(${hue * 360}, 100%, 50%, 0.35)`);
        skyGrd.addColorStop(1, `hsla(${((hue + 0.1) % 1) * 360}, 70%, 10%, 0.3)`);
        c.fillStyle = skyGrd;
        c.fillRect(0, 0, w, h);

        // Horizontal grid lines
        c.lineWidth = 2.5;
        const lines = 24;
        for (let i = 0; i < lines; i++) {
            const frac = ((i / lines + time * 0.12 * (1 + s.bass * 0.8)) % 1);
            const y = cy + frac * frac * (h - cy);
            const alpha = frac * 0.9;
            c.strokeStyle = `hsla(${hue * 360}, 95%, ${baseLum}%, ${alpha})`;
            c.beginPath();
            c.moveTo(0, y); c.lineTo(w, y);
            c.stroke();
        }

        // Vertical converging lines
        const vLines = 28;
        c.lineWidth = 2;
        for (let i = 0; i < vLines; i++) {
            const x = (i / (vLines - 1)) * w;
            const alpha = 0.3 + Math.abs(x / w - 0.5) * 0.6;
            c.strokeStyle = `hsla(${((hue + 0.5) % 1) * 360}, 85%, ${baseLum}%, ${alpha})`;
            c.beginPath();
            c.moveTo(cx, cy * 0.3); c.lineTo(x, h);
            c.stroke();
        }

        // Bright horizon glow band
        const glowGrd = c.createLinearGradient(0, cy - 80, 0, cy + 80);
        glowGrd.addColorStop(0, 'rgba(0,0,0,0)');
        glowGrd.addColorStop(0.4, `hsla(${hue * 360}, 100%, 65%, 0.55)`);
        glowGrd.addColorStop(0.5, `hsla(${hue * 360}, 100%, 90%, ${s.isBeat ? 0.7 : 0.4})`);
        glowGrd.addColorStop(0.6, `hsla(${hue * 360}, 100%, 65%, 0.55)`);
        glowGrd.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = glowGrd;
        c.fillRect(0, cy - 80, w, 160);

        // Sun / moon disc at horizon
        const sunGrd = c.createRadialGradient(cx, cy, 0, cx, cy, 120 + s.bass * 60);
        sunGrd.addColorStop(0, `hsla(${hue * 360}, 100%, 95%, 0.8)`);
        sunGrd.addColorStop(0.3, `hsla(${hue * 360}, 100%, 70%, 0.4)`);
        sunGrd.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = sunGrd;
        c.fillRect(cx - 200, cy - 200, 400, 400);
    }

    /** Digital noise / datamosh — FULL COLOUR glitch */
    _drawNoise(c, w, h, time, s) {
        const blockSize = s.isBeat ? 6 : 12;
        const density = s.dropActive ? 0.75 : 0.5;
        this._setDominant((time * 0.1) % 1, 0.8, 0.4);

        // Base colour wash so it's never fully black
        c.fillStyle = `hsla(${(time * 40) % 360}, 60%, 12%, 0.3)`;
        c.fillRect(0, 0, w, h);

        for (let y = 0; y < h; y += blockSize) {
            for (let x = 0; x < w; x += blockSize) {
                if (Math.random() < density) {
                    if (Math.random() < 0.5) {
                        const hue = Math.random() * 360;
                        c.fillStyle = `hsl(${hue}, 100%, ${50 + Math.random() * 35}%)`;
                    } else {
                        const v = Math.floor(100 + Math.random() * 155);
                        c.fillStyle = `rgb(${v},${v},${v})`;
                    }
                    c.fillRect(x, y, blockSize, blockSize);
                }
            }
        }

        // Wide colour glitch bars
        for (let g = 0; g < (s.isBeat ? 4 : 2); g++) {
            if (Math.random() < 0.4) {
                const gy = Math.random() * h;
                const gh = 8 + Math.random() * 60;
                const hue = Math.random() * 360;
                c.fillStyle = `hsla(${hue}, 100%, 65%, 0.75)`;
                c.fillRect(0, gy, w, gh);
            }
        }

        // Glitch text
        if (s.isBeat && Math.random() < 0.6) {
            c.font = `bold ${32 + Math.random() * 40}px monospace`;
            c.fillStyle = `hsl(${Math.random() * 360}, 100%, 70%)`;
            const msgs = ['ERR_BUFFER','0xDEAD','SYS//FAULT','NO_SIGNAL','DATAMOSH','>>CORRUPT','OVERDRIVE','///VOID','BASS_DROP','RAVE_ERR'];
            c.fillText(msgs[Math.floor(Math.random() * msgs.length)],
                Math.random() * w * 0.7 + 50, Math.random() * h * 0.8 + 50);
        }
    }

    /** Radial burst — BRIGHT starburst beams from centre */
    _drawRadial(c, w, h, time, s) {
        const cx = w / 2, cy = h / 2;
        const rays = 40;
        const maxLen = Math.max(w, h) * 0.8;
        const hueBase = (time * 0.04 + 0.15) % 1;
        this._setDominant(hueBase, 1, 0.55);

        // Background radial glow
        const bgGrd = c.createRadialGradient(cx, cy, 0, cx, cy, maxLen * 0.6);
        bgGrd.addColorStop(0, `hsla(${hueBase * 360}, 80%, 25%, 0.3)`);
        bgGrd.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = bgGrd;
        c.fillRect(0, 0, w, h);

        for (let i = 0; i < rays; i++) {
            const angle = (i / rays) * Math.PI * 2 + time * 0.25;
            const len = (0.5 + s.bass * 0.5) * maxLen;
            const hue = (i / rays + hueBase) % 1;
            const thickness = 4 + s.bass * 14 + (s.isBeat ? 10 : 0);

            const grd = c.createLinearGradient(cx, cy,
                cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
            grd.addColorStop(0, `hsla(${hue * 360}, 100%, 85%, 0.95)`);
            grd.addColorStop(0.5, `hsla(${hue * 360}, 100%, 65%, 0.6)`);
            grd.addColorStop(1, `hsla(${hue * 360}, 100%, 45%, 0)`);

            c.lineWidth = thickness;
            c.strokeStyle = grd;
            c.beginPath();
            c.moveTo(cx, cy);
            c.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
            c.stroke();
        }

        // Bright white centre core
        const coreR = 40 + s.bass * 100;
        const coreGrd = c.createRadialGradient(cx, cy, 0, cx, cy, coreR);
        coreGrd.addColorStop(0, `rgba(255,255,255,${s.isBeat ? 1 : 0.85})`);
        coreGrd.addColorStop(0.4, `hsla(${hueBase * 360}, 100%, 80%, 0.6)`);
        coreGrd.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = coreGrd;
        c.beginPath();
        c.arc(cx, cy, coreR, 0, Math.PI * 2);
        c.fill();
    }

    /** OPUS 46 branding with intense glitch — fully bright background */
    _drawLogo(c, w, h, time, s) {
        const cx = w / 2, cy = h / 2;
        this._setDominant(0.95, 0.9, 0.5);

        // Full bright background gradient
        const bgHue = (time * 0.02) % 1;
        const bgGrd = c.createRadialGradient(cx, cy, 0, cx, cy, 700);
        bgGrd.addColorStop(0, `hsla(${bgHue * 360}, 80%, 30%, 0.4)`);
        bgGrd.addColorStop(1, `hsla(${((bgHue + 0.5) % 1) * 360}, 60%, 10%, 0.3)`);
        c.fillStyle = bgGrd;
        c.fillRect(0, 0, w, h);

        c.save();
        c.textAlign = 'center';
        c.textBaseline = 'middle';

        const gx = s.isBeat ? (Math.random() - 0.5) * 40 : 0;
        const gy = s.isBeat ? (Math.random() - 0.5) * 20 : 0;

        const sz = 160 + s.bass * 60;
        c.font = `bold ${sz}px monospace`;

        // Glow shadow
        c.shadowColor = '#ff2060';
        c.shadowBlur = s.isBeat ? 80 : 40;
        c.fillStyle = '#fff';
        c.fillText('OPUS 46', cx + gx, cy - 30 + gy);

        // Second shadow pass for extra glow
        c.shadowColor = '#4020ff';
        c.shadowBlur = s.isBeat ? 60 : 30;
        c.fillText('OPUS 46', cx + gx, cy - 30 + gy);
        c.shadowBlur = 0;

        // BPM
        c.font = 'bold 36px monospace';
        c.fillStyle = '#ccc';
        c.shadowColor = '#2080ff';
        c.shadowBlur = 15;
        c.fillText(`${Math.round(s.bpm)} BPM`, cx, cy + 90);
        c.shadowBlur = 0;

        // Subtitle
        c.font = '22px monospace';
        c.fillStyle = '#888';
        c.fillText('INDUSTRIAL TECHNO', cx, cy + 130);

        // RGB split on beat
        if (s.isBeat) {
            c.globalCompositeOperation = 'lighter';
            c.globalAlpha = 0.35;
            c.font = `bold ${sz}px monospace`;
            c.fillStyle = '#ff0000';
            c.fillText('OPUS 46', cx + 8, cy - 36 + gy);
            c.fillStyle = '#0000ff';
            c.fillText('OPUS 46', cx - 8, cy - 24 + gy);
            c.fillStyle = '#00ff00';
            c.fillText('OPUS 46', cx, cy - 30 + gy + 8);
            c.globalAlpha = 1;
            c.globalCompositeOperation = 'source-over';
        }

        // Scanlines overlay
        c.fillStyle = 'rgba(0,0,0,0.08)';
        for (let y = 0; y < h; y += 4) {
            c.fillRect(0, y, w, 2);
        }

        c.restore();
    }
}
