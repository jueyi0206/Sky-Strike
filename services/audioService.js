class AudioService {
  constructor() {
    this.ctx = null;
    this.bgmGain = null;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
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
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playExplosion(isBoss = false) {
    this.init();
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * (isBoss ? 1.0 : 0.2);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + (isBoss ? 1.0 : 0.2));
    noise.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  }

  playStageClear() {
    this.init();
    if (!this.ctx) return;
    [523, 659, 783].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime + i * 0.1);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + i * 0.1);
      osc.stop(this.ctx.currentTime + i * 0.1 + 0.2);
    });
  }

  playVictory() {
    this.init();
    if (!this.ctx) return;
    const mel = [523, 523, 659, 783, 1046];
    mel.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.1, this.ctx.currentTime + i * 0.2);
      osc.connect(g); g.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + i * 0.2);
      osc.stop(this.ctx.currentTime + i * 0.2 + 0.3);
    });
  }

  startBGM() {
    this.init();
    if (!this.ctx) return;
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.05;
    this.bgmGain.connect(this.ctx.destination);
    const interval = setInterval(() => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.frequency.value = 60 + Math.sin(Date.now() / 1000) * 10;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.05, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
      osc.connect(g); g.connect(this.bgmGain);
      osc.start(); osc.stop(this.ctx.currentTime + 0.6);
    }, 600);
    return () => { clearInterval(interval); if (this.bgmGain) this.bgmGain.disconnect(); };
  }
}

export const audio = new AudioService();