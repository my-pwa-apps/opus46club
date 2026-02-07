/**
 * VJ Visuals — Immersive LED wall content for OPUS 46
 *
 * High-res canvas renders projected onto DJ booth screens + LED walls.
 * Bright, saturated, fast-cycling content designed to fill large LED panels.
 *
 * Modes (12 total — cycle every 16 bars)
 * ───────
 *  colorWash   — full-screen pulsing colour wash, beat-reactive
 *  waveform    — tri-layer oscilloscope traces, thick glowing lines
 *  bars        — FFT spectrum bars with neon glow
 *  tunnel      — recursive hexagonal / octagonal tunnel rush
 *  plasma      — animated plasma / lava-lamp colour field
 *  scope       — Lissajous oscilloscope figure
 *  flash       — beat-locked full-screen colour flash bursts
 *  shapes      — geometric shapes exploding outward
 *  grid         — scrolling perspective grid with scanlines
 *  noise       — digital glitch / datamosh
 *  radial      — radial burst / starburst pattern
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

        // Fully opaque, emissive-like — LED walls glow bright
        this.material = new THREE.MeshBasicMaterial({
            map: this.texture, toneMapped: false,
            side: THREE.DoubleSide,
        });

        // Peak history for bar hold
        this._peaks = new Float32Array(64);

        // Track glow planes for reactive spill lighting
        this._glowPlanes = [];

        // Dominant hue for glow sync
        this._dominantHue = 0;

        // Draw initial content — bright so screens are visible immediately
        const c = this.ctx, w = this.canvas.width, h = this.canvas.height;
        c.fillStyle = '#000';
        c.fillRect(0, 0, w, h);
        // Bright gradient splash
        const grd = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.4);
        grd.addColorStop(0, '#ff2060');
        grd.addColorStop(0.6, '#4020ff');
        grd.addColorStop(1, '#000');
        c.fillStyle = grd;
        c.fillRect(0, 0, w, h);
        c.font = 'bold 120px monospace';
        c.fillStyle = '#fff';
        c.textAlign = 'center';
        c.fillText('OPUS 46', w / 2, h / 2 + 40);
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
        // Cycle modes every 16 bars (~20s at 130 BPM) for constant variety
        this.modeTimer += dt;
        const barsPerCycle = state.dropActive ? 8 : 16;
        if (this.modeTimer > (60 / state.bpm) * 4 * barsPerCycle) {
            this.modeTimer = 0;
            this.currentMode = (this.currentMode + 1) % this.modes.length;
        }

        const c = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Aggressive trail fade — keeps visuals bright and punchy
        const fade = state.dropActive ? 0.5 : 0.4;
        c.fillStyle = `rgba(0,0,0,${fade})`;
        c.fillRect(0, 0, w, h);

        const bass  = state.bass  || 0;
        const mids  = state.mids  || 0;
        const highs = state.highs || 0;
        const s = { ...state, bass, mids, highs };

        // Track dominant hue from current mode
        this._dominantHue = (time * 0.03) % 1;

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
            const flash = s.dropActive ? 0.35 : 0.18;
            c.fillStyle = `rgba(255,255,255,${flash})`;
            c.fillRect(0, 0, w, h);
        }

        // Sync glow planes with dominant VJ colour — reactive light spill
        if (this._glowPlanes.length > 0) {
            const glowHue = this._dominantHue;
            const glowInt = 0.12 + bass * 0.25 + (s.isBeat ? 0.15 : 0);
            for (const g of this._glowPlanes) {
                g.material.color.setHSL(glowHue, 0.7, 0.4);
                g.material.opacity = glowInt;
            }
        }

        this.texture.needsUpdate = true;
    }

    /* ═══════════════════════════════════════════════════════════════
       VISUAL MODES — all designed for maximum LED wall impact
       ═══════════════════════════════════════════════════════════ */

    /** Full-screen colour wash — immersive ambient fill */
    _drawColorWash(c, w, h, time, s) {
        const hue1 = (time * 0.03) % 1;
        const hue2 = (hue1 + 0.33) % 1;
        const lum  = s.isBeat ? 75 : 55;
        const sat  = 95;
        this._dominantHue = hue1;

        const grd = c.createLinearGradient(0, 0, w, h);
        grd.addColorStop(0,   `hsl(${hue1 * 360}, ${sat}%, ${lum}%)`);
        grd.addColorStop(0.5, `hsl(${hue2 * 360}, ${sat}%, ${lum * 0.8}%)`);
        grd.addColorStop(1,   `hsl(${((hue1 + 0.66) % 1) * 360}, ${sat}%, ${lum}%)`);
        c.fillStyle = grd;
        c.fillRect(0, 0, w, h);

        // Bass pulse — bright centre bloom
        if (s.bass > 0.2) {
            const r = s.bass * 500;
            const radGrd = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, r);
            radGrd.addColorStop(0, `hsla(${hue1 * 360}, 100%, 85%, ${s.bass * 0.6})`);
            radGrd.addColorStop(1, 'rgba(0,0,0,0)');
            c.fillStyle = radGrd;
            c.fillRect(0, 0, w, h);
        }

        // Wide horizontal colour bands that shift
        for (let i = 0; i < 6; i++) {
            const y = (h / 6) * i;
            const bh = h / 6;
            const hue = (hue1 + i * 0.1 + Math.sin(time * 0.5 + i) * 0.05) % 1;
            c.fillStyle = `hsla(${hue * 360}, 90%, ${s.isBeat ? 65 : 40}%, 0.35)`;
            c.fillRect(0, y, w, bh);
        }
    }

    /** Tri-layer oscilloscope — thick glowing lines */
    _drawWaveform(c, w, h, time, s) {
        const cy = h / 2;
        this._dominantHue = 0.95;
        const layers = [
            { amp: s.bass, color: '#ff2060', freq: 3, speed: 1.4, width: 7 },
            { amp: s.mids, color: '#20ff80', freq: 5, speed: 2.0, width: 5 },
            { amp: s.highs,color: '#4080ff', freq: 8, speed: 2.8, width: 4 },
        ];

        // Glow background behind waves
        for (let li = 0; li < layers.length; li++) {
            const l = layers[li];
            c.lineWidth = l.width + 16;
            c.strokeStyle = l.color;
            c.globalAlpha = 0.15;
            c.beginPath();
            for (let x = 0; x < w; x += 3) {
                const t = x / w;
                const y1 = Math.sin(t * Math.PI * l.freq + time * l.speed + li) * l.amp * 280;
                const y2 = Math.sin(t * Math.PI * (l.freq + 2) + time * l.speed * 1.3 + li * 2) * l.amp * 90;
                const y = cy + y1 + y2 + (li - 1) * 50;
                x === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
            }
            c.stroke();
        }

        // Sharp lines on top
        for (let li = 0; li < layers.length; li++) {
            const l = layers[li];
            c.lineWidth = l.width;
            c.strokeStyle = l.color;
            c.globalAlpha = 0.95;
            c.beginPath();
            for (let x = 0; x < w; x += 3) {
                const t = x / w;
                const y1 = Math.sin(t * Math.PI * l.freq + time * l.speed + li) * l.amp * 280;
                const y2 = Math.sin(t * Math.PI * (l.freq + 2) + time * l.speed * 1.3 + li * 2) * l.amp * 90;
                const y = cy + y1 + y2 + (li - 1) * 50;
                x === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
            }
            c.stroke();
        }
        c.globalAlpha = 1;
    }

    /** FFT spectrum bars — bright neon with mirror reflection */
    _drawBars(c, w, h, time, s) {
        const numBars = 64;
        const bw = w / numBars;
        this._dominantHue = (time * 0.04) % 1;

        for (let i = 0; i < numBars; i++) {
            const frac = i / numBars;
            const val = frac < 0.3 ? s.bass : frac < 0.65 ? s.mids : s.highs;
            const barH = val * h * 0.92 * (0.6 + 0.4 * Math.sin(time * 2.5 + i * 0.4));

            if (barH > this._peaks[i]) this._peaks[i] = barH;
            else this._peaks[i] *= 0.96;

            const hue = (frac * 0.4 + time * 0.04) % 1;
            const lum = s.isBeat ? 72 : 55;

            // Glow behind bar
            c.fillStyle = `hsla(${hue * 360}, 100%, ${lum}%, 0.35)`;
            c.fillRect(i * bw - 2, h - barH - 6, bw + 4, barH + 12);

            // Bar
            c.fillStyle = `hsl(${hue * 360}, 95%, ${lum}%)`;
            c.fillRect(i * bw + 1, h - barH, bw - 2, barH);

            // Peak marker
            c.fillStyle = '#fff';
            c.fillRect(i * bw + 1, h - this._peaks[i] - 4, bw - 2, 4);

            // Mirror reflection
            c.globalAlpha = 0.25;
            c.fillStyle = `hsl(${hue * 360}, 80%, 45%)`;
            c.fillRect(i * bw + 1, 0, bw - 2, barH * 0.45);
            c.globalAlpha = 1;
        }
    }

    /** Hexagonal/octagonal tunnel rush */
    _drawTunnel(c, w, h, time, s) {
        const cx = w / 2, cy = h / 2;
        const rings = 28;
        const sides = s.isBeat ? 8 : 6;
        this._dominantHue = (time * 0.06) % 1;

        for (let i = rings; i >= 0; i--) {
            const r = (i / rings) * Math.min(cx, cy) * (1.2 + s.bass * 0.6);
            const z = ((time * 0.9 + i * 0.1) % 1);
            const scale = z * 1.5;
            const hue = (i / rings * 0.5 + time * 0.06) % 1;
            const alpha = (1 - z) * (s.isBeat ? 0.9 : 0.6);

            // Filled background ring
            c.fillStyle = `hsla(${hue * 360}, 95%, 18%, ${alpha * 0.4})`;
            c.beginPath();
            for (let j = 0; j <= sides; j++) {
                const a = (j / sides) * Math.PI * 2 + time * 0.22 + i * 0.06;
                const px = cx + Math.cos(a) * r * scale;
                const py = cy + Math.sin(a) * r * scale;
                j === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
            }
            c.fill();

            // Bright outline
            c.strokeStyle = `hsla(${hue * 360}, 100%, 65%, ${alpha})`;
            c.lineWidth = 3.5;
            c.beginPath();
            for (let j = 0; j <= sides; j++) {
                const a = (j / sides) * Math.PI * 2 + time * 0.22 + i * 0.06;
                const px = cx + Math.cos(a) * r * scale;
                const py = cy + Math.sin(a) * r * scale;
                j === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
            }
            c.stroke();
        }
    }

    /** Animated plasma field — lava lamp colours */
    _drawPlasma(c, w, h, time, s) {
        const step = 16;  // pixel block size for performance at 2048 res
        this._dominantHue = (time * 0.02 + 0.3) % 1;
        for (let y = 0; y < h; y += step) {
            for (let x = 0; x < w; x += step) {
                const nx = x / w, ny = y / h;
                const v1 = Math.sin(nx * 6 + time * 0.7);
                const v2 = Math.sin(ny * 8 + time * 0.5);
                const v3 = Math.sin((nx + ny) * 5 + time * 0.9);
                const v4 = Math.sin(Math.sqrt(((nx - 0.5) ** 2 + (ny - 0.5) ** 2) * 40) + time * 1.2);
                const val = (v1 + v2 + v3 + v4) / 4;

                const hue = ((val + 1) * 0.5 * 0.6 + time * 0.02) % 1;
                const lum = 35 + (val + 1) * 22 + (s.isBeat ? 18 : 0);
                c.fillStyle = `hsl(${hue * 360}, 100%, ${lum}%)`;
                c.fillRect(x, y, step, step);
            }
        }
    }

    /** Lissajous oscilloscope with trails */
    _drawScope(c, w, h, time, s) {
        const cx = w / 2, cy = h / 2;
        const pts = 500;
        this._dominantHue = 0.35;

        // Outer glow ring
        c.strokeStyle = `hsla(${(time * 20) % 360}, 85%, 60%, 0.5)`;
        c.lineWidth = 8;
        c.beginPath();
        c.arc(cx, cy, 120 + s.highs * 200, 0, Math.PI * 2);
        c.stroke();

        // Main figure
        c.lineWidth = 4;
        c.strokeStyle = s.isBeat ? '#ff3060' : '#40ff80';
        c.globalAlpha = 0.95;
        c.beginPath();
        for (let i = 0; i < pts; i++) {
            const t = (i / pts) * Math.PI * 2;
            const x = cx + Math.sin(t * 3 + time * 1.1) * (180 + s.bass * 300);
            const y = cy + Math.cos(t * 2 + time * 0.85) * (120 + s.mids * 250);
            i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
        c.stroke();

        // Second figure with different params for layering
        c.lineWidth = 2.5;
        c.strokeStyle = `hsla(${(time * 25) % 360}, 95%, 60%, 0.6)`;
        c.beginPath();
        for (let i = 0; i < pts; i++) {
            const t = (i / pts) * Math.PI * 2;
            const x = cx + Math.sin(t * 5 + time * 0.8) * (100 + s.mids * 200);
            const y = cy + Math.cos(t * 3 + time * 1.3) * (70 + s.highs * 160);
            i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
        c.stroke();
        c.globalAlpha = 1;
    }

    /** Beat-locked full-screen colour flashes */
    _drawFlash(c, w, h, time, s) {
        const beatDur = 60 / s.bpm;
        const phase = (time % beatDur) / beatDur;
        const flash = phase < 0.1;
        this._dominantHue = (Math.floor(time / beatDur) * 47 / 360) % 1;

        if (flash || (s.dropActive && Math.random() < 0.5)) {
            // Pick colour from rotating hue
            const hue = (Math.floor(time / beatDur) * 47) % 360;
            c.fillStyle = `hsl(${hue}, 100%, ${s.dropActive ? 75 : 60}%)`;
            c.fillRect(0, 0, w, h);
        }

        // Invert flash on every other bar
        if (flash && Math.floor(time / (beatDur * 4)) % 2 === 0) {
            c.fillStyle = '#ffffff';
            c.fillRect(0, 0, w, h);
        }
    }

    /** Geometric shapes exploding outward — triangles, squares, diamonds */
    _drawShapes(c, w, h, time, s) {
        const cx = w / 2, cy = h / 2;
        const count = s.isBeat ? 16 : 8;
        this._dominantHue = (time * 0.04 + 0.6) % 1;

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + time * 0.3;
            const dist = ((time * 80 + i * 60) % 600) * (1 + s.bass * 0.6);
            const size = 25 + s.bass * 50 + (s.isBeat ? 30 : 0);
            const hue = (i / count + time * 0.04) % 1;
            const alpha = Math.max(0, 1 - dist / 650);

            const px = cx + Math.cos(angle) * dist;
            const py = cy + Math.sin(angle) * dist;

            c.save();
            c.translate(px, py);
            c.rotate(time * 0.8 + i);

            const shapeType = i % 3;
            c.fillStyle = `hsla(${hue * 360}, 100%, 65%, ${alpha * 0.75})`;
            c.strokeStyle = `hsla(${hue * 360}, 100%, 80%, ${alpha})`;
            c.lineWidth = 3;

            if (shapeType === 0) {
                // Triangle
                c.beginPath();
                for (let j = 0; j < 3; j++) {
                    const a = (j / 3) * Math.PI * 2 - Math.PI / 2;
                    const tx = Math.cos(a) * size;
                    const ty = Math.sin(a) * size;
                    j === 0 ? c.moveTo(tx, ty) : c.lineTo(tx, ty);
                }
                c.closePath();
                c.fill(); c.stroke();
            } else if (shapeType === 1) {
                // Diamond
                c.beginPath();
                c.moveTo(0, -size); c.lineTo(size * 0.6, 0);
                c.lineTo(0, size); c.lineTo(-size * 0.6, 0);
                c.closePath();
                c.fill(); c.stroke();
            } else {
                // Square
                c.fillRect(-size / 2, -size / 2, size, size);
                c.strokeRect(-size / 2, -size / 2, size, size);
            }
            c.restore();
        }

        // Centre pulse ring
        const pulseR = s.bass * 250 + 40;
        c.strokeStyle = `hsla(${(time * 30) % 360}, 100%, 65%, 0.7)`;
        c.lineWidth = 4;
        c.beginPath();
        c.arc(cx, cy, pulseR, 0, Math.PI * 2);
        c.stroke();
    }

    /** Scrolling perspective grid — bright cyberpunk */
    _drawGrid(c, w, h, time, s) {
        const cx = w / 2, cy = h * 0.5;
        const hue = (time * 0.03) % 1;
        const baseLum = s.isBeat ? 70 : 50;
        this._dominantHue = hue;

        c.lineWidth = 2;

        // Horizontal lines
        const lines = 20;
        for (let i = 0; i < lines; i++) {
            const frac = ((i / lines + time * 0.1 * (1 + s.bass * 0.6)) % 1);
            const y = cy + frac * frac * (h - cy);
            const alpha = frac * 0.8;
            c.strokeStyle = `hsla(${hue * 360}, 90%, ${baseLum}%, ${alpha})`;
            c.beginPath();
            c.moveTo(0, y);
            c.lineTo(w, y);
            c.stroke();
        }

        // Vertical lines converging
        const vLines = 24;
        for (let i = 0; i < vLines; i++) {
            const x = (i / (vLines - 1)) * w;
            const alpha = 0.2 + Math.abs(x / w - 0.5) * 0.5;
            c.strokeStyle = `hsla(${((hue + 0.5) % 1) * 360}, 80%, ${baseLum}%, ${alpha})`;
            c.beginPath();
            c.moveTo(cx, cy * 0.5);
            c.lineTo(x, h);
            c.stroke();
        }

        // Horizon glow band
        const grd = c.createLinearGradient(0, cy - 50, 0, cy + 50);
        grd.addColorStop(0, 'rgba(0,0,0,0)');
        grd.addColorStop(0.5, `hsla(${hue * 360}, 100%, 55%, 0.35)`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = grd;
        c.fillRect(0, cy - 50, w, 100);
    }

    /** Digital noise / datamosh — full colour glitch */
    _drawNoise(c, w, h, time, s) {
        const blockSize = s.isBeat ? 8 : 16;
        const density = s.dropActive ? 0.6 : 0.35;
        this._dominantHue = 0;

        for (let y = 0; y < h; y += blockSize) {
            for (let x = 0; x < w; x += blockSize) {
                if (Math.random() < density) {
                    if (Math.random() < 0.35) {
                        // Colour block
                        const hue = Math.random() * 360;
                        c.fillStyle = `hsl(${hue}, 100%, ${45 + Math.random() * 30}%)`;
                    } else {
                        const v = Math.floor(Math.random() * 255);
                        c.fillStyle = `rgb(${v},${v},${v})`;
                    }
                    c.fillRect(x, y, blockSize, blockSize);
                }
            }
        }

        // Colour glitch bars
        if (Math.random() < 0.2) {
            const gy = Math.random() * h;
            const gh = 6 + Math.random() * 40;
            const hue = Math.random() * 360;
            c.fillStyle = `hsla(${hue}, 100%, 60%, 0.6)`;
            c.fillRect(0, gy, w, gh);
        }

        // Glitch text
        if (s.isBeat && Math.random() < 0.5) {
            c.font = 'bold 28px monospace';
            c.fillStyle = `hsl(${Math.random() * 360}, 100%, 65%)`;
            c.globalAlpha = 0.7;
            const msgs = ['ERR_BUFFER','0xDEAD','SYS//FAULT','NO_SIGNAL','DATAMOSH','>>CORRUPT','OVERDRIVE','///VOID'];
            c.fillText(msgs[Math.floor(Math.random() * msgs.length)],
                Math.random() * w * 0.7, Math.random() * h);
            c.globalAlpha = 1;
        }
    }

    /** Radial burst — starburst beams exploding from centre */
    _drawRadial(c, w, h, time, s) {
        const cx = w / 2, cy = h / 2;
        const rays = 32;
        const maxLen = Math.max(w, h) * 0.75;
        this._dominantHue = (time * 0.04 + 0.15) % 1;

        for (let i = 0; i < rays; i++) {
            const angle = (i / rays) * Math.PI * 2 + time * 0.2;
            const len = (0.4 + s.bass * 0.6) * maxLen;
            const hue = (i / rays + time * 0.04) % 1;
            const thickness = 3 + s.bass * 10 + (s.isBeat ? 6 : 0);

            const grd = c.createLinearGradient(cx, cy,
                cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
            grd.addColorStop(0, `hsla(${hue * 360}, 100%, 75%, 0.95)`);
            grd.addColorStop(1, `hsla(${hue * 360}, 100%, 55%, 0)`);

            c.lineWidth = thickness;
            c.strokeStyle = grd;
            c.beginPath();
            c.moveTo(cx, cy);
            c.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
            c.stroke();
        }

        // Centre bright core
        const coreR = 25 + s.bass * 70;
        const coreGrd = c.createRadialGradient(cx, cy, 0, cx, cy, coreR);
        coreGrd.addColorStop(0, 'rgba(255,255,255,0.95)');
        coreGrd.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = coreGrd;
        c.fillRect(cx - coreR, cy - coreR, coreR * 2, coreR * 2);
    }

    /** OPUS 46 branding with intense glitch */
    _drawLogo(c, w, h, time, s) {
        const cx = w / 2, cy = h / 2;
        c.save();
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        this._dominantHue = 0.95;

        const gx = s.isBeat ? (Math.random() - 0.5) * 30 : 0;
        const gy = s.isBeat ? (Math.random() - 0.5) * 16 : 0;

        const sz = 140 + s.bass * 40;
        c.font = `bold ${sz}px monospace`;
        c.shadowColor = '#ff2060';
        c.shadowBlur = s.isBeat ? 50 : 25;
        c.fillStyle = '#fff';
        c.fillText('OPUS 46', cx + gx, cy - 20 + gy);

        c.font = '32px monospace';
        c.shadowBlur = 12;
        c.shadowColor = '#2080ff';
        c.fillStyle = '#bbb';
        c.fillText(`${Math.round(s.bpm)} BPM`, cx, cy + 80);

        // RGB split
        if (s.isBeat) {
            c.globalCompositeOperation = 'lighter';
            c.globalAlpha = 0.25;
            c.font = `bold ${sz}px monospace`;
            c.shadowBlur = 0;
            c.fillStyle = '#ff0000';
            c.fillText('OPUS 46', cx + 6, cy - 26 + gy);
            c.fillStyle = '#0000ff';
            c.fillText('OPUS 46', cx - 6, cy - 14 + gy);
            c.fillStyle = '#00ff00';
            c.fillText('OPUS 46', cx, cy - 20 + gy + 6);
            c.globalAlpha = 1;
            c.globalCompositeOperation = 'source-over';
        }
        c.restore();
    }
}
