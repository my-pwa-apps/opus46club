/**
 * WebXR Manager — VR session management, controllers, teleportation, haptics
 */
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

export class WebXRManager {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.isPresenting = false;
        this.controllers = [];
        this.controllerGrips = [];
        this.cameraRig = null;
        this.teleportMarker = null;
        this.raycaster = new THREE.Raycaster();
        this.tempMatrix = new THREE.Matrix4();

        // External hook — set by UIController so squeeze can trigger smoke
        this.onSqueeze = null;

        // Haptic state — pulsed on beats
        this._lastBeat = false;
    }

    async init() {
        if (!('xr' in navigator)) {
            console.log('WebXR not available');
            return;
        }

        const supported = await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);

        if (!supported) {
            console.log('Immersive VR not supported');
            return;
        }

        // Enable XR on renderer
        this.renderer.xr.enabled = true;
        this.renderer.xr.setReferenceSpaceType('local-floor');

        // Camera rig (for teleportation)
        this.cameraRig = new THREE.Group();
        this.cameraRig.add(this.camera);
        this.scene.add(this.cameraRig);

        // Build controllers
        this._buildControllers();

        // Build teleport marker
        this._buildTeleportMarker();

        // Show VR button
        const vrBtn = document.getElementById('btn-vr');
        vrBtn.style.display = '';
        vrBtn.addEventListener('click', () => this.enterVR());

        // Session events
        this.renderer.xr.addEventListener('sessionstart', () => {
            this.isPresenting = true;
            document.getElementById('ui-overlay').style.display = 'none';
        });

        this.renderer.xr.addEventListener('sessionend', () => {
            this.isPresenting = false;
            document.getElementById('ui-overlay').style.display = '';
        });
    }

    _buildControllers() {
        const controllerModelFactory = new XRControllerModelFactory();

        for (let i = 0; i < 2; i++) {
            // Controller
            const controller = this.renderer.xr.getController(i);
            controller.addEventListener('selectstart', (e) => this._onSelectStart(e, i));
            controller.addEventListener('selectend', (e) => this._onSelectEnd(e, i));
            controller.addEventListener('squeezestart', (e) => this._onSqueezeStart(e, i));
            this.cameraRig.add(controller);
            this.controllers.push(controller);

            // Controller model
            const grip = this.renderer.xr.getControllerGrip(i);
            grip.add(controllerModelFactory.createControllerModel(grip));
            this.cameraRig.add(grip);
            this.controllerGrips.push(grip);

            // Ray line
            const lineGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, -5)
            ]);
            const lineMat = new THREE.LineBasicMaterial({
                color: i === 0 ? 0x00ffff : 0xff00ff,
                transparent: true,
                opacity: 0.5
            });
            const line = new THREE.Line(lineGeo, lineMat);
            controller.add(line);
        }
    }

    _buildTeleportMarker() {
        // Ring marker on floor
        const markerGeo = new THREE.RingGeometry(0.15, 0.25, 32);
        const markerMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        this.teleportMarker = new THREE.Mesh(markerGeo, markerMat);
        this.teleportMarker.rotation.x = -Math.PI / 2;
        this.teleportMarker.visible = false;
        this.scene.add(this.teleportMarker);

        // Inner circle
        const inner = new THREE.Mesh(
            new THREE.CircleGeometry(0.12, 32),
            new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.2,
                side: THREE.DoubleSide
            })
        );
        inner.rotation.x = -Math.PI / 2;
        this.teleportMarker.add(inner);
    }

    _onSelectStart(event, controllerIndex) {
        // Teleportation with right controller
        if (controllerIndex === 1) {
            const controller = this.controllers[controllerIndex];
            this.tempMatrix.identity().extractRotation(controller.matrixWorld);

            this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
            this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

            // Check floor intersection
            const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersection = new THREE.Vector3();
            this.raycaster.ray.intersectPlane(floorPlane, intersection);

            if (intersection) {
                // Clamp to club bounds
                intersection.x = THREE.MathUtils.clamp(intersection.x, -14, 14);
                intersection.z = THREE.MathUtils.clamp(intersection.z, -14, 14);

                this.teleportMarker.position.copy(intersection);
                this.teleportMarker.position.y = 0.01;
                this.teleportMarker.visible = true;
            }
        }
    }

    _onSelectEnd(event, controllerIndex) {
        if (controllerIndex === 1 && this.teleportMarker.visible) {
            // Teleport camera rig
            this.cameraRig.position.x = this.teleportMarker.position.x;
            this.cameraRig.position.z = this.teleportMarker.position.z;
            this.teleportMarker.visible = false;
        }
    }

    _onSqueezeStart(event, controllerIndex) {
        // Squeeze triggers smoke jets
        if (this.onSqueeze) this.onSqueeze();

        // Haptic pulse as confirmation
        const session = this.renderer.xr.getSession();
        if (session) {
            const source = event.target?.gamepad;
            if (source?.hapticActuators?.[0]) {
                source.hapticActuators[0].pulse(0.6, 100);
            }
        }
    }

    /**
     * Call once per frame from the animation loop.
     * Delivers haptic feedback synced to detected beats.
     */
    update(state) {
        if (!this.isPresenting) return;

        const isBeat = state?.isBeat ?? false;
        if (isBeat && !this._lastBeat) {
            // Fire haptic pulse on new beat onset
            const session = this.renderer.xr.getSession();
            if (session) {
                for (const source of session.inputSources) {
                    if (source.gamepad?.hapticActuators?.[0]) {
                        const intensity = state.dropActive ? 0.7 : 0.25;
                        source.gamepad.hapticActuators[0].pulse(intensity, 60);
                    }
                }
            }
        }
        this._lastBeat = isBeat;

        // Animate teleport marker ring
        if (this.teleportMarker?.visible) {
            this.teleportMarker.rotation.z += 0.02;
        }
    }

    async enterVR() {
        try {
            const session = await navigator.xr.requestSession('immersive-vr', {
                optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
            });
            this.renderer.xr.setSession(session);
        } catch (err) {
            console.error('Failed to enter VR:', err);
        }
    }
}
