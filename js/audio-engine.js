/**
 * STARK ML LAB · Motor de Audio Dual (Narración MP3 + Analizador FFT + SFX Web Audio)
 * Diseñado para compatibilidad garantizada en Meta Quest 3 Browser (2D y WebXR Inmersivo)
 * y despliegue estático en GitHub Pages.
 */

export class StarkAudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.freqData = null;
    this.mediaSourceConnected = false;

    this.sfxEnabled = true;
    this.voiceEnabled = true;
    this.isPlaying = false;
    this.currentAudioFile = null;

    this.voiceAudio = new Audio();
    this.voiceAudio.preload = "auto";

    this.onStateChange = null;
    this.onProgress = null;
    this.onEnded = null;

    this._bindAudioEvents();
  }

  _bindAudioEvents() {
    this.voiceAudio.addEventListener("play", () => {
      this.isPlaying = true;
      this.onStateChange?.({ isPlaying: true, currentTime: this.voiceAudio.currentTime, duration: this.voiceAudio.duration || 0 });
    });

    this.voiceAudio.addEventListener("pause", () => {
      this.isPlaying = false;
      this.onStateChange?.({ isPlaying: false, currentTime: this.voiceAudio.currentTime, duration: this.voiceAudio.duration || 0 });
    });

    this.voiceAudio.addEventListener("ended", () => {
      this.isPlaying = false;
      this.onStateChange?.({ isPlaying: false, currentTime: this.voiceAudio.duration || 0, duration: this.voiceAudio.duration || 0 });
      this.onEnded?.();
    });

    this.voiceAudio.addEventListener("timeupdate", () => {
      this.onProgress?.({
        currentTime: this.voiceAudio.currentTime || 0,
        duration: this.voiceAudio.duration || 0
      });
    });

    this.voiceAudio.addEventListener("error", () => {
      this.isPlaying = false;
      this.onStateChange?.({ isPlaying: false, error: true });
    });
  }

  unlockContext() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume();
      }
      // Conectar AnalyserNode sobre HTTPS / localhost para visualizar onda de voz J.A.R.V.I.S. en 3D
      if (
        this.ctx &&
        !this.mediaSourceConnected &&
        location.protocol !== "file:"
      ) {
        try {
          const src = this.ctx.createMediaElementSource(this.voiceAudio);
          this.analyser = this.ctx.createAnalyser();
          this.analyser.fftSize = 64;
          this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
          src.connect(this.analyser);
          this.analyser.connect(this.ctx.destination);
          this.mediaSourceConnected = true;
        } catch (err) {
          // Fallback directo sin MediaElementSource si algún entorno lo restringe
        }
      }
    } catch (e) {}
  }

  async playStageNarration(audioFile, forcePlay = true) {
    this.stopSpeechSynthesis();
    this.currentAudioFile = audioFile;

    if (!this.voiceEnabled && !forcePlay) return;

    this.unlockContext();
    try {
      this.voiceAudio.pause();
      this.voiceAudio.src = audioFile;
      this.voiceAudio.currentTime = 0;
      if (forcePlay && this.voiceEnabled) {
        await this.voiceAudio.play();
      }
    } catch (err) {
      // Autoplay bloqueado antes de interacción del usuario; queda listo para botón Play
      this.isPlaying = false;
      this.onStateChange?.({ isPlaying: false, blocked: true });
    }
  }

  async togglePlayPause() {
    this.stopSpeechSynthesis();
    this.unlockContext();

    if (this.isPlaying) {
      this.voiceAudio.pause();
      return false;
    }

    if (!this.voiceAudio.src && this.currentAudioFile) {
      this.voiceAudio.src = this.currentAudioFile;
    }
    try {
      if (this.voiceAudio.ended) this.voiceAudio.currentTime = 0;
      await this.voiceAudio.play();
      this.voiceEnabled = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  pauseVoice() {
    if (!this.voiceAudio.paused) {
      this.voiceAudio.pause();
    }
    this.stopSpeechSynthesis();
  }

  toggleVoiceMute() {
    this.voiceEnabled = !this.voiceEnabled;
    if (!this.voiceEnabled) {
      this.pauseVoice();
    } else if (this.currentAudioFile) {
      this.playStageNarration(this.currentAudioFile, true);
    }
    return this.voiceEnabled;
  }

  toggleSfx() {
    this.sfxEnabled = !this.sfxEnabled;
    if (this.sfxEnabled) this.playNodeSelect();
    return this.sfxEnabled;
  }

  /**
   * Devuelve la energía vocal normalizada [0..1] para animar el Reactor Arc y la onda HUD.
   */
  getVoiceEnergy(timeSec = 0) {
    if (!this.isPlaying) return 0;
    if (this.analyser && this.freqData) {
      this.analyser.getByteFrequencyData(this.freqData);
      let sum = 0;
      const len = Math.min(16, this.freqData.length);
      for (let i = 0; i < len; i++) sum += this.freqData[i];
      return Math.min(1, sum / (len * 180));
    }
    return 0.35 + 0.3 * Math.abs(Math.sin(timeSec * 9.5) * Math.cos(timeSec * 4.2));
  }

  getSpectrumBars(count = 16, timeSec = 0) {
    const bars = new Array(count).fill(0.08);
    if (!this.isPlaying) return bars;
    if (this.analyser && this.freqData) {
      for (let i = 0; i < count; i++) {
        const idx = Math.min(this.freqData.length - 1, Math.floor((i / count) * 20));
        bars[i] = Math.max(0.08, Math.min(1, this.freqData[idx] / 210));
      }
      return bars;
    }
    for (let i = 0; i < count; i++) {
      bars[i] = Math.max(
        0.1,
        Math.min(0.95, 0.25 + 0.55 * Math.abs(Math.sin(timeSec * 7 + i * 0.65)))
      );
    }
    return bars;
  }

  // ========================================================================
  // EFECTOS DE SONIDO SINTETIZADOS WEB AUDIO API (STARK SFX)
  // ========================================================================

  _tone(freqStart, freqEnd, dur = 0.08, type = "sine", vol = 0.05, delay = 0) {
    if (!this.sfxEnabled) return;
    try {
      this.unlockContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(40, freqStart), now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + dur);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.015);
    } catch (e) {}
  }

  playBootChord() {
    this._tone(220, 440, 0.28, "sine", 0.05, 0);
    this._tone(330, 660, 0.32, "triangle", 0.04, 0.06);
    this._tone(554, 1108, 0.35, "sine", 0.035, 0.14);
  }

  playNodeSelect() {
    this._tone(880, 1420, 0.06, "sine", 0.045, 0);
    this._tone(1320, 1760, 0.07, "triangle", 0.03, 0.035);
  }

  playLaserPing(gainRatio = 0.5) {
    const base = 320 + Math.max(0, Math.min(1, gainRatio)) * 620;
    this._tone(base, base * 1.15, 0.045, "sine", 0.025, 0);
  }

  playBranchStep(goLeft = true) {
    if (goLeft) {
      this._tone(640, 960, 0.09, "triangle", 0.05, 0);
    } else {
      this._tone(460, 320, 0.09, "triangle", 0.05, 0);
    }
  }

  playLeafChime(isPure = true) {
    if (isPure) {
      this._tone(784, 1046, 0.14, "sine", 0.05, 0);
      this._tone(1046, 1568, 0.22, "sine", 0.045, 0.08);
    } else {
      this._tone(523, 659, 0.16, "triangle", 0.045, 0);
    }
  }

  playOverfitAlert() {
    this._tone(240, 180, 0.12, "sawtooth", 0.028, 0);
    this._tone(240, 170, 0.12, "sawtooth", 0.028, 0.15);
  }

  // ========================================================================
  // FALLBACK / LECTURA DINÁMICA DE NODOS Y PREDICCIONES PERSONALIZADAS
  // ========================================================================

  speakDynamic(text) {
    if (!("speechSynthesis" in window)) return false;
    try {
      this.pauseVoice();
      const utter = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices() || [];
      const esVoice =
        voices.find((v) => v.lang.toLowerCase().startsWith("es-mx")) ||
        voices.find((v) => v.lang.toLowerCase().startsWith("es"));
      if (esVoice) utter.voice = esVoice;
      utter.lang = esVoice ? esVoice.lang : "es-MX";
      utter.rate = 1.04;
      utter.pitch = 0.94;
      window.speechSynthesis.speak(utter);
      return true;
    } catch (e) {
      return false;
    }
  }

  stopSpeechSynthesis() {
    try {
      if ("speechSynthesis" in window && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    } catch (e) {}
  }
}
