/**
 * Club Geometry — Hyperrealistic industrial techno club
 *
 * Layout reference: Berghain (Berlin) / Tresor / Printworks (London)
 * Approx 32 × 32 m main hall, 5 m ceiling, concrete & steel construction.
 *
 * Elements
 * ────────
 *  Floor        — Poured concrete with control joints, cracks, drain grates, wear
 *  Walls        — Raw concrete + exposed brick sections, graffiti/art panels
 *  Ceiling      — Concrete slab, steel I-beams, exposed services
 *  Pillars      — Reinforced concrete columns with base plates
 *  Truss        — Realistic box truss grid with chain motors & rigging
 *  LED walls    — Side & rear LED panels (userData.isScreen) for VJ content
 *  PA system    — Funktion-One style: line arrays, subs, delay stacks
 *  Bar          — Industrial steel & concrete bar with stools
 *  Stage        — Raised DJ platform
 *  Details      — Pipes, cable trays, fire equipment, EXIT signs, ventilation
 */

import * as THREE from 'three';

export class ClubGeometry {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.name = 'ClubGeometry';
        scene.add(this.group);
    }

    async build() {
        this._buildFloor();
        this._buildWalls();
        this._buildCeiling();
        this._buildPillars();
        this._buildTrussRig();
        this._buildLEDWalls();
        this._buildPASystem();
        this._buildExposedPipes();
        this._buildCableTrays();
        this._buildVentilation();
        this._buildBar();
        this._buildStage();
        this._buildWallArt();
        this._buildIndustrialDetails();
    }

    /* ══════════════════════════════════════════════════════════════
       FLOOR — Poured concrete, control joints, cracks, drains
       ══════════════════════════════════════════════════════════ */

    _buildFloor() {
        // Procedural concrete bump texture for realistic surface detail
        const bumpCanvas = document.createElement('canvas');
        bumpCanvas.width = 512; bumpCanvas.height = 512;
        const bCtx = bumpCanvas.getContext('2d');
        // Base noise
        for (let y = 0; y < 512; y += 2) {
            for (let x = 0; x < 512; x += 2) {
                const v = 100 + Math.random() * 55;
                bCtx.fillStyle = `rgb(${v},${v},${v})`;
                bCtx.fillRect(x, y, 2, 2);
            }
        }
        // Add larger splotches for aggregate texture
        for (let i = 0; i < 200; i++) {
            const v = 80 + Math.random() * 80;
            bCtx.fillStyle = `rgba(${v},${v},${v},0.15)`;
            const sz = 3 + Math.random() * 12;
            bCtx.beginPath();
            bCtx.arc(Math.random() * 512, Math.random() * 512, sz, 0, Math.PI * 2);
            bCtx.fill();
        }
        const bumpTex = new THREE.CanvasTexture(bumpCanvas);
        bumpTex.wrapS = bumpTex.wrapT = THREE.RepeatWrapping;
        bumpTex.repeat.set(8, 8);

        // Roughness variation texture
        const roughCanvas = document.createElement('canvas');
        roughCanvas.width = 256; roughCanvas.height = 256;
        const rCtx = roughCanvas.getContext('2d');
        rCtx.fillStyle = '#ddd';
        rCtx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 300; i++) {
            const v = 150 + Math.random() * 105;
            rCtx.fillStyle = `rgb(${v},${v},${v})`;
            rCtx.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 6, 2 + Math.random() * 6);
        }
        const roughTex = new THREE.CanvasTexture(roughCanvas);
        roughTex.wrapS = roughTex.wrapT = THREE.RepeatWrapping;
        roughTex.repeat.set(8, 8);

        // Main slab
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a, roughness: 0.88, metalness: 0.04,
            bumpMap: bumpTex, bumpScale: 0.12,
            roughnessMap: roughTex,
            envMapIntensity: 0.3,
        });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.group.add(floor);

        // Control joints (cast grid lines in concrete)
        const jointMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a, roughness: 0.95, metalness: 0.02,
        });
        for (let i = -14; i <= 14; i += 4) {
            const jx = new THREE.Mesh(new THREE.BoxGeometry(34, 0.001, 0.025), jointMat);
            jx.position.set(0, 0.001, i); this.group.add(jx);
            const jz = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.001, 34), jointMat);
            jz.position.set(i, 0.001, 0); this.group.add(jz);
        }

        // Wear patches — darker concrete where crowds gather
        const wearMats = [];
        for (let w = 0; w < 4; w++) {
            wearMats.push(new THREE.MeshStandardMaterial({
                color: 0x111111 + w * 0x020202,
                roughness: 0.97, transparent: true, opacity: 0.25 + w * 0.08,
            }));
        }
        const wearAreas = [
            { x: 0, z: 0, r: 4.5 },
            { x: 0, z: -11, r: 3 },
            { x: -11, z: 1, r: 2.5 },
            { x: 5, z: 5, r: 2 },
            { x: -4, z: -4, r: 2.8 },
        ];
        for (const w of wearAreas) {
            for (let p = 0; p < 8; p++) {
                const ang = Math.random() * Math.PI * 2;
                const dist = Math.random() * w.r;
                const patch = new THREE.Mesh(
                    new THREE.CircleGeometry(0.3 + Math.random() * 1.6, 10),
                    wearMats[p % wearMats.length]
                );
                patch.rotation.x = -Math.PI / 2;
                patch.position.set(w.x + Math.cos(ang) * dist, 0.002, w.z + Math.sin(ang) * dist);
                this.group.add(patch);
            }
        }

        // Concrete cracks
        const crackMat = new THREE.MeshStandardMaterial({
            color: 0x0a0a0a, roughness: 1.0, transparent: true, opacity: 0.4,
        });
        for (let i = 0; i < 12; i++) {
            const len = 0.8 + Math.random() * 3;
            const crack = new THREE.Mesh(
                new THREE.PlaneGeometry(0.008 + Math.random() * 0.012, len),
                crackMat
            );
            crack.rotation.x = -Math.PI / 2;
            crack.rotation.z = Math.random() * Math.PI;
            crack.position.set((Math.random() - 0.5) * 28, 0.002, (Math.random() - 0.5) * 28);
            this.group.add(crack);
        }

        // Drain grates
        const drainPositions = [[-4, 0], [4, 0], [0, 5], [-8, -8], [8, 8], [0, -5]];
        const grateMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.25 });
        for (const dp of drainPositions) {
            const frame = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.005, 0.4), grateMat);
            frame.position.set(dp[0], 0.003, dp[1]); this.group.add(frame);
            for (let g = 0; g < 6; g++) {
                const bar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.008, 0.01), grateMat);
                bar.position.set(dp[0], 0.006, dp[1] - 0.14 + g * 0.056);
                this.group.add(bar);
            }
        }

        // Beverage stains
        const stainMat = new THREE.MeshStandardMaterial({
            color: 0x0e0e0e, transparent: true, opacity: 0.2,
            roughness: 1.0,
        });
        const stainGeo = new THREE.RingGeometry(0.025, 0.032, 14);
        for (let i = 0; i < 20; i++) {
            const ring = new THREE.Mesh(stainGeo, stainMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.set((Math.random() - 0.5) * 26, 0.002, (Math.random() - 0.5) * 26);
            this.group.add(ring);
        }

        // Wet-look puddle zones near bar & dance floor — catch light reflections
        const puddleMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a, roughness: 0.15, metalness: 0.6,
            transparent: true, opacity: 0.35, envMapIntensity: 1.5,
        });
        const puddleZones = [
            { x: -11, z: 1.5, r: 1.8 },   // bar spills
            { x: -10, z: -0.5, r: 1.2 },  // bar spills 2
            { x: 0, z: 0, r: 2.5 },       // dance floor centre
            { x: 2, z: 3, r: 1.0 },       // dance floor edge
            { x: -3, z: -2, r: 0.9 },     // random puddle
        ];
        for (const pz of puddleZones) {
            const puddle = new THREE.Mesh(
                new THREE.CircleGeometry(pz.r, 16),
                puddleMat
            );
            puddle.rotation.x = -Math.PI / 2;
            puddle.position.set(pz.x, 0.003, pz.z);
            this.group.add(puddle);
        }
    }

    /* ══════════════════════════════════════════════════════════════
       WALLS — Concrete + brick overlay, moisture stains
       ══════════════════════════════════════════════════════════ */

    _buildWalls() {
        const H = 5, HW = 16;

        // Procedural concrete wall bump texture
        const wallBumpCanvas = document.createElement('canvas');
        wallBumpCanvas.width = 512; wallBumpCanvas.height = 256;
        const wbCtx = wallBumpCanvas.getContext('2d');
        wbCtx.fillStyle = '#888';
        wbCtx.fillRect(0, 0, 512, 256);
        for (let y = 0; y < 256; y += 2) {
            for (let x = 0; x < 512; x += 2) {
                const v = 110 + Math.random() * 35;
                wbCtx.fillStyle = `rgb(${v},${v},${v})`;
                wbCtx.fillRect(x, y, 2, 2);
            }
        }
        // Form board horizontal lines (concrete cast marks)
        for (let y = 0; y < 256; y += 18) {
            wbCtx.fillStyle = `rgba(60,60,60,0.2)`;
            wbCtx.fillRect(0, y, 512, 1);
        }
        const wallBumpTex = new THREE.CanvasTexture(wallBumpCanvas);
        wallBumpTex.wrapS = wallBumpTex.wrapT = THREE.RepeatWrapping;
        wallBumpTex.repeat.set(6, 2);

        const concMat = new THREE.MeshStandardMaterial({
            color: 0x2c2c2c, roughness: 0.92, metalness: 0.02, side: THREE.DoubleSide,
            bumpMap: wallBumpTex, bumpScale: 0.08,
            envMapIntensity: 0.15,
        });
        const darkMat = new THREE.MeshStandardMaterial({
            color: 0x222222, roughness: 0.95, metalness: 0.01, side: THREE.DoubleSide,
            bumpMap: wallBumpTex, bumpScale: 0.06,
            envMapIntensity: 0.1,
        });

        // Back wall
        const bw = new THREE.Mesh(new THREE.PlaneGeometry(34, H), concMat);
        bw.position.set(0, H / 2, -HW); bw.receiveShadow = true;
        this.group.add(bw);

        // Front wall
        const fw = new THREE.Mesh(new THREE.PlaneGeometry(34, H), concMat);
        fw.position.set(0, H / 2, HW); fw.rotation.y = Math.PI;
        this.group.add(fw);

        // Side walls
        for (const side of [-1, 1]) {
            const sw = new THREE.Mesh(new THREE.PlaneGeometry(34, H), darkMat);
            sw.position.set(side * HW, H / 2, 0);
            sw.rotation.y = side * -Math.PI / 2;
            sw.receiveShadow = true;
            this.group.add(sw);

            // Exposed brick section — use a small palette of shared materials
            const brickPalette = [];
            for (let b = 0; b < 6; b++) {
                brickPalette.push(new THREE.MeshStandardMaterial({
                    color: 0x4a3025 + b * 0x020101,
                    roughness: 0.95, metalness: 0.02,
                }));
            }
            const brickGeo = new THREE.BoxGeometry(0.004, 0.09, 0.48);

            for (let row = 0; row < 22; row++) {
                for (let col = 0; col < 28; col++) {
                    const z = -16 + col * 1.15 + (row % 2) * 0.57;
                    if (Math.abs(z) < 11) continue;   // full LED wall coverage

                    const brick = new THREE.Mesh(
                        brickGeo,
                        brickPalette[(row * 7 + col) % brickPalette.length]
                    );
                    brick.position.set(side * (HW - 0.002), 0.2 + row * 0.125, z);
                    this.group.add(brick);
                }
            }
        }

        // Water / moisture stains
        for (let i = 0; i < 10; i++) {
            const height = 0.4 + Math.random() * 2.2;
            const st = new THREE.Mesh(
                new THREE.PlaneGeometry(0.04 + Math.random() * 0.04, height),
                new THREE.MeshStandardMaterial({
                    color: 0x161610, transparent: true, opacity: 0.15 + Math.random() * 0.12,
                    side: THREE.DoubleSide,
                })
            );
            const s = Math.random() > 0.5 ? 1 : -1;
            st.position.set(s * (HW - 0.008), 4.5 - height / 2 - Math.random() * 1.5, (Math.random() - 0.5) * 30);
            st.rotation.y = s * -Math.PI / 2;
            this.group.add(st);
        }

        // Tide mark
        for (const side of [-1, 1]) {
            const tideMark = new THREE.Mesh(
                new THREE.PlaneGeometry(32, 0.03),
                new THREE.MeshStandardMaterial({
                    color: 0x1a1a16, transparent: true, opacity: 0.2, side: THREE.DoubleSide,
                })
            );
            tideMark.position.set(side * (HW - 0.007), 1.0, 0);
            tideMark.rotation.y = side * -Math.PI / 2;
            this.group.add(tideMark);
        }
    }

    /* ══════════════════════════════════════════════════════════════
       CEILING — Concrete slab, steel I-beams
       ══════════════════════════════════════════════════════════ */

    _buildCeiling() {
        const cMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a, roughness: 0.95, metalness: 0.02, side: THREE.DoubleSide,
            envMapIntensity: 0.08,
        });
        const c = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), cMat);
        c.rotation.x = Math.PI / 2; c.position.y = 5;
        this.group.add(c);

        // Primary concrete beams
        const beamMat = new THREE.MeshStandardMaterial({
            color: 0x262626, roughness: 0.9, metalness: 0.05,
        });
        for (let i = -12; i <= 12; i += 4) {
            const b = new THREE.Mesh(new THREE.BoxGeometry(34, 0.4, 0.45), beamMat);
            b.position.set(0, 4.8, i);
            b.castShadow = true;
            this.group.add(b);
        }

        // Steel I-beams
        const steelMat = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a, roughness: 0.35, metalness: 0.85, envMapIntensity: 1.8,
        });
        for (let i = -12; i <= 12; i += 6) {
            const web = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.22, 34), steelMat);
            web.position.set(i, 4.7, 0);
            this.group.add(web);
            for (const fy of [-0.11, 0.11]) {
                const fl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.014, 34), steelMat);
                fl.position.set(i, 4.7 + fy, 0);
                this.group.add(fl);
            }
        }
    }

    /* ══════════════════════════════════════════════════════════════
       TRUSS RIG — Realistic box truss with chain motors
       ══════════════════════════════════════════════════════════ */

    _buildTrussRig() {
        const trussMat = new THREE.MeshStandardMaterial({
            color: 0x3a3a3a, roughness: 0.28, metalness: 0.92, envMapIntensity: 2.0,
        });
        const motorMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a, roughness: 0.5, metalness: 0.7,
        });
        const chainMat = new THREE.MeshStandardMaterial({
            color: 0x444444, roughness: 0.35, metalness: 0.9,
        });

        const R = 0.015;
        const W = 0.29;
        const TH = 4.15;
        const _up = new THREE.Vector3(0, 1, 0);

        // Box truss section builder
        const buildSection = (s, e) => {
            const dir = new THREE.Vector3().subVectors(e, s);
            const len = dir.length();
            dir.normalize();
            const mid = new THREE.Vector3().addVectors(s, e).multiplyScalar(0.5);

            let p1 = new THREE.Vector3().crossVectors(dir, _up).normalize();
            if (p1.lengthSq() < 0.01) p1.set(1, 0, 0);
            const p2 = new THREE.Vector3().crossVectors(dir, p1).normalize();

            const corners = [[-W / 2, -W / 2], [W / 2, -W / 2], [W / 2, W / 2], [-W / 2, W / 2]];

            // 4 chord tubes
            for (const [ox, oy] of corners) {
                const chord = new THREE.Mesh(new THREE.CylinderGeometry(R, R, len, 5), trussMat);
                const off = new THREE.Vector3().addScaledVector(p1, ox).addScaledVector(p2, oy);
                chord.position.copy(mid).add(off);
                chord.quaternion.setFromUnitVectors(_up, dir);
                this.group.add(chord);
            }

            // Diagonal bracing
            const segs = Math.max(2, Math.floor(len / 0.8));
            for (let i = 0; i < segs; i++) {
                const t0 = i / segs, t1 = (i + 1) / segs;
                const pt0 = new THREE.Vector3().lerpVectors(s, e, t0);
                const pt1 = new THREE.Vector3().lerpVectors(s, e, t1);

                for (const face of [0, 1]) {
                    const c0 = corners[face], c1 = corners[face + 1];
                    const ds = new THREE.Vector3().copy(pt0).addScaledVector(p1, c0[0]).addScaledVector(p2, c0[1]);
                    const de = new THREE.Vector3().copy(pt1).addScaledVector(p1, c1[0]).addScaledVector(p2, c1[1]);
                    const dd = new THREE.Vector3().subVectors(de, ds);
                    const dl = dd.length(); dd.normalize();
                    const dm = new THREE.Vector3().addVectors(ds, de).multiplyScalar(0.5);
                    const diag = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.6, R * 0.6, dl, 4), trussMat);
                    diag.position.copy(dm);
                    diag.quaternion.setFromUnitVectors(_up, dd);
                    this.group.add(diag);
                }
            }
        };

        // Truss grid layout
        const sections = [
            // Outer rectangle
            [[-8, TH, -8], [8, TH, -8]], [[8, TH, -8], [8, TH, 8]],
            [[8, TH, 8], [-8, TH, 8]], [[-8, TH, 8], [-8, TH, -8]],
            // Inner rectangle
            [[-5, TH - 0.15, -5], [5, TH - 0.15, -5]], [[5, TH - 0.15, -5], [5, TH - 0.15, 5]],
            [[5, TH - 0.15, 5], [-5, TH - 0.15, 5]], [[-5, TH - 0.15, 5], [-5, TH - 0.15, -5]],
            // Cross-bars
            [[-8, TH, -3], [8, TH, -3]], [[-8, TH, 3], [8, TH, 3]],
            [[-3, TH, -8], [-3, TH, 8]], [[3, TH, -8], [3, TH, 8]],
            [[0, TH, -8], [0, TH, 8]],
            // Corner braces
            [[-8, TH, -8], [-5, TH - 0.15, -5]], [[8, TH, -8], [5, TH - 0.15, -5]],
            [[8, TH, 8], [5, TH - 0.15, 5]], [[-8, TH, 8], [-5, TH - 0.15, 5]],
        ];

        for (const [sv, ev] of sections) {
            buildSection(new THREE.Vector3(...sv), new THREE.Vector3(...ev));
        }

        // Chain motors at suspension points
        const motorPos = [
            [-8, -8], [0, -8], [8, -8], [-8, 0], [0, 0], [8, 0],
            [-8, 8], [0, 8], [8, 8], [-5, -5], [5, -5], [-5, 5], [5, 5],
        ];

        for (const [mx, mz] of motorPos) {
            // Motor housing
            const housing = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.14), motorMat);
            housing.position.set(mx, 4.89, mz);
            this.group.add(housing);

            // Chain links
            const chainLen = 5 - TH;
            const links = Math.floor(chainLen / 0.04);
            for (let l = 0; l < links; l++) {
                const link = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.03, 0.008), chainMat);
                link.position.set(mx, TH + l * 0.04 + 0.02, mz);
                this.group.add(link);
            }

            // Connection plate
            const hook = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.06), chainMat);
            hook.position.set(mx, TH + 0.02, mz);
            this.group.add(hook);
        }

        // Safety cables
        for (let i = 0; i < 6; i++) {
            const [sx, sz] = motorPos[Math.floor(Math.random() * motorPos.length)];
            const cable = new THREE.Mesh(
                new THREE.CylinderGeometry(0.002, 0.002, 0.6 + Math.random() * 0.3, 3),
                new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.9, roughness: 0.3 })
            );
            cable.position.set(sx + 0.08, TH + 0.3, sz);
            this.group.add(cable);
        }
    }

    /* ══════════════════════════════════════════════════════════════
       LED WALLS — massive VJ surfaces (userData.isScreen)
       ══════════════════════════════════════════════════════════ */

    _buildLEDWalls() {
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.2, metalness: 0.9 });
        const screenMat = () => new THREE.MeshBasicMaterial({ color: 0x000811, side: THREE.DoubleSide });

        // Left side LED wall — floor-to-ceiling immersive panel
        const left = new THREE.Mesh(new THREE.PlaneGeometry(20, 5), screenMat());
        left.position.set(-15.94, 3.0, 0);
        left.rotation.y = Math.PI / 2;
        left.name = 'led-wall-left';
        left.userData.isScreen = true;
        left.userData.isLEDWall = true;
        this.group.add(left);
        this._buildFrame(left, 20, 5, frameMat);

        // Right side LED wall — matching panel
        const right = new THREE.Mesh(new THREE.PlaneGeometry(20, 5), screenMat());
        right.position.set(15.94, 3.0, 0);
        right.rotation.y = -Math.PI / 2;
        right.name = 'led-wall-right';
        right.userData.isScreen = true;
        right.userData.isLEDWall = true;
        this.group.add(right);
        this._buildFrame(right, 20, 5, frameMat);

        // Main rear LED wall — massive panel behind DJ
        const rearMain = new THREE.Mesh(new THREE.PlaneGeometry(16, 5), screenMat());
        rearMain.position.set(0, 3.0, -15.94);
        rearMain.name = 'led-wall-rear-main';
        rearMain.userData.isScreen = true;
        rearMain.userData.isLEDWall = true;
        this.group.add(rearMain);
        this._buildFrame(rearMain, 16, 5, frameMat);

        // Glow strips behind each LED panel — creates halo effect on adjacent walls
        this._buildLEDGlow(left, 20, 5);
        this._buildLEDGlow(right, 20, 5);
        this._buildLEDGlow(rearMain, 16, 5);
    }

    /** Backlight glow planes behind LED panels — simulates bright light spill */
    _buildLEDGlow(screen, w, h) {
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0x4020ff, transparent: true, opacity: 0.35,
            side: THREE.DoubleSide, depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        // Larger plane behind the screen for visible halo
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(w + 2.5, h + 1.5), glowMat);
        glow.position.copy(screen.position);
        glow.quaternion.copy(screen.quaternion);
        // Push glow slightly behind screen
        const offset = new THREE.Vector3(0, 0, -0.04);
        offset.applyQuaternion(screen.quaternion);
        glow.position.add(offset);
        glow.userData.isLEDGlow = true;
        this.group.add(glow);
    }

    _buildFrame(screen, w, h, mat) {
        const d = 0.04;
        const edges = [
            { size: [w + 0.08, d, d], off: [0, h / 2 + d / 2, 0] },
            { size: [w + 0.08, d, d], off: [0, -h / 2 - d / 2, 0] },
            { size: [d, h + 0.08, d], off: [-w / 2 - d / 2, 0, 0] },
            { size: [d, h + 0.08, d], off: [w / 2 + d / 2, 0, 0] },
        ];
        for (const e of edges) {
            const f = new THREE.Mesh(new THREE.BoxGeometry(...e.size), mat);
            f.position.copy(screen.position);
            const lo = new THREE.Vector3(...e.off);
            lo.applyQuaternion(screen.quaternion);
            f.position.add(lo);
            f.quaternion.copy(screen.quaternion);
            this.group.add(f);
        }
    }

    /* ══════════════════════════════════════════════════════════════
       PA SYSTEM — Funktion-One / d&b / L-Acoustics style
       ══════════════════════════════════════════════════════════ */

    _buildPASystem() {
        for (const side of [-1, 1]) {
            this._buildLineArray(side * 9.5, 4.0, -10, side * 0.12, 8);
            this._buildSubStack(side * 6.5, 0, -12, 3);
            this._buildDelayStack(side * 8, 3.2, 2, side);
        }
        for (let i = -2; i <= 2; i += 2) this._buildFrontFill(i, 0.55, -11.4);
    }

    _buildLineArray(x, y, z, tilt, count) {
        const cabMat = new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.75, metalness: 0.15 });
        const grillMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.35, metalness: 0.9 });

        const arr = new THREE.Group();
        arr.position.set(x, y, z);

        // Bumper frame
        const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.5), frameMat);
        bumper.position.set(0, 0.06, 0); arr.add(bumper);

        for (let i = 0; i < count; i++) {
            const cg = new THREE.Group();
            const yOff = -0.12 - i * 0.28;

            const cab = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.26, 0.48), cabMat);
            cg.add(cab);

            const grill = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.22), grillMat);
            grill.position.z = 0.241; cg.add(grill);

            const splay = i * 0.02 + (i > 4 ? (i - 4) * 0.015 : 0);
            cg.rotation.x = splay;
            cg.position.y = yOff;

            for (const sx of [-0.445, 0.445]) {
                const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.035, 6), frameMat);
                pin.rotation.z = Math.PI / 2; pin.position.set(sx, 0, 0.15); cg.add(pin);
            }
            arr.add(cg);
        }

        arr.rotation.y = tilt;
        arr.rotation.x = 0.05;

        // Fly cables
        for (const cx of [-0.35, 0.35]) {
            const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.85, 4), frameMat);
            cable.position.set(x + cx, y + 0.42, z);
            this.group.add(cable);
        }
        this.group.add(arr);
    }

    _buildSubStack(x, y, z, count) {
        const subMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.8, metalness: 0.1 });
        const grillMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.95 });
        const portMat = new THREE.MeshStandardMaterial({ color: 0x070707, roughness: 0.6 });
        const hMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.3 });

        for (let i = 0; i < count; i++) {
            const sg = new THREE.Group();
            sg.position.set(x, y + 0.35 + i * 0.7, z);

            const cab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.65, 0.85), subMat);
            cab.castShadow = true; sg.add(cab);

            const grill = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), grillMat);
            grill.position.z = 0.426; sg.add(grill);

            const port = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 14), portMat);
            port.rotation.x = Math.PI / 2; port.position.set(0, 0, 0.44); sg.add(port);

            for (const sx of [-0.5, 0.5]) {
                const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.03), hMat);
                handle.position.set(sx, 0, 0.44); sg.add(handle);
            }
            this.group.add(sg);
        }
    }

    _buildDelayStack(x, y, z, side) {
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.35, metalness: 0.85 });
        const cabMat = new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.75, metalness: 0.15 });
        const grillMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, y, 10), poleMat);
        pole.position.set(x, y / 2, z); this.group.add(pole);

        const baseP = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 12), poleMat);
        baseP.position.set(x, 0.01, z); this.group.add(baseP);

        for (let i = 0; i < 2; i++) {
            const cab = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.35, 0.4), cabMat);
            cab.position.set(x, y + 0.18 + i * 0.36, z);
            cab.rotation.y = side * 0.15;
            this.group.add(cab);

            const grill = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.28), grillMat);
            grill.position.set(x, y + 0.18 + i * 0.36, z + 0.201);
            grill.rotation.y = side * 0.15;
            this.group.add(grill);
        }
    }

    _buildFrontFill(x, y, z) {
        const cab = new THREE.Mesh(
            new THREE.BoxGeometry(0.35, 0.18, 0.25),
            new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.7, metalness: 0.2 })
        );
        cab.position.set(x, y, z);
        cab.rotation.x = -0.2;
        this.group.add(cab);
    }

    /* ══════════════════════════════════════════════════════════════
       PILLARS — Reinforced concrete columns
       ══════════════════════════════════════════════════════════ */

    _buildPillars() {
        const pMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.88, metalness: 0.05 });
        const bpMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.9, roughness: 0.3 });
        const boltMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9, roughness: 0.2 });

        const positions = [[-8, 0, -8], [8, 0, -8], [-8, 0, 0], [8, 0, 0], [-8, 0, 8], [8, 0, 8]];

        for (const pos of positions) {
            const p = new THREE.Mesh(new THREE.BoxGeometry(0.55, 5, 0.55), pMat);
            p.position.set(pos[0], 2.5, pos[2]);
            p.castShadow = true; p.receiveShadow = true;
            this.group.add(p);

            const pl = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.025, 0.75), bpMat);
            pl.position.set(pos[0], 0.013, pos[2]);
            this.group.add(pl);

            for (const bx of [-0.28, 0.28]) {
                for (const bz of [-0.28, 0.28]) {
                    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 6), boltMat);
                    bolt.position.set(pos[0] + bx, 0.035, pos[2] + bz);
                    this.group.add(bolt);
                }
            }

            // Capital
            const capital = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 0.65), pMat);
            capital.position.set(pos[0], 4.96, pos[2]);
            this.group.add(capital);

            // Scuff marks
            for (let s = 0; s < 3; s++) {
                const scuff = new THREE.Mesh(
                    new THREE.PlaneGeometry(0.08 + Math.random() * 0.12, 0.04 + Math.random() * 0.06),
                    new THREE.MeshStandardMaterial({
                        color: 0x252525, roughness: 1, transparent: true, opacity: 0.2 + Math.random() * 0.2,
                    })
                );
                const face = Math.floor(Math.random() * 4);
                const yPos = 0.4 + Math.random() * 1.5;
                const offs = [
                    [pos[0] + 0.276, yPos, pos[2] + (Math.random() - 0.5) * 0.4, Math.PI / 2],
                    [pos[0] - 0.276, yPos, pos[2] + (Math.random() - 0.5) * 0.4, -Math.PI / 2],
                    [pos[0] + (Math.random() - 0.5) * 0.4, yPos, pos[2] + 0.276, 0],
                    [pos[0] + (Math.random() - 0.5) * 0.4, yPos, pos[2] - 0.276, Math.PI],
                ][face];
                scuff.position.set(offs[0], offs[1], offs[2]);
                scuff.rotation.y = offs[3];
                this.group.add(scuff);
            }
        }
    }

    /* ══════════════════════════════════════════════════════════════
       EXPOSED PIPES
       ══════════════════════════════════════════════════════════ */

    _buildExposedPipes() {
        const pipeMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.4, metalness: 0.8 });
        const rustMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.7, metalness: 0.5 });
        const clampMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9, roughness: 0.25 });
        const _up = new THREE.Vector3(0, 1, 0);

        const runs = [
            { s: [-17, 4.6, -15.5], e: [17, 4.6, -15.5], r: 0.055, mat: pipeMat },
            { s: [-17, 4.55, -15.2], e: [17, 4.55, -15.2], r: 0.035, mat: rustMat },
            { s: [-17, 4.65, 15.5], e: [17, 4.65, 15.5], r: 0.055, mat: pipeMat },
            { s: [-15.5, 4.6, -17], e: [-15.5, 4.6, 17], r: 0.045, mat: pipeMat },
            { s: [15.5, 4.58, -17], e: [15.5, 4.58, 17], r: 0.05, mat: rustMat },
            { s: [-17, 4.5, -10], e: [17, 4.5, -10], r: 0.022, mat: pipeMat },
            { s: [-17, 4.72, 0], e: [17, 4.72, 0], r: 0.018, mat: pipeMat },
        ];

        for (const p of runs) {
            const sv = new THREE.Vector3(...p.s), ev = new THREE.Vector3(...p.e);
            const d = new THREE.Vector3().subVectors(ev, sv);
            const len = d.length();
            const mid = new THREE.Vector3().addVectors(sv, ev).multiplyScalar(0.5);
            const pipe = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, len, 10), p.mat);
            pipe.position.copy(mid);
            pipe.quaternion.setFromUnitVectors(_up, d.normalize());
            this.group.add(pipe);

            const segs = Math.floor(len / 4.5);
            for (let i = 0; i <= segs; i++) {
                const t = i / segs;
                const cp = new THREE.Vector3().lerpVectors(sv, ev, t);
                const cl = new THREE.Mesh(new THREE.TorusGeometry(p.r + 0.012, 0.006, 6, 10), clampMat);
                cl.position.copy(cp);
                cl.quaternion.copy(pipe.quaternion);
                this.group.add(cl);
            }
        }

        // Vertical drops
        for (const vp of [[-10, -15.5], [10, -15.5], [-10, 15.5], [10, 15.5]]) {
            const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.8, 8), pipeMat);
            drop.position.set(vp[0], 3.7, vp[1]);
            this.group.add(drop);
        }

        // Sprinkler heads
        for (let x = -12; x <= 12; x += 4) {
            const head = new THREE.Mesh(
                new THREE.CylinderGeometry(0.018, 0.012, 0.04, 6),
                new THREE.MeshStandardMaterial({ color: 0xcc4400, roughness: 0.5, metalness: 0.6 })
            );
            head.position.set(x, 4.7, 0);
            this.group.add(head);
        }
    }

    /* ══════════════════════════════════════════════════════════════
       CABLE TRAYS
       ══════════════════════════════════════════════════════════ */

    _buildCableTrays() {
        const trayMat = new THREE.MeshStandardMaterial({ color: 0x282828, roughness: 0.5, metalness: 0.7 });

        for (const z of [-13, 13]) {
            const tray = new THREE.Mesh(new THREE.BoxGeometry(30, 0.015, 0.35), trayMat);
            tray.position.set(0, 4.74, z); this.group.add(tray);

            for (const side of [-0.17, 0.17]) {
                const rail = new THREE.Mesh(new THREE.BoxGeometry(30, 0.05, 0.012), trayMat);
                rail.position.set(0, 4.77, z + side); this.group.add(rail);
            }

            for (let c = 0; c < 4; c++) {
                const cable = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.009, 0.009, 30, 5),
                    new THREE.MeshStandardMaterial({ color: [0x0a0a0a, 0x1a1010, 0x0a0a14, 0x0f0a0a][c], roughness: 0.8 })
                );
                cable.rotation.z = Math.PI / 2;
                cable.position.set(0, 4.752, z - 0.1 + c * 0.065);
                this.group.add(cable);
            }
        }
    }

    /* ══════════════════════════════════════════════════════════════
       VENTILATION
       ══════════════════════════════════════════════════════════ */

    _buildVentilation() {
        const ductMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.7 });

        const mainDuct = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 28), ductMat);
        mainDuct.position.set(-14, 4.5, 0);
        this.group.add(mainDuct);

        for (let z = -12; z <= 12; z += 4) {
            const vent = new THREE.Mesh(
                new THREE.PlaneGeometry(0.35, 0.2),
                new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, metalness: 0.3 })
            );
            vent.position.set(-13.69, 4.4, z);
            vent.rotation.y = Math.PI / 2;
            this.group.add(vent);

            for (let s = 0; s < 4; s++) {
                const slat = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.008, 0.3), ductMat);
                slat.position.set(-13.7, 4.35 + s * 0.04, z);
                this.group.add(slat);
            }
        }

        const returnDuct = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 20), ductMat);
        returnDuct.position.set(14.5, 4.55, -3);
        this.group.add(returnDuct);
    }

    /* ══════════════════════════════════════════════════════════════
       BAR
       ══════════════════════════════════════════════════════════ */

    _buildBar() {
        const g = new THREE.Group(); g.name = 'Bar';
        const barMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
        const steelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.35, metalness: 0.85 });
        const topMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5, metalness: 0.4 });

        const top = new THREE.Mesh(new THREE.BoxGeometry(8, 0.08, 1), topMat);
        top.position.set(-11, 1.1, 0); g.add(top);

        const edge = new THREE.Mesh(new THREE.BoxGeometry(8, 0.08, 0.015), steelMat);
        edge.position.set(-11, 1.1, 0.5); g.add(edge);

        const front = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 0.035), steelMat);
        front.position.set(-11, 0.55, 0.5); g.add(front);

        const back = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 0.035), barMat);
        back.position.set(-11, 0.55, -0.48); g.add(back);

        // Foot rail
        const footRail = new THREE.Mesh(
            new THREE.CylinderGeometry(0.016, 0.016, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.2, metalness: 0.9 })
        );
        footRail.rotation.z = Math.PI / 2;
        footRail.position.set(-11, 0.18, 0.65); g.add(footRail);

        for (let i = 0; i < 4; i++) {
            const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.04), steelMat);
            bracket.position.set(-13.5 + i * 2.4, 0.09, 0.65); g.add(bracket);
        }

        // Stools
        for (let i = 0; i < 5; i++) {
            const sg = new THREE.Group();
            sg.position.set(-13.5 + i * 1.5, 0, 1.2);

            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.68, 8), steelMat);
            stem.position.y = 0.34; sg.add(stem);

            for (let l = 0; l < 4; l++) {
                const a = (l / 4) * Math.PI * 2;
                const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.35, 5), steelMat);
                leg.position.set(Math.cos(a) * 0.14, 0.12, Math.sin(a) * 0.14);
                leg.rotation.z = Math.cos(a) * 0.3;
                leg.rotation.x = Math.sin(a) * 0.3;
                sg.add(leg);
            }

            const seat = new THREE.Mesh(
                new THREE.CylinderGeometry(0.17, 0.15, 0.035, 14),
                new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.65 })
            );
            seat.position.y = 0.7; sg.add(seat);
            g.add(sg);
        }

        // Back bar
        const backBar = new THREE.Mesh(new THREE.BoxGeometry(6, 2.5, 0.04),
            new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.9 }));
        backBar.position.set(-11, 1.8, -1.2); g.add(backBar);

        for (let s = 0; s < 3; s++) {
            const shelf = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.02, 0.25), steelMat);
            shelf.position.set(-11, 1.2 + s * 0.5, -1.07); g.add(shelf);
        }

        // LED strip under bar top
        const led = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.008, 0.008),
            new THREE.MeshBasicMaterial({ color: 0xff2244, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending }));
        led.position.set(-11, 1.04, 0.48); g.add(led);

        this.group.add(g);
    }

    /* ══════════════════════════════════════════════════════════════
       STAGE
       ══════════════════════════════════════════════════════════ */

    _buildStage() {
        const stageMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.82, metalness: 0.08 });
        const steelMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.25 });

        const stage = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 4), stageMat);
        stage.position.set(0, 0.25, -13.5);
        stage.castShadow = true; stage.receiveShadow = true;
        this.group.add(stage);

        const fascia = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 0.018), steelMat);
        fascia.position.set(0, 0.25, -11.51); this.group.add(fascia);

        const step = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.25, 0.45), stageMat);
        step.position.set(0, 0.125, -11.28); this.group.add(step);

        // Safety nosing
        const nosing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.012, 0.04),
            new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.8 }));
        nosing.position.set(0, 0.252, -11.06); this.group.add(nosing);

        // Stage monitors
        for (const s of [-1, 1]) {
            const wedge = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.32),
                new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7, metalness: 0.15 }));
            wedge.position.set(s * 3.8, 0.61, -12.5);
            wedge.rotation.x = -0.15;
            this.group.add(wedge);
        }

        // Gaffer tape X
        const tapeMat = new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.08 });
        for (let t = 0; t < 2; t++) {
            const tape = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.4), tapeMat);
            tape.rotation.x = -Math.PI / 2;
            tape.rotation.z = t * Math.PI / 2;
            tape.position.set(0, 0.502, -13.5);
            this.group.add(tape);
        }
    }

    /* ══════════════════════════════════════════════════════════════
       WALL ART — Graffiti, stencils, stickers
       ══════════════════════════════════════════════════════════ */

    _buildWallArt() {
        // Vivid graffiti colours — like UV / spray paint in a real club
        const artConfigs = [
            { x: -10, y: 2.5, z: -15.97, w: 4, h: 2.5, ry: 0, colors: [0xff2266, 0x4488ff, 0xffcc00] },
            { x: 10, y: 2.0, z: -15.97, w: 3, h: 1.8, ry: 0, colors: [0x8844ff, 0x22ff88, 0xff6622] },
            { x: -6, y: 2.2, z: 15.97, w: 5, h: 2.2, ry: Math.PI, colors: [0xff4488, 0x44ccff, 0xeeff44] },
            { x: 8, y: 3.0, z: 15.97, w: 3.5, h: 1.5, ry: Math.PI, colors: [0x33aaff, 0xff3388, 0xaaff22] },
            { x: -15.97, y: 1.2, z: -10, w: 3, h: 1.5, ry: Math.PI / 2, colors: [0xff6644, 0x44aaff, 0xffee33] },
            { x: 15.97, y: 1.0, z: 10, w: 4, h: 1.2, ry: -Math.PI / 2, colors: [0xcc44ff, 0x44ffaa, 0xff4444] },
        ];

        for (const art of artConfigs) {
            const ag = new THREE.Group();
            ag.position.set(art.x, art.y, art.z);
            ag.rotation.y = art.ry;

            // Use MeshBasicMaterial so graffiti self-illuminates (like UV paint)
            const base = new THREE.Mesh(
                new THREE.PlaneGeometry(art.w * 0.8, art.h * 0.7),
                new THREE.MeshBasicMaterial({
                    color: art.colors[0], transparent: true,
                    opacity: 0.12 + Math.random() * 0.08, side: THREE.DoubleSide,
                    depthWrite: false,
                })
            );
            ag.add(base);

            for (let s = 0; s < 5 + Math.floor(Math.random() * 4); s++) {
                const shape = new THREE.Mesh(
                    Math.random() > 0.5
                        ? new THREE.PlaneGeometry(0.2 + Math.random() * art.w * 0.3, 0.1 + Math.random() * art.h * 0.3)
                        : new THREE.CircleGeometry(0.1 + Math.random() * 0.5, 8),
                    new THREE.MeshBasicMaterial({
                        color: art.colors[Math.floor(Math.random() * art.colors.length)],
                        transparent: true,
                        opacity: 0.15 + Math.random() * 0.2, side: THREE.DoubleSide,
                        depthWrite: false,
                    })
                );
                shape.position.set(
                    (Math.random() - 0.5) * art.w * 0.7,
                    (Math.random() - 0.5) * art.h * 0.6,
                    0.002 + s * 0.001
                );
                shape.rotation.z = Math.random() * Math.PI * 2;
                ag.add(shape);
            }

            // Drip marks
            for (let d = 0; d < 2 + Math.floor(Math.random() * 3); d++) {
                const drip = new THREE.Mesh(
                    new THREE.PlaneGeometry(0.015, 0.2 + Math.random() * 0.5),
                    new THREE.MeshBasicMaterial({
                        color: art.colors[Math.floor(Math.random() * art.colors.length)],
                        transparent: true, opacity: 0.2 + Math.random() * 0.15, side: THREE.DoubleSide,
                        depthWrite: false,
                    })
                );
                drip.position.set(
                    (Math.random() - 0.5) * art.w * 0.6,
                    -art.h * 0.35 - Math.random() * 0.3,
                    0.003
                );
                ag.add(drip);
            }
            this.group.add(ag);
        }

        // Stickers on pillars & walls
        const pillarPos = [[-8, -8], [8, -8], [-8, 0], [8, 0], [-8, 8], [8, 8]];
        for (let i = 0; i < 18; i++) {
            const sticker = new THREE.Mesh(
                new THREE.PlaneGeometry(0.06 + Math.random() * 0.08, 0.04 + Math.random() * 0.05),
                new THREE.MeshBasicMaterial({
                    color: new THREE.Color().setHSL(Math.random(), 0.7, 0.45 + Math.random() * 0.2),
                    transparent: true, opacity: 0.5 + Math.random() * 0.3,
                    side: THREE.DoubleSide, depthWrite: false,
                })
            );

            if (Math.random() < 0.5) {
                const pp = pillarPos[Math.floor(Math.random() * pillarPos.length)];
                const face = Math.floor(Math.random() * 4);
                const yPos = 1 + Math.random() * 2;
                const offs = [
                    [pp[0] + 0.276, yPos, pp[1] + (Math.random() - 0.5) * 0.3, Math.PI / 2],
                    [pp[0] - 0.276, yPos, pp[1] + (Math.random() - 0.5) * 0.3, -Math.PI / 2],
                    [pp[0] + (Math.random() - 0.5) * 0.3, yPos, pp[1] + 0.276, 0],
                    [pp[0] + (Math.random() - 0.5) * 0.3, yPos, pp[1] - 0.276, Math.PI],
                ][face];
                sticker.position.set(offs[0], offs[1], offs[2]);
                sticker.rotation.y = offs[3];
            } else {
                const side = Math.random() > 0.5 ? 1 : -1;
                sticker.position.set(side * 15.97, 0.8 + Math.random() * 2.5, (Math.random() - 0.5) * 28);
                sticker.rotation.y = side * -Math.PI / 2;
            }
            sticker.rotation.z = (Math.random() - 0.5) * 0.3;
            this.group.add(sticker);
        }
    }

    /* ══════════════════════════════════════════════════════════════
       INDUSTRIAL DETAILS
       ══════════════════════════════════════════════════════════ */

    _buildIndustrialDetails() {
        // EXIT signs
        const exitConfigs = [
            { x: 15.96, y: 4.2, z: 0, ry: -Math.PI / 2 },
            { x: -15.96, y: 4.2, z: 12, ry: Math.PI / 2 },
            { x: 0, y: 4.3, z: 15.96, ry: Math.PI },
        ];
        for (const ec of exitConfigs) {
            const eg = new THREE.Group();
            eg.add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.03), new THREE.MeshBasicMaterial({ color: 0x00aa00 })));
            const glow = new THREE.PointLight(0x00aa00, 0.3, 2);
            glow.position.set(0, -0.1, 0.05); eg.add(glow);
            eg.position.set(ec.x, ec.y, ec.z);
            eg.rotation.y = ec.ry;
            this.group.add(eg);
        }

        // Electrical panel
        const panelMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.7, roughness: 0.4 });
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, 0.5), panelMat);
        panel.position.set(-15.96, 1.5, -10); this.group.add(panel);

        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.04, 0.04),
            new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.9, roughness: 0.2 }));
        handle.position.set(-15.94, 1.5, -9.85); this.group.add(handle);

        // Fire extinguishers
        const extMat = new THREE.MeshStandardMaterial({ color: 0xaa0000, roughness: 0.5, metalness: 0.3 });
        const bracketMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.3 });
        for (const ez of [-8, 5]) {
            const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.38, 8), extMat);
            ext.position.set(-15.92, 0.8, ez); this.group.add(ext);
            const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.08), bracketMat);
            bracket.position.set(-15.96, 1.0, ez); this.group.add(bracket);
        }

        // Cable covers on floor
        const ccMat = new THREE.MeshStandardMaterial({ color: 0xccaa00, roughness: 0.7, metalness: 0.1 });
        for (const cc of [{ x: -5.5, z: -11.5, len: 3 }, { x: 5.5, z: -11.5, len: 3 }]) {
            const cover = new THREE.Mesh(new THREE.BoxGeometry(cc.len, 0.015, 0.08), ccMat);
            cover.position.set(cc.x, 0.008, cc.z); this.group.add(cover);
        }

        // Smoke detectors
        for (const sp of [[4, 4], [-4, -4], [0, 8], [0, -8]]) {
            const det = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.025, 10),
                new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.6, metalness: 0.1 }));
            det.position.set(sp[0], 4.98, sp[1]); this.group.add(det);

            const led = new THREE.Mesh(new THREE.CircleGeometry(0.005, 6),
                new THREE.MeshBasicMaterial({ color: 0xff0000 }));
            led.position.set(sp[0], 4.968, sp[1] + 0.03);
            led.rotation.x = Math.PI / 2;
            this.group.add(led);
        }

        // Conduit from panel to ceiling
        const conduitMat = new THREE.MeshStandardMaterial({ color: 0x404040, roughness: 0.35, metalness: 0.85 });
        const _up = new THREE.Vector3(0, 1, 0);
        const conduits = [
            { s: [-15.96, 1.5, -10], e: [-15.96, 4.5, -10] },
            { s: [-15.96, 4.5, -10], e: [-15.96, 4.5, -14] },
        ];
        for (const cd of conduits) {
            const sv = new THREE.Vector3(...cd.s), ev = new THREE.Vector3(...cd.e);
            const d = new THREE.Vector3().subVectors(ev, sv);
            const len = d.length();
            const mid = new THREE.Vector3().addVectors(sv, ev).multiplyScalar(0.5);
            const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 6), conduitMat);
            conduit.position.copy(mid);
            conduit.quaternion.setFromUnitVectors(_up, d.normalize());
            this.group.add(conduit);
        }
    }
}
