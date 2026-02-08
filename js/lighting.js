/**
 * OPUS 46 — World-Class Lighting Rig
 *
 * Programmed as a touring VJ would design for Berghain / Printworks / Shelter.
 *
 * Architecture
 * ────────────
 *  Scene engine     — auto-advancing minimal → buildup → peak → breakdown
 *  Beat clock       — quarter, eighth, bar, phrase; every cue is BPM-locked
 *  Movement progs   — sweep, fan, cascade, ballyhoo, circle, tiltBounce
 *  Color palettes   — cold, warm, neon, mono, fire
 *  Crossfade        — all numeric params lerp over ~2 bars for smooth transitions
 *
 * Fixtures
 * ────────
 *  13  moving-head beams   — SpotLight + volumetric cone each
 *   6  gobo projections    — motorised pattern rotation on floor
 *   5  laser sources × 7   — fan oscillation, tunnel & sheet modes
 *   1  mirror ball          — pinspot reveal on breakdowns
 *   7  blinder fixtures     — 2-cell, downbeat / phrase burst
 *   8  strobes              — chase, burst, random modes
 *   3  key spots            — DJ / stage accent
 */

import * as THREE from 'three';

/* ═══════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════ */

const BEAM_LENGTH  = 5.5;          // reference cone height
const BEAM_TOP_R   = 0.012;        // cone radius at fixture (lens)
const BEAM_BOT_R   = 1.4;          // cone radius at floor (spread)
const LASER_LENGTH = 22;

const PALETTES = {
    cold:  [0x1133aa, 0x0088cc, 0x66ccff, 0xffffff],
    warm:  [0xff4400, 0xffaa00, 0xff2200, 0xffcc44],
    neon:  [0xff00ff, 0x00ffcc, 0x00ff66, 0xffff00],
    mono:  [0xffffff, 0xcccccc, 0xffffff, 0xeeeeff],
    fire:  [0xff0000, 0xff6600, 0xffaa00, 0xff2200],
};

const SCENES = {
    /* Near-blackout — only gobos glow on floor. Creates tension. */
    dark: {
        activeHeads: 0, movement: 'ballyhoo', moveSpeed: 0.1,
        palette: 'cold', headBright: 0, beamAlpha: 0,
        laserOn: false, laserAlpha: 0,
        strobeProb: 0, blinderMode: 'off',
        goboAlpha: 0.03, goboRot: 0.03, goboUniform: true,
        mirrorSpot: false, dotAlpha: 0,
        keyMult: 0.15,
    },
    /* Few heads, gentle movement — introspective. */
    minimal: {
        activeHeads: 3, movement: 'ballyhoo', moveSpeed: 0.2,
        palette: 'cold', headBright: 2.2, beamAlpha: 0.015,
        laserOn: false, laserAlpha: 0,
        strobeProb: 0.02, blinderMode: 'off',
        goboAlpha: 0.05, goboRot: 0.06, goboUniform: true,
        mirrorSpot: false, dotAlpha: 0,
        keyMult: 0.35,
    },
    /* Energy rises — more heads, strobes start. */
    buildup: {
        activeHeads: 6, movement: 'sweep', moveSpeed: 0.55,
        palette: 'warm', headBright: 3.5, beamAlpha: 0.025,
        laserOn: false, laserAlpha: 0,
        strobeProb: 0.05, blinderMode: 'off',
        goboAlpha: 0.06, goboRot: 0.14, goboUniform: false,
        mirrorSpot: false, dotAlpha: 0,
        keyMult: 0.55,
    },
    /* Full energy — heads blazing, strobes & blinders active. NO lasers (base). */
    peak: {
        activeHeads: 10, movement: 'cascade', moveSpeed: 1.0,
        palette: 'neon', headBright: 5, beamAlpha: 0.04,
        laserOn: false, laserAlpha: 0,
        strobeProb: 0.15, blinderMode: 'downbeat',
        goboAlpha: 0.08, goboRot: 0.22, goboUniform: false,
        mirrorSpot: false, dotAlpha: 0,
        keyMult: 0.85,
    },
    /* Special peak moment — lasers added as an event. */
    peakLasers: {
        activeHeads: 10, movement: 'fan', moveSpeed: 1.2,
        palette: 'neon', headBright: 4, beamAlpha: 0.03,
        laserOn: true, laserAlpha: 0.18,
        strobeProb: 0.1, blinderMode: 'downbeat',
        goboAlpha: 0.07, goboRot: 0.2, goboUniform: false,
        mirrorSpot: false, dotAlpha: 0,
        keyMult: 0.9,
    },
    /* Short strobe-dominated burst — punchy, dramatic. */
    strobeHit: {
        activeHeads: 2, movement: 'tiltBounce', moveSpeed: 1.4,
        palette: 'mono', headBright: 1.5, beamAlpha: 0.01,
        laserOn: false, laserAlpha: 0,
        strobeProb: 0.55, blinderMode: 'every',
        goboAlpha: 0.04, goboRot: 0.3, goboUniform: true,
        mirrorSpot: false, dotAlpha: 0,
        keyMult: 0.3,
    },
    /* Slow & emotional — mirrorball reveal, gentle colours. */
    breakdown: {
        activeHeads: 4, movement: 'circle', moveSpeed: 0.15,
        palette: 'cold', headBright: 2.2, beamAlpha: 0.02,
        laserOn: false, laserAlpha: 0,
        strobeProb: 0, blinderMode: 'off',
        goboAlpha: 0.05, goboRot: 0.04, goboUniform: true,
        mirrorSpot: true, dotAlpha: 0.7,
        keyMult: 0.4,
    },
};

