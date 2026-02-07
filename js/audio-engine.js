/**
 * Audio Engine — Web Audio API, microphone or file input, frequency analysis
 */
export class AudioEngine {
    constructor() {
        this.context = null;
        this.analyser = null;
        this.source = null;
        this.gainNode = null;
        this.isPlaying = false;
        this.frequencyData = null;
        this.timeDomainData = null;
        this.fftSize = 256;

        // Beat detection state
        this._beatHistory = new Float32Array(64);   // rolling bass energy buffer
        this._beatHistIdx = 0;
        this._beatHoldTime = 0;          // cooldown after a detected beat
        this._beatHoldDuration = 0.12;   // min seconds between beats (~500 BPM cap)
        this._beatThreshold = 1.4;       // current bass must exceed avg by this factor
        this._isBeat = false;            // true for the frame a beat is detected
        this._beatEnergy = 0;            // smoothed overall energy (0-1)
        this._prevBass = 0;              // previous frame bass for derivative
    }

    _ensureContext() {
        if (!this.context) {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.context.createAnalyser();
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = 0.8;

            this.gainNode = this.context.createGain();
            this.gainNode.connect(this.context.destination);
            this.analyser.connect(this.gainNode);

            this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
            this.timeDomainData = new Uint8Array(this.analyser.frequencyBinCount);
        }
        if (this.context.state === 'suspended') {
            this.context.resume();
        }
    }

    async loadFile(file) {
        this._ensureContext();

        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }

        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

        this.source = this.context.createBufferSource();
        this.source.buffer = audioBuffer;
        this.source.loop = true;
        this.source.connect(this.analyser);
        this.source.start(0);
        this.isPlaying = true;
    }

    async useMicrophone() {
        this._ensureContext();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (this.source) {
                this.source.disconnect();
            }
            this.source = this.context.createMediaStreamSource(stream);
            this.source.connect(this.analyser);
            // Don't connect to destination to avoid feedback
            this.analyser.disconnect();
            this.isPlaying = true;
        } catch (err) {
            console.warn('Microphone access denied:', err);
        }
    }

    setVolume(vol) {
        if (this.gainNode) {
            this.gainNode.gain.setValueAtTime(vol, this.context.currentTime);
        }
    }

    getFrequencyData() {
        if (!this.analyser) return null;
        this.analyser.getByteFrequencyData(this.frequencyData);
        return this.frequencyData;
    }

    getTimeDomainData() {
        if (!this.analyser) return null;
        this.analyser.getByteTimeDomainData(this.timeDomainData);
        return this.timeDomainData;
    }

    getBass() {
        if (!this.frequencyData) return 0;
        let sum = 0;
        for (let i = 0; i < 8; i++) sum += this.frequencyData[i];
        return sum / (8 * 255);
    }

    getMids() {
        if (!this.frequencyData) return 0;
        let sum = 0;
        for (let i = 8; i < 40; i++) sum += this.frequencyData[i];
        return sum / (32 * 255);
    }

    getHighs() {
        if (!this.frequencyData) return 0;
        const len = this.frequencyData.length;
        let sum = 0;
        for (let i = 40; i < len; i++) sum += this.frequencyData[i];
        return sum / ((len - 40) * 255);
    }

    /**
     * Call once per frame after getFrequencyData().
     * Detects beats by comparing current bass energy to a rolling average.
     * @param {number} dt — delta time in seconds
     */
    detectBeat(dt) {
        const bass = this.getBass();
        const mids = this.getMids();
        const highs = this.getHighs();

        // Smoothed overall energy
        this._beatEnergy += ((bass * 0.6 + mids * 0.3 + highs * 0.1) - this._beatEnergy) * 0.12;

        // Store bass in rolling buffer
        this._beatHistory[this._beatHistIdx] = bass;
        this._beatHistIdx = (this._beatHistIdx + 1) % this._beatHistory.length;

        // Compute rolling average
        let sum = 0;
        for (let i = 0; i < this._beatHistory.length; i++) sum += this._beatHistory[i];
        const avg = sum / this._beatHistory.length;

        // Beat = bass exceeds rolling average by threshold AND bass is rising
        const derivative = bass - this._prevBass;
        this._prevBass = bass;

        this._beatHoldTime -= dt;
        if (bass > avg * this._beatThreshold && derivative > 0.02 && this._beatHoldTime <= 0 && bass > 0.15) {
            this._isBeat = true;
            this._beatHoldTime = this._beatHoldDuration;
        } else {
            this._isBeat = false;
        }

        return this._isBeat;
    }

    /** True only on the frame a beat onset is detected */
    get isBeatDetected() { return this._isBeat; }

    /** Smoothed overall audio energy (0-1) */
    get energy() { return this._beatEnergy; }

    dispose() {
        if (this.source) this.source.disconnect();
        if (this.context) this.context.close();
    }
}
