/**
 * UI Controller — Connects HTML controls to club systems
 */
export class UIController {
    constructor(state, audioEngine, lightingSystem, vjVisuals, atmosphere, xrManager) {
        this.state = state;
        this.audio = audioEngine;
        this.lighting = lightingSystem;
        this.vj = vjVisuals;
        this.atmosphere = atmosphere;
        this.xr = xrManager;
    }

    init() {
        this._bindControls();
        this._startClock();
    }

    _bindControls() {
        // Toggle controls drawer
        const btnToggle = document.getElementById('btn-toggle-controls');
        const drawer = document.getElementById('controls-drawer');
        btnToggle?.addEventListener('click', () => {
            drawer.classList.toggle('hidden');
        });

        // Master volume
        const volumeSlider = document.getElementById('master-volume');
        volumeSlider?.addEventListener('input', (e) => {
            this.state.masterVolume = parseFloat(e.target.value);
            this.audio.setVolume(this.state.masterVolume);
        });

        // BPM
        const bpmSlider = document.getElementById('bpm-slider');
        const bpmDisplay = document.getElementById('bpm-display');
        bpmSlider?.addEventListener('input', (e) => {
            this.state.bpm = parseInt(e.target.value);
            if (bpmDisplay) bpmDisplay.textContent = this.state.bpm;
        });

        // Lighting preset
        const presetSelect = document.getElementById('lighting-preset');
        presetSelect?.addEventListener('change', (e) => {
            this.state.lightingPreset = e.target.value;
            this.lighting.setPreset(e.target.value);
        });

        // Fog density
        const fogSlider = document.getElementById('fog-density');
        fogSlider?.addEventListener('input', (e) => {
            this.state.fogDensity = parseFloat(e.target.value);
        });

        // Visual mode
        const visualSelect = document.getElementById('visual-mode');
        visualSelect?.addEventListener('change', (e) => {
            this.state.visualMode = e.target.value;
            this.vj.setMode(e.target.value);
        });

        // DROP button
        const btnDrop = document.getElementById('btn-drop');
        btnDrop?.addEventListener('click', () => {
            this._triggerDrop();
        });

        // Audio file upload
        const audioInput = document.getElementById('audio-file');
        audioInput?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await this.audio.loadFile(file);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            switch (e.key.toLowerCase()) {
                case ' ':
                    e.preventDefault();
                    this._triggerDrop();
                    break;
                case '1': this.vj.setMode('wave'); break;
                case '2': this.vj.setMode('bars'); break;
                case '3': this.vj.setMode('tunnel'); break;
                case '4': this.vj.setMode('scope'); break;
                case '5': this.vj.setMode('strobe'); break;
                case '6': this.vj.setMode('grid'); break;
                case '7': this.vj.setMode('noise'); break;
                case 'q': this.lighting.setPreset('club'); break;
                case 'w': this.lighting.setPreset('rave'); break;
                case 'e': this.lighting.setPreset('chill'); break;
                case 'r': this.lighting.setPreset('strobe'); break;
                case 't': this.lighting.setPreset('laser'); break;
            }
        });
    }

    _triggerDrop() {
        this.state.dropActive = true;
        this.atmosphere.triggerSmokeJets();

        // Drop lasts 4 seconds
        setTimeout(() => {
            this.state.dropActive = false;
        }, 4000);
    }

    _startClock() {
        const clockEl = document.getElementById('clock');
        if (!clockEl) return;

        const updateClock = () => {
            const now = new Date();
            clockEl.textContent = now.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        };

        updateClock();
        setInterval(updateClock, 1000);
    }
}