const PRESETS = {
    club:   { cycle: ['dark','minimal','buildup','peak','breakdown','minimal','buildup','peak','strobeHit','breakdown'],
              bars:  [4,     8,        16,      24,    12,         8,        16,      24,    4,          12] },
    rave:   { cycle: ['dark','buildup','peak','strobeHit','minimal','buildup','peak','peakLasers','strobeHit','breakdown'],
              bars:  [2,     8,        16,    2,          4,        8,        24,    8,           2,          8],
              over:  { moveSpeed:1.3, strobeProb:0.1 } },
    chill:  { cycle: ['breakdown','minimal','dark','minimal','breakdown'],
              bars:  [24,         16,       8,     16,       24],
              over:  { mirrorSpot:true, dotAlpha:0.6, palette:'cold' } },
    strobe: { cycle: ['peak','strobeHit','dark','strobeHit'],
              bars:  [16,    4,          2,     4],
              over:  { strobeProb:0.5, blinderMode:'every' } },
    laser:  { cycle: ['buildup','peakLasers','peak','peakLasers'],
              bars:  [16,       24,          8,     24],
              over:  { laserAlpha:0.22, laserOn:true, movement:'fan' } },
};

/* ═══════════════════════════════════════════════════════════════════════
   CLASS
   ═══════════════════════════════════════════════════════════════════ */

export class LightingSystem {

    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.name = 'LightingSystem';
        scene.add(this.group);

        // Fixture arrays
        this.heads         = [];
        this.goboGroups    = [];
        this.laserBeams    = [];
        this.mirrorBallDots = [];
        this.blinders      = [];
        this.strobes       = [];
        this.keySpots      = [];

        // Scene engine
        this.presetKey   = 'club';
        this.preset      = PRESETS.club;
        this.sceneIdx    = 0;
        this.barTimer    = 0;

        // Lerped params — initialise to first scene
        this.p = { ...SCENES.minimal };

        // Reusable vectors
        this._v1 = new THREE.Vector3();
        this._v2 = new THREE.Vector3();
        this._v3 = new THREE.Vector3();

