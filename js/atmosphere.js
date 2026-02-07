/**
 * Atmosphere — Multi-layer haze system for OPUS 46
 *
 * Ground fog    — 8 stacked horizontal planes near floor, slow undulation
 * Room haze     — 10 large angled planes at mid-height catching beams
 * CO2 jets      — 4 stage-front nozzles, column + cloud dissipation
 *
 * Haze density responds to state.fogDensity and pulses subtly on beats.
 * No floating particles — all effects use transparent plane geometry.
 */

import * as THREE from 'three';

export class AtmosphereSystem {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.name = 'Atmosphere';
        scene.add(this.group);
        this.layers   = [];   // { mesh, baseY, kind }
        this.smokeJets = [];
    }

    build() {
        this._buildGroundFog();
        this._buildRoomHaze();
        this._buildSmokeJets();
    }

    /* ── Ground fog: low-lying glycol haze ─────────────────────── */
    _buildGroundFog() {
        const mat = () => new THREE.MeshBasicMaterial({
            color: 0x667788, transparent: true, opacity: 0.06,
            side: THREE.DoubleSide, depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        for (let i = 0; i < 8; i++) {
            const y = 0.04 + i * 0.12;
            const plane = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), mat());
            plane.rotation.x = -Math.PI / 2;
            plane.position.y = y;
            this.group.add(plane);
            this.layers.push({ mesh: plane, baseY: y, kind: 'ground', layer: i });
        }
    }

    /* ── Room haze: mid-air planes that catch beams ────────────── */
    _buildRoomHaze() {
        const mat = () => new THREE.MeshBasicMaterial({
            color: 0x556677, transparent: true, opacity: 0.035,
            side: THREE.DoubleSide, depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        for (let i = 0; i < 10; i++) {
            const w = 7 + Math.random() * 12;
            const h = 1.8 + Math.random() * 2.5;
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat());
            mesh.position.set(
                (Math.random() - 0.5) * 14,
                1.2 + Math.random() * 2.5,
                (Math.random() - 0.5) * 14,
            );
            mesh.rotation.y = Math.random() * Math.PI;
            mesh.rotation.x = (Math.random() - 0.5) * 0.25;
            this.group.add(mesh);
            this.layers.push({ mesh, baseY: mesh.position.y, kind: 'room', layer: i });
        }

        // Two large horizontal sheets at beam height — catches cross-beams
        for (let i = 0; i < 2; i++) {
            const sheet = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), mat());
            sheet.rotation.x = -Math.PI / 2;
            sheet.position.y = 2.5 + i * 1.0;
            this.group.add(sheet);
            this.layers.push({ mesh: sheet, baseY: sheet.position.y, kind: 'sheet', layer: i });
        }
    }

    /* ── CO2 smoke jets ────────────────────────────────────────── */
    _buildSmokeJets() {
        const positions = [
            [-3.5, 0.5, -11.5], [-1.2, 0.5, -11.5],
            [ 1.2, 0.5, -11.5], [ 3.5, 0.5, -11.5],
        ];
        const nozzleMat = new THREE.MeshStandardMaterial({
            color: 0x333333, metalness: 0.8, roughness: 0.3,
        });

        for (const pos of positions) {
            // Nozzle
            const nozzle = new THREE.Mesh(
                new THREE.CylinderGeometry(0.04, 0.06, 0.14, 8), nozzleMat
            );
            nozzle.position.set(...pos);
            this.group.add(nozzle);

            // Jet column
            const jet = new THREE.Mesh(
                new THREE.CylinderGeometry(0.02, 0.3, 3.2, 8, 1, true),
                new THREE.MeshBasicMaterial({
                    color: 0xffffff, transparent: true, opacity: 0,
                    side: THREE.DoubleSide, depthWrite: false,
                    blending: THREE.AdditiveBlending,
                })
            );
            jet.position.set(pos[0], pos[1] + 1.6, pos[2]);
            this.group.add(jet);

            // Dissipation cloud
            const cloud = new THREE.Mesh(
                new THREE.SphereGeometry(0.7, 8, 6),
                new THREE.MeshBasicMaterial({
                    color: 0xcccccc, transparent: true, opacity: 0,
                    depthWrite: false, blending: THREE.AdditiveBlending,
                })
            );
            cloud.position.set(pos[0], pos[1] + 3.2, pos[2]);
            cloud.scale.set(1, 0.4, 1);
            this.group.add(cloud);

            this.smokeJets.push({
                jet, cloud,
                basePos: new THREE.Vector3(...pos),
                active: false, timer: 0,
            });
        }
    }

    /* ── Public ─────────────────────────────────────────────────── */

    triggerSmokeJets() {
        for (const j of this.smokeJets) {
            j.active = true;
            j.timer  = 0;
        }
    }

    /* ── Update ─────────────────────────────────────────────────── */

    update(time, dt, state) {
        const fog  = state.fogDensity ?? 0.5;
        const beat = state.isBeat;

        for (const l of this.layers) {
            if (l.kind === 'ground') {
                const undulate = Math.sin(time * 0.25 + l.layer * 0.45) * 0.035;
                l.mesh.position.y = l.baseY + undulate;
                l.mesh.rotation.z = time * 0.008 + l.layer * 0.18;
                l.mesh.material.opacity = fog * 0.14 * (1 - l.layer * 0.09) * (beat ? 1.3 : 1);
            } else if (l.kind === 'room') {
                l.mesh.rotation.y += dt * 0.006;
                l.mesh.material.opacity = fog * 0.065 * (beat ? 1.2 : 1);
            } else if (l.kind === 'sheet') {
                l.mesh.material.opacity = fog * 0.045 * (beat ? 1.15 : 1);
                l.mesh.position.y = l.baseY + Math.sin(time * 0.12 + l.layer) * 0.08;
            }
        }

        // CO2 jets
        for (const j of this.smokeJets) {
            if (j.active) {
                j.timer += dt;
                if (j.timer < 1.2) {
                    j.jet.material.opacity = Math.min(j.timer * 0.5, 0.28);
                    j.jet.scale.y = Math.min(j.timer * 1.4, 1.3);
                    j.cloud.material.opacity = Math.min(j.timer * 0.25, 0.12);
                    j.cloud.scale.setScalar(0.5 + j.timer * 0.7);
                } else if (j.timer < 3.5) {
                    const fade = 1 - (j.timer - 1.2) / 2.3;
                    j.jet.material.opacity = 0.28 * fade * fade;
                    j.cloud.material.opacity = 0.12 * fade;
                    j.cloud.scale.setScalar(1.2 + (j.timer - 1.2) * 0.5);
                    j.cloud.position.y = j.basePos.y + 3.2 + (j.timer - 1.2) * 0.35;
                } else {
                    j.active = false;
                    j.jet.material.opacity = 0;
                    j.cloud.material.opacity = 0;
                    j.cloud.position.y = j.basePos.y + 3.2;
                    j.cloud.scale.setScalar(0.6);
                    j.jet.scale.y = 0.1;
                }
            }
        }

        // Auto-trigger on drop
        if (state.dropActive && !this.smokeJets[0].active) {
            this.triggerSmokeJets();
        }
    }
}
