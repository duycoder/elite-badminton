// ================== ÂM THANH (Web Audio tổng hợp — không cần file) ==================
// trình duyệt chỉ cho phát tiếng sau lần bấm/chạm đầu tiên -> tạo AudioContext lúc đó
const SFX = (() => {
  let ac = null, out = null, noise = null, amb = null, hum = null;
  let on = localStorage.getItem('cl_snd') !== '0';
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    out = ac.createGain(); out.gain.value = on ? 0.7 : 0;
    out.connect(ac.createDynamicsCompressor()).connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  addEventListener('pointerdown', init, true);
  addEventListener('keydown', init, true);
  const ok = () => ac && ac.state === 'running' && on;

  // x (0..1000 trên sân) -> lệch loa trái/phải
  function bus(vol, x) {
    const g = ac.createGain(); g.gain.value = vol;
    if (x != null && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, (x / 500 - 1) * 0.7)); g.connect(p).connect(out); }
    else g.connect(out);
    return g;
  }
  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function burst(dst, t, { type = 'bandpass', f = 2000, q = 1, peak = 1, a = 0.002, dec = 0.08, f2 } = {}) {
    const src = ac.createBufferSource(); src.buffer = noise;
    const flt = ac.createBiquadFilter(); flt.type = type; flt.Q.value = q;
    flt.frequency.setValueAtTime(f, t); if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t + a + dec);
    const g = ac.createGain(); env(g, t, a, peak, dec);
    src.connect(flt).connect(g).connect(dst);
    src.start(t, Math.random() * 1.5); src.stop(t + a + dec + 0.05);
  }
  function tone(dst, t, { type = 'sine', f = 440, f2, peak = 0.5, a = 0.005, dec = 0.1 } = {}) {
    const o = ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + dec);
    const g = ac.createGain(); env(g, t, a, peak, dec);
    o.connect(g).connect(dst); o.start(t); o.stop(t + a + dec + 0.05);
    return o;
  }
  // khán giả reo: nhiễu lọc ở dải giọng người + tiếng vỗ tay lách tách
  function cheer(dst, t, big) {
    const len = big ? 2.6 : 1.4;
    for (const [f, q] of [[500, 1.2], [1100, 1.5], [2200, 2]]) burst(dst, t, { f, q, peak: big ? 0.5 : 0.3, a: 0.25, dec: len, f2: f * 0.8 });
    for (let i = 0; i < (big ? 70 : 35); i++) burst(dst, t + 0.1 + Math.random() * len * 0.9, { type: 'highpass', f: 1500 + Math.random() * 2500, q: 0.7, peak: 0.12 + Math.random() * 0.12, dec: 0.03 });
  }

  const S = {
    // đánh cầu: tiếng "chát" của dây vợt + tiếng thịch nhẹ của khung
    clear(x, k = 1) { const t = ac.currentTime, b = bus(0.8 * k, x); burst(b, t, { f: 2600, q: 1.4, peak: 1, dec: 0.07 }); tone(b, t, { f: 320, f2: 160, peak: 0.35, dec: 0.06 }); },
    drop(x, k = 1) { const t = ac.currentTime, b = bus(0.4 * k, x); burst(b, t, { f: 3400, q: 2, peak: 0.8, dec: 0.04 }); },
    smash(x, k = 1) {   // đập: to, gắt, kèm tiếng rít của cầu bay — đập càng mạnh càng to
      const t = ac.currentTime, b = bus(0.75 + 0.35 * k, x);
      burst(b, t, { f: 1800, q: 0.8, peak: 1.2, dec: 0.1 });
      burst(b, t, { type: 'highpass', f: 5000, peak: 0.6, dec: 0.03 });
      tone(b, t, { type: 'triangle', f: 220, f2: 70, peak: 0.6, dec: 0.12 });
      burst(b, t + 0.02, { f: 4000, f2: 1400, q: 4, peak: 0.25, a: 0.02, dec: 0.25 });
    },
    serve(x, k = 0.5) { S.clear(x, 0.45 + 0.4 * k); },
    net(x, k = 0.5) { const t = ac.currentTime, b = bus(0.25 + 0.5 * k, x); for (let i = 0; i < 4; i++) burst(b, t + i * 0.035, { type: 'lowpass', f: 900, peak: 0.9 - i * 0.2, dec: 0.05 }); },
    land(x, inside) { const t = ac.currentTime, b = bus(inside ? 0.55 : 0.35, x); tone(b, t, { f: 120, f2: 55, peak: 0.8, dec: 0.12 }); burst(b, t, { type: 'lowpass', f: 700, peak: 0.4, dec: 0.06 }); },
    whistle() {
      const t = ac.currentTime, o = tone(bus(0.22), t, { f: 2900, peak: 0.6, a: 0.02, dec: 0.45 });
      const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 28; lg.gain.value = 90;
      lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(t + 0.5);
    },
    point(mine) { cheer(bus(mine ? 0.6 : 0.3), ac.currentTime, false); if (mine) S.ding(); },
    win(mine) {
      const t = ac.currentTime, b = bus(0.3);
      const notes = mine ? [523, 659, 784, 1047] : [440, 392, 349, 294];   // thắng: đi lên · thua: đi xuống
      notes.forEach((f, i) => tone(b, t + i * 0.14, { type: 'triangle', f, peak: 0.7, dec: i === 3 ? 0.9 : 0.2 }));
      if (mine) cheer(bus(0.7), t + 0.2, true);
    },
    ding() { const t = ac.currentTime, b = bus(0.12); tone(b, t, { type: 'triangle', f: 880, peak: 0.6, dec: 0.25 }); tone(b, t + 0.08, { type: 'triangle', f: 1320, peak: 0.5, dec: 0.3 }); },
    // menu
    tick() { tone(bus(0.08), ac.currentTime, { type: 'square', f: 1400, peak: 0.5, dec: 0.025 }); },
    ok() { const t = ac.currentTime, b = bus(0.13); tone(b, t, { type: 'triangle', f: 660, peak: 0.7, dec: 0.07 }); tone(b, t + 0.06, { type: 'triangle', f: 990, peak: 0.7, dec: 0.12 }); },
    back() { const t = ac.currentTime, b = bus(0.12); tone(b, t, { type: 'triangle', f: 700, peak: 0.6, dec: 0.06 }); tone(b, t + 0.05, { type: 'triangle', f: 470, peak: 0.6, dec: 0.1 }); },
    deny() { tone(bus(0.12), ac.currentTime, { type: 'sawtooth', f: 140, peak: 0.5, dec: 0.18 }); },
  };

  // tiếng ồn nền nhà thi đấu khi đang trong trận
  function ambience(want) {
    if (!ac || !!amb === (want && on)) return;
    if (amb) { const a = amb; amb = null; a.g.gain.setTargetAtTime(0, ac.currentTime, 0.3); setTimeout(() => a.src.stop(), 1500); return; }
    const src = ac.createBufferSource(); src.buffer = noise; src.loop = true;
    const flt = ac.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = 600; flt.Q.value = 0.6;
    const g = ac.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.035, ac.currentTime, 0.8);
    src.connect(flt).connect(g).connect(out); src.start();
    amb = { src, g };
  }
  // tiếng "u…" cao dần khi giữ để căn lực giao cầu (p = 0..1, null = tắt)
  function charge(p) {
    if (p == null) { if (hum) { hum.g.gain.setTargetAtTime(0, ac.currentTime, 0.02); hum.o.stop(ac.currentTime + 0.1); hum = null; } return; }
    if (!ok()) return;
    if (!hum) { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; g.gain.value = 0.04; o.connect(g).connect(out); o.start(); hum = { o, g }; }
    hum.o.frequency.setTargetAtTime(260 + p * 640, ac.currentTime, 0.02);
  }

  return {
    play(name, ...args) { if (ok() && S[name]) S[name](...args); },
    ambience(want) { if (ac) ambience(want); },
    charge(p) { if (ac) charge(p); },
    get on() { return on; },
    toggle() {
      on = !on; localStorage.setItem('cl_snd', on ? '1' : '0');
      sndBtn.textContent = on ? '🔊' : '🔇';
      if (!ac) return;
      out.gain.setTargetAtTime(on ? 0.7 : 0, ac.currentTime, 0.05);
      if (!on) { ambience(false); charge(null); }
      else ambience(inGame());
    },
  };
})();
const sndBtn = $('sndBtn');
sndBtn.textContent = SFX.on ? '🔊' : '🔇';
sndBtn.onclick = e => { e.stopPropagation(); SFX.toggle(); sndBtn.blur(); };
addEventListener('keydown', e => { if (e.code === 'KeyM' && e.target.tagName !== 'INPUT' && !e.repeat) SFX.toggle(); });
// phát các sự kiện server gửi kèm snapshot: [loại, x, cường độ] — vol: demo ở màn tiêu đề phát nhỏ hơn
function playFx(m, vol) {
  if (!m.fx || !m.fx.length) return;
  const me = m.p.find(p => p[5] === myId), myTeam = me ? me[2] : 0;
  for (const [type, x, k] of m.fx) {
    if (type === 'point' || type === 'win') { if (vol === 1) SFX.play(type, k === myTeam); }
    else if (type === 'land') SFX.play('land', x, k);
    else SFX.play(type, x, k * vol);
  }
}
