/**
 * DJ Booth — CDJs, mixer, monitors, LED screens, speaker stacks
 */
import * as THREE from 'three';

export class DJBooth {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.name = 'DJBooth';
        this.group.position.set(0, 0.5, -13.5);
        scene.add(this.group);
        this.screenMeshes = [];
        this.vuMeshes = [];
        this._jogL = null;
        this._jogR = null;
        this._jogRings = [];
    }

    build() {
        this._buildDesk();
        this._buildCDJs();
        this._buildMixer();
        this._buildMonitors();
        this._buildDJScreens();
        this._buildSpeakerStacks();
    }

    _buildDesk() {
        const dm = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.35, metalness: 0.6, envMapIntensity: 1.5 });
        const top = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.06, 1.6), dm);
        top.position.set(0, 0.97, 0); top.castShadow = true;
        this.group.add(top);

        const front = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.94, 0.04),
            new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.5, metalness: 0.4 }));
        front.position.set(0, 0.5, 0.78);
        this.group.add(front);

        for (const s of [-1, 1]) {
            const sp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.94, 1.6), dm);
            sp.position.set(s * 2.4, 0.5, 0); this.group.add(sp);
        }
    }

    _buildCDJs() {
        const cm = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.2, metalness: 0.8, envMapIntensity: 2.0 });
        for (const s of [-1, 1]) {
            const cg = new THREE.Group();
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.1, 0.75), cm);
            body.position.y = 0.05; cg.add(body);

            // Jog wheel
            const jw = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.035, 32),
                new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.15, metalness: 0.9, envMapIntensity: 2.5 }));
            jw.position.set(0, 0.12, 0.08); jw.name = `jog-${s > 0 ? 'R' : 'L'}`;
            if (s > 0) this._jogR = jw; else this._jogL = jw;
            cg.add(jw);

            // Jog ring LED
            const jr = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.006, 8, 32),
                new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.5 }));
            jr.rotation.x = Math.PI / 2; jr.position.set(0, 0.11, 0.08); jr.name = 'jog-ring';
            this._jogRings.push(jr);
            cg.add(jr);

            // Display
            const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1),
                new THREE.MeshBasicMaterial({ color: 0x001118 }));
            disp.position.set(0, 0.106, -0.2); disp.rotation.x = -Math.PI / 2;
            cg.add(disp);

            // Buttons
            for (let b = 0; b < 4; b++) {
                const btn = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.015, 0.035),
                    new THREE.MeshBasicMaterial({ color: [0x00cc00, 0xcc0000, 0x0066cc, 0xcc8800][b] }));
                btn.position.set(-0.1 + b * 0.07, 0.11, -0.3); cg.add(btn);
            }
            cg.position.set(s * 1.35, 1.0, 0);
            this.group.add(cg);
        }
    }

    _buildMixer() {
        const mg = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.06, 0.7),
            new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.15, metalness: 0.85, envMapIntensity: 2.0 }));
        body.position.y = 0.03; mg.add(body);

        for (let ch = 0; ch < 4; ch++) {
            const slot = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.015, 0.18),
                new THREE.MeshBasicMaterial({ color: 0x333333 }));
            slot.position.set(-0.18 + ch * 0.12, 0.065, 0.08); mg.add(slot);

            const knob = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, 0.025),
                new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.2, metalness: 0.8 }));
            knob.position.set(-0.18 + ch * 0.12, 0.07, 0.08 + (Math.random() - 0.5) * 0.12);
            mg.add(knob);

            for (let led = 0; led < 8; led++) {
                const vu = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.006, 0.006),
                    new THREE.MeshBasicMaterial({
                        color: led < 5 ? 0x00cc00 : led < 7 ? 0xccaa00 : 0xcc0000,
                        transparent: true, opacity: 0.2
                    }));
                vu.position.set(-0.18 + ch * 0.12, 0.065, -0.04 - led * 0.022);
                vu.name = `vu-${ch}-${led}`;
                this.vuMeshes.push(vu);
                mg.add(vu);
            }

            // EQ knobs
            for (let eq = 0; eq < 3; eq++) {
                const ek = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 12),
                    new THREE.MeshStandardMaterial({ color: [0x3333cc, 0xcccccc, 0xcc3333][eq], roughness: 0.3, metalness: 0.7 }));
                ek.position.set(-0.18 + ch * 0.12, 0.065, -0.22 - eq * 0.045);
                mg.add(ek);
            }
        }

        // Crossfader
        const xf = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, 0.02),
            new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.2, metalness: 0.8 }));
        xf.position.set(0, 0.07, 0.27); mg.add(xf);

        mg.position.set(0, 1.0, 0);
        this.group.add(mg);
    }

    _buildMonitors() {
        const mm = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6, metalness: 0.3 });
        for (const s of [-1, 1]) {
            const w = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.25, 0.3), mm);
            w.position.set(s * 1.7, 0.65, -1.1);
            w.rotation.x = -0.15;
            w.castShadow = true;
            this.group.add(w);
            const cone = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12),
                new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }));
            cone.position.set(s * 1.7, 0.66, -0.95);
            this.group.add(cone);
        }
    }

    _buildDJScreens() {
        // Main VJ screen
        const ms = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 2.8),
            new THREE.MeshBasicMaterial({ color: 0x000811, side: THREE.DoubleSide }));
        ms.position.set(0, 3.2, -2.3); ms.name = 'main-vj-screen';
        ms.userData.isScreen = true;
        this.screenMeshes.push(ms);
        this.group.add(ms);

        // Frame
        const fm = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.8 });
        for (const e of [
            { s: [7.7, 0.06, 0.06], p: [0, 4.64, -2.3] },
            { s: [7.7, 0.06, 0.06], p: [0, 1.76, -2.3] },
            { s: [0.06, 2.94, 0.06], p: [-3.8, 3.2, -2.3] },
            { s: [0.06, 2.94, 0.06], p: [3.8, 3.2, -2.3] },
        ]) {
            const f = new THREE.Mesh(new THREE.BoxGeometry(...e.s), fm);
            f.position.set(...e.p); this.group.add(f);
        }

        // Side screens
        for (const s of [-1, 1]) {
            const ss = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.8),
                new THREE.MeshBasicMaterial({ color: 0x000811, side: THREE.DoubleSide }));
            ss.position.set(s * 5.2, 2.8, -1.3);
            ss.rotation.y = s * -0.35;
            ss.name = `side-screen-${s > 0 ? 'R' : 'L'}`;
            ss.userData.isScreen = true;
            this.screenMeshes.push(ss);
            this.group.add(ss);
        }
    }

    _buildSpeakerStacks() {
        const sm = new THREE.MeshStandardMaterial({ color: 0x0f0f0f, roughness: 0.7, metalness: 0.2 });
        const gm = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });

        for (const s of [-1, 1]) {
            const sg = new THREE.Group();
            for (let i = 0; i < 2; i++) {
                const sub = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.75, 0.85), sm);
                sub.position.set(0, 0.375 + i * 0.75, 0); sub.castShadow = true;
                sg.add(sub);
                const gr = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.65), gm);
                gr.position.set(0, 0.375 + i * 0.75, 0.43); sg.add(gr);
                const port = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 14),
                    new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.5 }));
                port.rotation.x = Math.PI / 2;
                port.position.set(0, 0.375 + i * 0.75, 0.44); sg.add(port);
            }
            const top = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.45, 0.55), sm);
            top.position.set(0, 1.725, 0); top.castShadow = true; sg.add(top);
            const horn = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.04),
                new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.6, metalness: 0.4 }));
            horn.position.set(0, 1.8, 0.28); sg.add(horn);

            sg.position.set(s * 5.5, 0, -0.5);
            this.group.add(sg);
        }
    }

    update(time, dt, state) {
        if (this._jogL) this._jogL.rotation.y += dt * 2;
        if (this._jogR) this._jogR.rotation.y -= dt * 2;

        const ringOp = state.isBeat ? 0.85 : 0.25 + Math.sin(time * 4) * 0.1;
        for (const jr of this._jogRings) jr.material.opacity = ringOp;

        // VU meters — smooth audio-reactive animation
        const bass = state.bass ?? 0.3;
        const mids = state.mids ?? 0.25;
        const energy = state.audioEnergy ?? 0.35;
        for (let i = 0; i < this.vuMeshes.length; i++) {
            const vu = this.vuMeshes[i];
            const channelPhase = Math.floor(i / 8);  // 4 channels, 8 LEDs each
            const ledIdx = i % 8;
            const channelLevel = channelPhase === 0 ? bass
                : channelPhase === 1 ? mids
                : channelPhase === 2 ? energy
                : (bass + mids) * 0.5;
            // LEDs light up from bottom; higher LEDs need more level
            const threshold = ledIdx / 8;
            const target = channelLevel > threshold ? 0.65 + (channelLevel - threshold) * 0.35 : 0.05;
            vu.material.opacity += (target - vu.material.opacity) * 0.15;
        }

        const hue = (time * 0.04) % 1;
        const col = new THREE.Color().setHSL(hue, 0.6, 0.06);
        for (const s of this.screenMeshes) s.material.color.copy(col);
    }
}
