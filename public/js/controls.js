// ================== ĐIỀU KHIỂN ==================
const keys = { l: false, r: false, u: false, d: false };
const KEYMAP = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', Space: 'u', ArrowDown: 'd', KeyS: 'd' };
// cú đánh: 1 = đánh thường, 2 = bỏ nhỏ, 3 = nhảy đập
const SHOTMAP = { KeyJ: 1, KeyZ: 1, KeyK: 2, KeyX: 2, KeyL: 3, KeyC: 3 };
function sendInput(shot) { send({ t: 'in', ...keys, s: shot || 0 }); }
function inGame() { return $('game').style.display === 'block'; }

// ---- giao cầu: Click = giao gần, Ctrl+Click = phông xa (phím Z / X, cảm ứng 🏸 / 🪶), giữ lâu để tăng lực ----
const CHARGE_MS = 1000;   // giữ 1 giây = lực tối đa
let charge = null;        // { kind: 'short' | 'long', t0 }
const iHold = () => snap && snap.hold >= 0 && snap.p[snap.hold] && snap.p[snap.hold][5] === myId;   // mình đang cầm cầu chờ giao
const chargePower = () => Math.min(1, (performance.now() - charge.t0) / CHARGE_MS);
function startCharge(kind) { if (iHold() && !charge) { charge = { kind, t0: performance.now() }; SFX.charge(0); } return !!charge; }
function releaseCharge() {
  if (!charge) return false;
  if (iHold()) send({ t: 'srv', k: charge.kind, p: +chargePower().toFixed(2) });
  charge = null; SFX.charge(null);
  return true;
}
addEventListener('keydown', e => {
  if (!inGame() || e.target.tagName === 'INPUT') return;
  const shot = SHOTMAP[e.code];
  if ((e.code === 'KeyZ' || e.code === 'KeyX') && !e.repeat && startCharge(e.code === 'KeyZ' ? 'short' : 'long')) return e.preventDefault();
  if (shot) { e.preventDefault(); if (!e.repeat) sendInput(shot); return; }
  const k = KEYMAP[e.code]; if (!k) return;
  e.preventDefault();
  if (!keys[k]) { keys[k] = true; sendInput(false); }
});
addEventListener('keyup', e => {
  if ((e.code === 'KeyZ' || e.code === 'KeyX') && releaseCharge()) return;
  const k = KEYMAP[e.code]; if (!k) return;
  keys[k] = false; sendInput(false);
});
document.querySelectorAll('.touch button').forEach(b => {
  const k = b.dataset.k, shot = +b.dataset.s;
  b.addEventListener('pointerdown', e => {
    e.preventDefault();
    if ((shot === 1 || shot === 2) && startCharge(shot === 1 ? 'short' : 'long')) return;   // 🏸 giao gần · 🪶 phông xa
    if (shot) sendInput(shot); else { keys[k] = true; sendInput(); }
  });
  const up = () => { if (releaseCharge()) return; if (!shot) { keys[k] = false; sendInput(); } };
  b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
});
// chuột trên sân: click = đánh, Ctrl+Click = bỏ nhỏ, chuột phải = nhảy (lúc giao cầu: click = giao gần, Ctrl+Click = phông xa, giữ để căn lực)
const cvEl = $('cv');
cvEl.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse') return;
  e.preventDefault();
  if (e.button === 0 && startCharge(e.ctrlKey || e.metaKey ? 'long' : 'short')) return;
  if (e.button === 0) sendInput(e.ctrlKey || e.metaKey ? 2 : 1);
  else if (e.button === 2) { keys.u = true; sendInput(); }
});
cvEl.addEventListener('pointerup', e => {
  if (e.pointerType === 'mouse' && e.button === 0) releaseCharge();
  if (e.pointerType === 'mouse' && e.button === 2) { keys.u = false; sendInput(); }
});
addEventListener('pointerup', () => releaseCharge());   // nhả chuột ngoài sân cũng giao
cvEl.addEventListener('contextmenu', e => e.preventDefault());
