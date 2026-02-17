
class AudioService {
  private ctx: AudioContext | null = null;
  private bgmOsc: OscillatorNode | null = null;
  private bgmGain: GainNode | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playShoot() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playExplosion(isBoss: boolean = false) {
    this.init();
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * (isBoss ? 1.5 : 0.3);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isBoss ? 800 : 400, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + (isBoss ? 1.5 : 0.3));
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isBoss ? 0.6 : 0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + (isBoss ? 1.5 : 0.3));
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  }

  playPowerup() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playStageClear() {
    this.init();
    if (!this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + i * 0.15);
      gain.gain.setValueAtTime(0.1, this.ctx!.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + i * 0.15 + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(this.ctx!.currentTime + i * 0.15);
      osc.stop(this.ctx!.currentTime + i * 0.15 + 0.3);
    });
  }

  playVictory() {
    this.init();
    if (!this.ctx) return;
    const melody = [523, 523, 523, 523, 415, 466, 523, 466, 523];
    melody.forEach((f, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.1, this.ctx!.currentTime + i * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + i * 0.2 + 0.4);
        osc.connect(gain); gain.connect(this.ctx!.destination);
        osc.start(this.ctx!.currentTime + i * 0.2);
        osc.stop(this.ctx!.currentTime + i * 0.2 + 0.4);
    });
  }

  startBGM() {
    this.init();
    if (!this.ctx) return;
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    this.bgmGain.connect(this.ctx.destination);

    const playPulse = () => {
      if (!this.ctx || !this.bgmGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      const freq = [65, 65, 73, 55][Math.floor(Date.now() / 600) % 4];
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.05, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
      osc.connect(g);
      g.connect(this.bgmGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.6);
    };

    const interval = setInterval(playPulse, 600);
    return () => {
        clearInterval(interval);
        if (this.bgmGain) this.bgmGain.disconnect();
    };
  }
}

export const audio = new AudioService();