        // Previous movement for each head (for lerp)
        this._headTargets = [];
    }

    /* ─────────────────────────── Public API ──────────────────────── */

    build() {
        this._buildAmbient();
        this._buildMovingHeads();
        this._buildGoboProjectors();
        this._buildLasers();
        this._buildMirrorBall();
        this._buildBlinders();
        this._buildStrobes();
        this._buildKeySpots();
    }

    setPreset(name) {
        if (!PRESETS[name]) return;
        this.presetKey = name;
        this.preset    = PRESETS[name];
        this.sceneIdx  = 0;
        this.barTimer  = 0;
    }

    /* ───────────────────────── Beat helpers ──────────────────────── */

    _beat(time, bpm) {
        const dur     = 60 / bpm;
        const beat    = time / dur;
        const frac    = beat % 1;
        const num     = Math.floor(beat);
        const barBeat = num % 4;
        const bar     = Math.floor(beat / 4);
        const phrase  = Math.floor(beat / 16);
        const pBeat   = num % 16;
        return {
            beat, frac, num, bar, barBeat, phrase, pBeat, dur,
            is:     frac < 0.08,
            isDown: barBeat === 0 && frac < 0.08,
            isPhrase: pBeat === 0 && frac < 0.08,
            eighth: (time / (dur * 0.5)) % 1 < 0.16,
        };
    }

    /* ─────────────────────── Movement Programs ──────────────────── */

    _getMovement(prog, i, n, time, b, speed) {
        switch (prog) {
            case 'sweep':      return this._moveSweep(i, n, time, b, speed);
            case 'fan':        return this._moveFan(i, n, time, b, speed);
            case 'cascade':    return this._moveCascade(i, n, time, b, speed);
            case 'ballyhoo':   return this._moveBallyhoo(i, n, time, b, speed);
            case 'circle':     return this._moveCircle(i, n, time, b, speed);
            case 'tiltBounce': return this._moveTiltBounce(i, n, time, b, speed);
            default:           return this._moveBallyhoo(i, n, time, b, speed);
        }
    }

    /** All heads sweep in unison — wall of light crossing the floor */
    _moveSweep(i, n, time, b, sp) {
        const t  = time * sp * 0.35;
        const x  = Math.sin(t) * 9;
        const z  = 1 + Math.cos(t * 0.45) * 5;
        return { x, y: 0, z, int: 1 };
    }

    /** Heads fan out from centre — V-shape opening & closing */
    _moveFan(i, n, time, b, sp) {
        const centre = (n - 1) / 2;
        const offset = (i - centre) / Math.max(centre, 1);            // –1…1
        const breath = (Math.sin(time * sp * 0.25) * 0.5 + 0.6);     // 0.1…1.1
        const x = offset * 11 * breath;
        const z = 2 + Math.abs(offset) * 3;
        return { x, y: 0, z, int: 1 };
    }

    /** Sequential activation — wave of light across the rig */
    _moveCascade(i, n, time, b, sp) {
        const delay  = i * (b.dur * 0.45);        // stagger by ~half-beat
        const phase  = ((time - delay) / (b.dur * 2)) % 1;   // 2-beat cycle per head
        const active = phase < 0.35;
        const spread = (i / (n - 1) - 0.5) * 16;
        return { x: spread, y: 0, z: 2 + Math.sin(time * 0.3) * 3, int: active ? 1 : 0.06 };
    }

    /** Classic figure-8 continuous movement — organic and hypnotic */
    _moveBallyhoo(i, n, time, b, sp) {
        const ph = i * 0.48;
        const t  = time * sp * 0.5;
        const x  = Math.sin(t + ph) * 7;
        const z  = Math.sin(t * 0.67 + ph * 1.3) * 6 + 2;
        return { x, y: 0, z, int: 1 };
    }

    /** All beams trace circles on the floor — aerial effect */
    _moveCircle(i, n, time, b, sp) {
        const angle = time * sp * 0.35 + (i / n) * Math.PI * 2;
        const r     = 5 + Math.sin(time * 0.15) * 2;
        return { x: Math.cos(angle) * r, y: 0, z: Math.sin(angle) * r + 2, int: 1 };
    }

    /** Heads snap between floor & ceiling on beats — raw, punchy, Berghain */
    _moveTiltBounce(i, n, time, b, sp) {
        const down = b.frac < 0.2;
        const targetY = down ? 0 : 3.8;
        const spread  = (i / (n - 1) - 0.5) * 12;
        return { x: spread, y: targetY, z: 2, int: down ? 1.0 : 0.15 };
    }

    /* ───────────────────── Color Palette ─────────────────────────── */

    _paletteColor(name, idx, time) {
        const pal = PALETTES[name] || PALETTES.cold;
        const base = new THREE.Color(pal[idx % pal.length]);
        const hsl = {}; base.getHSL(hsl);
        // Subtle time-shift
        base.setHSL((hsl.h + Math.sin(time * 0.04 + idx) * 0.04 + 1) % 1, hsl.s, hsl.l);
        return base;
    }

    /* ═════════════════════════════════════════════════════════════════
       FIXTURE BUILDERS
       ═════════════════════════════════════════════════════════════ */

    _buildAmbient() {
        // Enough ambient to make concrete surfaces readable without killing beam contrast
        this.group.add(new THREE.AmbientLight(0x0a0a18, 0.3));
    }

    /* ── Moving Heads ─────────────────────────────────────────────── */
    _buildMovingHeads() {
        const positions = [
            // Upstage line (behind crowd, near DJ)
            [-6,4.15,-6],[-3,4.15,-6],[0,4.15,-6],[3,4.15,-6],[6,4.15,-6],
            // Downstage line (over entrance side)
            [-6,4.15,6],[-3,4.15,6],[3,4.15,6],[6,4.15,6],
            // Sides
            [-6,4.15,0],[6,4.15,0],
            // Centre line
            [0,4.15,3],[0,4.15,-3],
        ];

        const housingMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.85 });
        const beamGeo    = new THREE.CylinderGeometry(BEAM_TOP_R, BEAM_BOT_R, BEAM_LENGTH, 12, 1, true);

        for (let i = 0; i < positions.length; i++) {
            const pos = new THREE.Vector3(...positions[i]);

            // ─ Visual fixture housing
            const fix = new THREE.Group();
            fix.position.copy(pos);
            // Yoke arms
            const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.06), housingMat);
            fix.add(yoke);
            // Head barrel
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.14, 10), housingMat);
            barrel.rotation.x = Math.PI / 2; barrel.position.z = 0.11; fix.add(barrel);
            // Lens glow disc
            const lens = new THREE.Mesh(
                new THREE.CircleGeometry(0.075, 16),
                new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
            );
            lens.position.z = 0.19; fix.add(lens);
            this.group.add(fix);

            // ─ SpotLight
            const spot = new THREE.SpotLight(0xffffff, 4, 20, Math.PI / 9, 0.65, 1.6);
            spot.position.copy(pos);
            // Only first 4 heads cast shadows — performance vs quality balance
            if (i < 4) {
                spot.castShadow = true;
                spot.shadow.mapSize.set(512, 512);
                spot.shadow.bias = -0.001;
                spot.shadow.camera.near = 0.5;
                spot.shadow.camera.far = 20;
            }
            const target = new THREE.Object3D();
            target.position.set(0, 0, 2);
            this.scene.add(target);
            spot.target = target;
            this.group.add(spot);

            // ─ Volumetric beam cone (scene-level for free orientation)
            const coneMat = new THREE.MeshBasicMaterial({
                color: 0xffffff, transparent: true, opacity: 0.02,
                side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
                fog: true,
            });
            const cone = new THREE.Mesh(beamGeo, coneMat.clone());
            cone.renderOrder = 10;
            this.group.add(cone);

            this.heads.push({ pos, fix, spot, target, lens, cone, index: i });
            this._headTargets.push(new THREE.Vector3(0, 0, 2));
        }
    }

    /* ── Gobo Projectors ──────────────────────────────────────────── */
    _buildGoboProjectors() {
        // Each gobo has: a fixture position on the truss, a floor target, and a
        // volumetric beam cone from fixture to floor.  The floor pattern is the
        // gobo image; the cone is the visible light beam in haze.
        const configs = [
            { floor: [-4, 0.005, -4],  fix: [-4, 4.15, -4],  s: 3.2, type: 'breakup' },
            { floor: [ 4, 0.005, -4],  fix: [ 4, 4.15, -4],  s: 3.2, type: 'star' },
            { floor: [ 0, 0.005,  2],  fix: [ 0, 4.15,  2],  s: 4.0, type: 'ring' },
            { floor: [-5, 0.005,  5],  fix: [-5, 4.15,  5],  s: 2.8, type: 'breakup' },
            { floor: [ 5, 0.005,  5],  fix: [ 5, 4.15,  5],  s: 2.8, type: 'star' },
            { floor: [ 0, 0.005, -8],  fix: [ 0, 4.15, -8],  s: 3.5, type: 'ring' },
        ];

        const baseMat = () => new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.03,
            depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        });

        const beamMat = () => new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.012,
            depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
            fog: true,
        });

        // Housing material (shared)
        const housingMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.8 });

        for (let gi = 0; gi < configs.length; gi++) {
            const c = configs[gi];

            // ── Floor pattern group ──
            const g = new THREE.Group();
            g.position.set(...c.floor);

            if (c.type === 'breakup') {
                for (let d = 0; d < 18; d++) {
                    const a = (d / 18) * Math.PI * 2;
                    const r = 0.25 + Math.random() * c.s * 0.38;
                    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.06 + Math.random() * 0.22, 8), baseMat());
                    dot.rotation.x = -Math.PI / 2;
                    dot.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
                    g.add(dot);
                }
            } else if (c.type === 'star') {
                for (let l = 0; l < 10; l++) {
                    const a = (l / 10) * Math.PI * 2;
                    const line = new THREE.Mesh(
                        new THREE.PlaneGeometry(0.035, c.s * 0.75),
                        baseMat()
                    );
                    line.rotation.x = -Math.PI / 2;
                    line.rotation.z = a;
                    g.add(line);
                }
            } else {
                for (let r = 0; r < 4; r++) {
                    const ring = new THREE.Mesh(
                        new THREE.RingGeometry(c.s * 0.1 * (r + 1), c.s * 0.1 * (r + 1) + 0.035, 36),
                        baseMat()
                    );
                    ring.rotation.x = -Math.PI / 2;
                    g.add(ring);
                }
            }

            this.group.add(g);

            // ── Fixture housing on truss ──
            const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.1, 8), housingMat);
            housing.position.set(c.fix[0], c.fix[1], c.fix[2]);
            this.group.add(housing);

            // Lens glow
            const lens = new THREE.Mesh(
                new THREE.CircleGeometry(0.055, 12),
                new THREE.MeshBasicMaterial({
                    color: 0xffffff, transparent: true, opacity: 0.15,
                    depthWrite: false, blending: THREE.AdditiveBlending,
                })
            );
            lens.position.set(c.fix[0], c.fix[1] - 0.06, c.fix[2]);
            lens.rotation.x = Math.PI / 2;
            this.group.add(lens);

            // ── Volumetric beam cone from fixture to floor ──
            // Height = fixture Y - floor Y
            const beamH = c.fix[1] - c.floor[1];
            // Top radius (at fixture lens) is small; bottom radius matches gobo spread
            const topR = 0.06;
            const botR = c.s * 0.5;  // half the gobo spread diameter
            const coneGeo = new THREE.CylinderGeometry(topR, botR, beamH, 16, 1, true);
            const cone = new THREE.Mesh(coneGeo, beamMat());
            // Position at midpoint between fixture and floor
            cone.position.set(c.fix[0], c.floor[1] + beamH / 2, c.fix[2]);
            cone.renderOrder = 10;
            this.group.add(cone);

            this.goboGroups.push({ group: g, config: c, idx: gi, cone, lens });
        }
    }

    /* ── Lasers ────────────────────────────────────────────────────── */
    _buildLasers() {
        const sources = [
            { pos: [-3.5, 4.2, -14.5], color: 0x00ff22 },
            { pos: [ 3.5, 4.2, -14.5], color: 0x00ff22 },
            { pos: [ 0,   4.5, -14.8], color: 0xff0022 },
            { pos: [-7,   4.0, -12  ], color: 0x2244ff },
            { pos: [ 7,   4.0, -12  ], color: 0x2244ff },
        ];

        for (let si = 0; si < sources.length; si++) {
            const src = sources[si];
            const srcVec = new THREE.Vector3(...src.pos);
            const beamsPerFan = 7;

            for (let b = 0; b < beamsPerFan; b++) {
                // Laser line
                const pts = [new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,1)];
                const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
                const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({
                    color: src.color, transparent: true, opacity: 0.08,
                }));
                line.frustumCulled = false;
                this.group.add(line);

                // Thin volumetric cylinder along beam
                const cylGeo = new THREE.CylinderGeometry(0.003, 0.06, 1, 4, 1, true);
                const cyl = new THREE.Mesh(cylGeo, new THREE.MeshBasicMaterial({
                    color: src.color, transparent: true, opacity: 0.012,
                    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
                }));
                cyl.frustumCulled = false;
                this.group.add(cyl);

                this.laserBeams.push({
                    line, cyl,
                    srcVec: srcVec.clone(),
                    color: src.color,
                    srcIdx: si,
                    beamIdx: b,
                    beamsTotal: beamsPerFan,
                });
            }
        }
    }

    /* ── Mirror Ball ──────────────────────────────────────────────── */
    _buildMirrorBall() {
        // Disco ball — faceted sphere
        this.mirrorBall = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.5, 4),
            new THREE.MeshStandardMaterial({
                color: 0xffffff, roughness: 0.0, metalness: 1.0,
                envMapIntensity: 5.0,
            })
        );
        this.mirrorBall.position.set(0, 4.55, 0);
        this.group.add(this.mirrorBall);

        // Wire & motor
        const wire = new THREE.Mesh(
            new THREE.CylinderGeometry(0.004, 0.004, 0.45, 4),
            new THREE.MeshBasicMaterial({ color: 0x222222 })
        );
        wire.position.set(0, 4.8, 0);
        this.group.add(wire);

        const motor = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.06, 0.08, 8),
            new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.4 })
        );
        motor.position.set(0, 4.96, 0);
        this.group.add(motor);

        // Multiple pinspots aimed at the ball from different angles
        const mbTarget = new THREE.Object3D();
        mbTarget.position.copy(this.mirrorBall.position);
        this.scene.add(mbTarget);

        const pinspotConfigs = [
            { pos: [2.5, 4.9, 2.5],   color: 0xffffff },
            { pos: [-2.5, 4.9, -2.5], color: 0xeeeeff },
            { pos: [-2, 4.85, 3],     color: 0xffeedd },
        ];

        this.pinspots = [];
        for (const cfg of pinspotConfigs) {
            const ps = new THREE.SpotLight(cfg.color, 0, 10, Math.PI / 14, 0.25, 1.0);
            ps.position.set(...cfg.pos);
            ps.target = mbTarget;
            this.group.add(ps);
            this.pinspots.push(ps);
        }

        // Reflection dots — scattered across all room surfaces
        // Use individual materials since each dot needs independent opacity control
        const dotMat = () => new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0,
            depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        });
        const dotGeo = new THREE.CircleGeometry(0.1, 6); // shared geometry

        for (let i = 0; i < 200; i++) {
            const sz = 0.04 + Math.random() * 0.18;
            const dot = new THREE.Mesh(dotGeo, dotMat());
            dot.scale.setScalar(sz / 0.1); // scale shared geo to desired size

            // Store the surface type so we can orbit dots properly
            let surface; // 'floor', 'ceiling', 'wallLR', 'wallBack'
            const surf = Math.random();
            if (surf < 0.35) {
                surface = 'floor';
                dot.rotation.x = -Math.PI / 2;
                dot.position.set((Math.random() - 0.5) * 28, 0.004, (Math.random() - 0.5) * 28);
            } else if (surf < 0.5) {
                surface = 'ceiling';
                dot.rotation.x = Math.PI / 2;
                dot.position.set((Math.random() - 0.5) * 28, 4.99, (Math.random() - 0.5) * 28);
            } else if (surf < 0.8) {
                surface = 'wallLR';
                const s = Math.random() > 0.5 ? 1 : -1;
                dot.rotation.y = s * -Math.PI / 2;
                dot.position.set(s * 15.98, 0.3 + Math.random() * 4.4, (Math.random() - 0.5) * 30);
            } else {
                surface = 'wallBack';
                const wz = Math.random() > 0.5 ? 15.98 : -15.98;
                dot.position.set((Math.random() - 0.5) * 30, 0.3 + Math.random() * 4.4, wz);
                dot.rotation.y = wz > 0 ? Math.PI : 0;
            }

            this.group.add(dot);
            this.mirrorBallDots.push({
                mesh: dot,
                surface,
                baseOp: 0.15 + Math.random() * 0.35,
                phase:  Math.random() * Math.PI * 2,
                speed:  0.6 + Math.random() * 1.8,
                orbitR: 0.3 + Math.random() * 2.0,
                orbitSpeed: 0.08 + Math.random() * 0.15,
                basePos: dot.position.clone(),
            });
        }
    }

    /* ── Blinders ─────────────────────────────────────────────────── */
    _buildBlinders() {
        const positions = [
            [-4,4.2,-11],[-2,4.2,-11],[0,4.2,-11],[2,4.2,-11],[4,4.2,-11],
            [-3,4.2,-14],[3,4.2,-14],
        ];
        const hMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.85 });
        const cellMat = () => new THREE.MeshBasicMaterial({
            color: 0xffdd88, transparent: true, opacity: 0,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });

        for (let i = 0; i < positions.length; i++) {
            const bg = new THREE.Group();
            bg.add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.13), hMat));
            const cells = [];
            for (const cx of [-0.09, 0.09]) {
                const c = new THREE.Mesh(new THREE.CircleGeometry(0.045, 8), cellMat());
                c.position.set(cx, 0, 0.07); cells.push(c); bg.add(c);
            }
            const light = new THREE.PointLight(0xffdd88, 0, 16);
            light.position.set(0, 0, 0.07); bg.add(light);
            bg.position.set(...positions[i]);
            this.group.add(bg);
            this.blinders.push({ group: bg, light, cells, index: i });
        }
    }

    /* ── Strobes ──────────────────────────────────────────────────── */
    _buildStrobes() {
        const positions = [
            [-5,4.15,-4],[5,4.15,-4],[-5,4.15,4],[5,4.15,4],
            [0,4.2,-2],[0,4.2,2],[-3,4.15,0],[3,4.15,0],
        ];
        const fMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.8 });

        for (const pos of positions) {
            const housing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.11), fMat);
            housing.position.set(...pos);
            this.group.add(housing);

            const flash = new THREE.Mesh(
                new THREE.PlaneGeometry(0.2, 0.05),
                new THREE.MeshBasicMaterial({
                    color: 0xffffff, transparent: true, opacity: 0,
                    blending: THREE.AdditiveBlending, depthWrite: false,
                })
            );
            flash.position.set(pos[0], pos[1] - 0.04, pos[2]);
            flash.rotation.x = Math.PI / 2;
            this.group.add(flash);

            const sLight = new THREE.PointLight(0xffffff, 0, 15);
            sLight.position.set(...pos);
            this.group.add(sLight);

            this.strobes.push({ flash, light: sLight, pos: new THREE.Vector3(...pos) });
        }
    }

    /* ── Key Spots ────────────────────────────────────────────────── */
    _buildKeySpots() {
        const configs = [
            { pos: [0,4.6,-10], tgt: [0,0.5,-13.5],  color: 0xff0044, int: 3.5 },
            { pos: [-4.5,4.5,-9], tgt: [-2,0,-5],     color: 0x0088ff, int: 2.5 },
            { pos: [4.5,4.5,-9],  tgt: [2,0,-5],      color: 0xff00ff, int: 2.5 },
        ];
        for (const c of configs) {
            const sp = new THREE.SpotLight(c.color, c.int, 24, Math.PI / 7, 0.55, 1.5);
            sp.position.set(...c.pos);
            const t = new THREE.Object3D(); t.position.set(...c.tgt);
            this.scene.add(t); sp.target = t;
            sp.castShadow = true;
            sp.shadow.mapSize.set(1024, 1024);
            sp.shadow.bias = -0.0005;
            this.group.add(sp);
            this.keySpots.push({ light: sp, cfg: c });
        }
    }

    /* ═════════════════════════════════════════════════════════════════
       MAIN UPDATE
       ═════════════════════════════════════════════════════════════ */

    update(time, dt, state) {
        const b = this._beat(time, state.bpm);

        // Override timer-based beat flags with real audio detection when available
        if (state.isBeat !== undefined) {
            b.is = state.isBeat || b.is;          // audio OR timer
            b.isDown = state.isBeat && b.barBeat === 0 || b.isDown;
        }

        // Stash audio levels for use in sub-updates
        this._bass   = state.bass  ?? 0.3;
        this._mids   = state.mids  ?? 0.25;
        this._highs  = state.highs ?? 0.15;
        this._energy = state.audioEnergy ?? 0.35;

        this._advanceScene(dt, state, b);

        // Current interpolated parameters
        const p = this.p;

        this._updateHeads(time, dt, state, b, p);
        this._updateGobos(time, dt, state, b, p);
        this._updateLasers(time, dt, state, b, p);
        this._updateMirrorBall(time, dt, state, b, p);
        this._updateBlinders(time, dt, state, b, p);
        this._updateStrobes(time, dt, state, b, p);
        this._updateKeySpots(time, dt, state, b, p);
    }

    /* ───────────── Scene engine — auto-advance + crossfade ──────── */

    _advanceScene(dt, state, b) {
        const pr   = this.preset;
        const bars = pr.bars[this.sceneIdx % pr.bars.length];
        const barDur = b.dur * 4;

        this.barTimer += dt;
        if (this.barTimer >= barDur * bars) {
            this.barTimer = 0;
            this.sceneIdx = (this.sceneIdx + 1) % pr.cycle.length;
        }

        // Target scene
        const sceneName = pr.cycle[this.sceneIdx % pr.cycle.length];
        const raw       = { ...SCENES[sceneName], ...(pr.over || {}) };

        // DROP override
        if (state.dropActive) {
            raw.activeHeads = 13;
            raw.movement    = 'tiltBounce';
            raw.moveSpeed   = 1.6;
            raw.headBright  = 8;
            raw.beamAlpha   = 0.055;
            raw.laserOn     = true;
            raw.laserAlpha  = 0.28;
            raw.strobeProb  = 0.65;
            raw.blinderMode = 'every';
            raw.goboAlpha   = 0.09;
            raw.goboRot     = 0.35;
            raw.palette     = 'fire';
            raw.keyMult     = 1.8;
        }

        // Crossfade lerp (≈2 bars)
        const rate = state.dropActive ? 0.12 : 0.025;
        for (const k of Object.keys(raw)) {
            if (typeof raw[k] === 'number') {
                this.p[k] = this.p[k] + (raw[k] - this.p[k]) * rate;
            } else {
                this.p[k] = raw[k];  // strings, booleans snap
            }
        }
    }

    /* ───────────────── Moving Heads ──────────────────────────────── */

    _updateHeads(time, dt, state, b, p) {
        const n = this.heads.length;

        // Cycle movement program on phrase boundaries
        const progs = ['sweep','fan','cascade','ballyhoo','circle','tiltBounce'];
        const progIdx = (b.phrase + (this.presetKey === 'rave' ? 2 : 0)) % progs.length;
        const movement = p.movement || progs[progIdx];

        for (let i = 0; i < n; i++) {
            const h = this.heads[i];
            const active = i < Math.round(p.activeHeads);

            // Movement
            const mv = this._getMovement(movement, i, n, time, b, p.moveSpeed);

            // Smooth target position (prevents jitter)
            const tgt = this._headTargets[i];
            const lerpR = movement === 'tiltBounce' ? 0.18 : 0.045;
            tgt.x += (mv.x - tgt.x) * lerpR;
            tgt.y += (mv.y - tgt.y) * lerpR;
            tgt.z += (mv.z - tgt.z) * lerpR;

            h.target.position.copy(tgt);

            // Color
            const col = this._paletteColor(p.palette, i, time);

            // Intensity — audio-reactive: bass drives head brightness
            const bassBoost = 0.5 + this._bass * 1.5;  // 0.5–2.0
            const beatPunch = b.is ? 1.6 : 1.0;
            const activeInt = active ? (mv.int ?? 1) : 0;
            const intensity = p.headBright * activeInt * beatPunch * bassBoost;

            h.spot.color.copy(col);
            h.spot.intensity = intensity;
            h.spot.angle = Math.PI / 9;

            // Lens glow — pulses with bass
            h.lens.material.color.copy(col);
            h.lens.material.opacity = active ? (b.is ? 0.95 : 0.3 + this._bass * 0.4) * (mv.int ?? 1) : 0.03;

            // ── Beam cone orientation ──
            const src = h.pos;
            this._v1.copy(tgt).sub(src);
            const len = this._v1.length();
            this._v1.normalize();

            // Position at midpoint
            h.cone.position.copy(src).addScaledVector(this._v1, len * 0.5);
            // Orient:  default cone axis is (0,1,0) with apex at +y
            //          we want apex at source (fixture), base at target
            //          so -Y axis should align with direction
            this._v2.set(0, -1, 0);
            h.cone.quaternion.setFromUnitVectors(this._v2, this._v1);
            h.cone.scale.set(1, len / BEAM_LENGTH, 1);

            // Beam visibility — bass modulates beam visibility
            h.cone.material.color.copy(col);
            h.cone.material.opacity = active
                ? p.beamAlpha * (b.is ? 2.2 : 1) * (mv.int ?? 1) * bassBoost
                : 0;
        }
    }

    /* ───────────────── Gobos ─────────────────────────────────────── */

    _updateGobos(time, dt, state, b, p) {
        // Uniform colour: all gobos share one slowly-cycling hue for atmosphere
        const uniformHue = (time * 0.02) % 1;
        const uniformCol = new THREE.Color().setHSL(uniformHue, 0.7, 0.45);

        for (const gobo of this.goboGroups) {
            gobo.group.rotation.y = time * p.goboRot + gobo.idx * 0.6;

            let col;
            if (p.goboUniform) {
                col = uniformCol;
            } else {
                const h = (time * 0.05 + gobo.idx * 0.17) % 1;
                col = new THREE.Color().setHSL(h, 0.85, 0.5);
            }

            // Gobos pulse with mids energy
            const midsPulse = 0.7 + this._mids * 1.3;  // 0.7–2.0
            const beamAlpha = p.goboAlpha * (b.is ? 2 : 1) * midsPulse;

            // Update floor pattern
            gobo.group.traverse(ch => {
                if (ch.isMesh && ch.material.transparent) {
                    ch.material.color.copy(col);
                    ch.material.opacity = beamAlpha;
                }
            });

            // Update volumetric beam cone
            if (gobo.cone) {
                gobo.cone.material.color.copy(col);
                gobo.cone.material.opacity = beamAlpha * 0.3;  // beam subtler than floor pattern
            }

            // Update lens glow
            if (gobo.lens) {
                gobo.lens.material.color.copy(col);
                gobo.lens.material.opacity = beamAlpha > 0.01 ? 0.15 + beamAlpha * 2 : 0.02;
            }
        }
    }

    /* ───────────────── Lasers ────────────────────────────────────── */

    _updateLasers(time, dt, state, b, p) {
        if (!p.laserOn) {
            for (const l of this.laserBeams) {
                l.line.material.opacity = 0;
                l.cyl.material.opacity  = 0;
            }
            return;
        }

        for (const l of this.laserBeams) {
            const { srcVec, beamIdx, beamsTotal, srcIdx } = l;

            // Fan spread: beams spread symmetrically from source
            const fanCentre = (beamsTotal - 1) / 2;
            const fanOffset = (beamIdx - fanCentre) / fanCentre;   // –1…1

            // Fan oscillation (slow pan of whole fan)
            const fanPan  = Math.sin(time * 0.15 + srcIdx * 1.1) * 0.5;
            const fanTilt = Math.sin(time * 0.08 + srcIdx * 0.7) * 0.12;

            // Spread amount — breathes, widens on drops
            const spread = (state.dropActive ? 1.2 : 0.55 + Math.sin(time * 0.25 + srcIdx) * 0.2);

            const angle = fanPan + fanOffset * spread;
            const tilt  = fanTilt + Math.abs(fanOffset) * 0.08;

            const endX = srcVec.x + Math.sin(angle) * LASER_LENGTH;
            const endZ = srcVec.z + Math.cos(angle) * LASER_LENGTH;
            const endY = -0.1 + tilt * LASER_LENGTH * 0.15;

            // Update line
            const posAttr = l.line.geometry.attributes.position;
            posAttr.setXYZ(0, srcVec.x, srcVec.y, srcVec.z);
            posAttr.setXYZ(1, endX, endY, endZ);
            posAttr.needsUpdate = true;

            // Laser brightness driven by bass
            const laserBassPulse = 0.6 + this._bass * 1.4;  // 0.6–2.0
            const alpha = p.laserAlpha * (b.is ? 2 : 1) * laserBassPulse;
            l.line.material.opacity = alpha;

            // Volumetric cylinder
            this._v1.set(endX, endY, endZ).sub(srcVec);
            const len = this._v1.length();
            this._v1.normalize();
            l.cyl.position.copy(srcVec).addScaledVector(this._v1, len * 0.5);
            l.cyl.quaternion.setFromUnitVectors(this._v2.set(0, 1, 0), this._v1);
            l.cyl.scale.set(1, len, 1);
            l.cyl.material.opacity = alpha * 0.09;
        }
    }

    /* ───────────────── Mirror Ball ───────────────────────────────── */

    _updateMirrorBall(time, dt, state, b, p) {
        // Slow rotation — real mirror balls turn gently
        if (this.mirrorBall) this.mirrorBall.rotation.y += dt * 0.18;

        // Pinspot reveal — all spots fade in/out together
        const targetInt = p.mirrorSpot ? 18 : 0;
        for (const ps of this.pinspots) {
            ps.intensity += (targetInt - ps.intensity) * 0.04;
        }

        // Reflection dots orbit slowly on their surfaces, simulating ball rotation
        for (const d of this.mirrorBallDots) {
            // Flicker: each dot appears and fades as individual mirror facets catch light
            const flicker = Math.sin(time * d.speed + d.phase) * 0.5 + 0.5;
            const sharp = flicker * flicker;  // sharper fall-off for more sparkle

            d.mesh.material.opacity = d.baseOp * sharp * p.dotAlpha;
            // Warm white, very slight hue shift per dot
            d.mesh.material.color.setHSL((d.phase / (Math.PI * 2) + time * 0.008) % 1, 0.08, 0.95);

            // Drift dots along their surface to simulate rotating reflections
            const drift = time * d.orbitSpeed;
            const dx = Math.sin(drift + d.phase) * d.orbitR;
            const dz = Math.cos(drift + d.phase) * d.orbitR;

            if (d.surface === 'floor' || d.surface === 'ceiling') {
                d.mesh.position.x = d.basePos.x + dx;
                d.mesh.position.z = d.basePos.z + dz;
            } else if (d.surface === 'wallLR') {
                d.mesh.position.y = d.basePos.y + Math.sin(drift + d.phase) * d.orbitR * 0.4;
                d.mesh.position.z = d.basePos.z + dz;
            } else {
                d.mesh.position.x = d.basePos.x + dx;
                d.mesh.position.y = d.basePos.y + Math.sin(drift + d.phase) * d.orbitR * 0.4;
            }
        }
    }

    /* ───────────────── Blinders ──────────────────────────────────── */

    _updateBlinders(time, dt, state, b, p) {
        for (const bl of this.blinders) {
            let fire = false;
            if (p.blinderMode === 'downbeat')      fire = b.isDown;
            else if (p.blinderMode === 'phrase')    fire = b.isPhrase;
            else if (p.blinderMode === 'every')     fire = b.is;
            else if (p.blinderMode === 'off')       fire = false;

            const target = fire ? 1 : 0;
            const current = bl.light.intensity / 12;
            const lerped = current + (target - current) * (fire ? 0.5 : 0.08);

            bl.light.intensity = lerped * 12;
            for (const c of bl.cells) c.material.opacity = lerped;
        }
    }

    /* ───────────────── Strobes ───────────────────────────────────── */

    _updateStrobes(time, dt, state, b, p) {
        const prob = p.strobeProb;
        for (let si = 0; si < this.strobes.length; si++) {
            const s = this.strobes[si];

            let shouldFire = false;
            if (prob > 0.5) {
                // Chase mode — sequential based on eighth-note
                const chasePhase = (b.beat * 2 + si * 0.5) % this.strobes.length;
                shouldFire = chasePhase < 1 && b.eighth;
            } else if (prob > 0) {
                // Audio-reactive strobe: fire on detected beats + highs spike
                shouldFire = (b.is && this._highs > 0.25) || Math.random() < prob * dt * 8;
            }

            if (state.dropActive && (b.is || Math.random() < 0.3)) shouldFire = true;

            if (shouldFire) {
                s.flash.material.opacity = 1;
                s.light.intensity = 25;
            } else {
                s.flash.material.opacity *= 0.78;
                s.light.intensity *= 0.78;
            }
        }
    }

    /* ───────────────── Key Spots ─────────────────────────────────── */

    _updateKeySpots(time, dt, state, b, p) {
        // Key spots respond to overall audio energy
        const energyMult = 0.6 + this._energy * 1.0;  // 0.6–1.6
        for (const ks of this.keySpots) {
            ks.light.intensity = ks.cfg.int * p.keyMult * (b.is ? 1.5 : 1) * energyMult;
        }
    }
}
