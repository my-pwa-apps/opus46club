/**
 * OPUS 46 — Virtual Club Environment
 * Industrial underground techno club — Main entry point
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { ClubGeometry } from './club-geometry.js';
import { DJBooth } from './dj-booth.js';
import { LightingSystem } from './lighting.js';
import { AudioEngine } from './audio-engine.js';
import { VJVisuals } from './vj-visuals.js';
import { AtmosphereSystem } from './atmosphere.js';
import { WebXRManager } from './webxr-manager.js';
import { UIController } from './ui-controller.js';

// ── Globals ──
let renderer, scene, camera, composer, controls;
let clock, deltaTime, elapsedTime;
let clubGeometry, djBooth, lightingSystem;
let audioEngine, vjVisuals, atmosphere, xrManager, ui;

const state = {
    bpm: 130,
    masterVolume: 0.7,
    fogDensity: 0.5,
    lightingPreset: 'club',
    visualMode: 'wave',
    beatPhase: 0,
    isBeat: false,
    dropActive: false,
    audioData: null
};

// ── Loading ──
const loadingScreen = document.getElementById('loading-screen');
const loaderFill = document.getElementById('loader-fill');
const loaderText = document.getElementById('loader-text');

function updateLoader(progress, text) {
    loaderFill.style.width = `${progress}%`;
    loaderText.textContent = text;
}

// ── Init ──
async function init() {
    updateLoader(5, 'Creating renderer...');
    clock = new THREE.Clock();

    const canvas = document.getElementById('club-canvas');
    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.65;             // dark venue — light is the show
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    updateLoader(10, 'Building scene...');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010101);
    scene.fog = new THREE.FogExp2(0x010101, 0.022);  // tuned for beam visibility

    // Procedural dark environment map — gives metallic surfaces subtle reflections
    const envScene = new THREE.Scene();
    // Dark ambient dome with subtle coloured highlights simulating club lighting
    const envGeo = new THREE.SphereGeometry(50, 16, 8);
    const envColors = envGeo.attributes.position.count;
    const envColorAttr = new Float32Array(envColors * 3);
    for (let i = 0; i < envColors; i++) {
        const y = envGeo.attributes.position.getY(i) / 50; // -1 to 1
        // Floor: very dark. Ceiling: hint of warm light. Sides: cold blue tint.
        const r = 0.01 + Math.max(0, y) * 0.03;
        const g = 0.01 + Math.max(0, y) * 0.02;
        const b = 0.015 + (1 - Math.abs(y)) * 0.04;
        envColorAttr[i * 3] = r;
        envColorAttr[i * 3 + 1] = g;
        envColorAttr[i * 3 + 2] = b;
    }
    envGeo.setAttribute('color', new THREE.BufferAttribute(envColorAttr, 3));
    envScene.add(new THREE.Mesh(envGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    // A few bright hotspots simulating beam reflections
    const hotspotGeo = new THREE.SphereGeometry(1.5, 6, 4);
    const hotspots = [
        { pos: [0, 40, -30], color: 0x4466ff },
        { pos: [-25, 35, 10], color: 0xff2266 },
        { pos: [20, 38, 15], color: 0x00ffcc },
        { pos: [0, -10, 0], color: 0x111111 },
    ];
    for (const hs of hotspots) {
        const m = new THREE.Mesh(hotspotGeo, new THREE.MeshBasicMaterial({ color: hs.color }));
        m.position.set(...hs.pos);
        envScene.add(m);
    }
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileCubemapShader();
    const envRT = pmremGenerator.fromScene(envScene, 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.05, 120);
    camera.position.set(0, 1.7, 8);

    controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 1.4, -2);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.minDistance = 1;
    controls.maxDistance = 20;
    controls.update();

    // ── Build world ──
    updateLoader(15, 'Pouring concrete...');
    clubGeometry = new ClubGeometry(scene);
    await clubGeometry.build();

    updateLoader(30, 'Rigging DJ booth...');
    djBooth = new DJBooth(scene);
    djBooth.build();

    updateLoader(42, 'Hanging lights...');
    lightingSystem = new LightingSystem(scene);
    lightingSystem.build();

    updateLoader(60, 'Filling haze machine...');
    atmosphere = new AtmosphereSystem(scene);
    atmosphere.build();

    updateLoader(72, 'Warming up audio...');
    audioEngine = new AudioEngine();

    updateLoader(78, 'Patching VJ feeds...');
    vjVisuals = new VJVisuals(scene);
    vjVisuals.build();

    updateLoader(86, 'Post-processing...');

    // ── Post-processing ──
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.1,    // strength — makes beams and lasers glow properly
        0.35,   // radius
        0.6     // threshold — catch beams + bright fixtures
    );
    composer.addPass(bloomPass);

    // Film grain — subtle industrial texture
    const filmPass = new FilmPass(0.15);
    composer.addPass(filmPass);

    // OutputPass — ensures correct color space in post-processing chain
    composer.addPass(new OutputPass());

    updateLoader(92, 'Checking headset...');
    xrManager = new WebXRManager(renderer, scene, camera);
    await xrManager.init();

    updateLoader(96, 'Sound check...');
    ui = new UIController(state, audioEngine, lightingSystem, vjVisuals, atmosphere, xrManager);
    ui.init();

    updateLoader(100, 'Welcome to OPUS 46');
    setTimeout(() => {
        loadingScreen.classList.add('fade-out');
        document.getElementById('ui-overlay').style.display = '';
        setTimeout(() => { loadingScreen.style.display = 'none'; }, 800);
    }, 600);

    window.addEventListener('resize', onResize);
    renderer.setAnimationLoop(animate);
}

function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
}

// ── Render Loop ──
function animate() {
    deltaTime = clock.getDelta();
    elapsedTime = clock.getElapsedTime();

    // Beat clock
    const beatInterval = 60 / state.bpm;
    state.beatPhase = (elapsedTime % beatInterval) / beatInterval;

    // Audio analysis
    if (audioEngine?.isPlaying) {
        state.audioData = audioEngine.getFrequencyData();
        state.bass  = audioEngine.getBass();
        state.mids  = audioEngine.getMids();
        state.highs = audioEngine.getHighs();

        // Real beat detection from audio
        audioEngine.detectBeat(deltaTime);
        state.isBeat = audioEngine.isBeatDetected;
        state.audioEnergy = audioEngine.energy;
    } else {
        // Simulated audio for visuals when no audio is loaded
        state.bass  = 0.3 + 0.3 * Math.sin(elapsedTime * 1.8);
        state.mids  = 0.25 + 0.2 * Math.sin(elapsedTime * 2.4 + 1);
        state.highs = 0.15 + 0.15 * Math.sin(elapsedTime * 3.2 + 2);

        // Fallback to timer-based beat when no audio
        state.isBeat = state.beatPhase < 0.07;
        state.audioEnergy = 0.35;
    }

    // Update all systems
    lightingSystem?.update(elapsedTime, deltaTime, state);
    djBooth?.update(elapsedTime, deltaTime, state);
    vjVisuals?.update(elapsedTime, deltaTime, state);
    atmosphere?.update(elapsedTime, deltaTime, state);
    xrManager?.update(state);

    // Fog — bass-reactive density for immersion
    const bassFogBoost = (state.bass || 0.3) * 0.006;
    scene.fog.density = 0.018 + state.fogDensity * 0.018 + bassFogBoost;

    if (!xrManager?.isPresenting) {
        controls.update();
        composer.render();
    } else {
        renderer.render(scene, camera);
    }
}

init().catch(err => {
    console.error('Failed to initialize OPUS 46:', err);
    updateLoader(0, `Error: ${err.message}`);
});
