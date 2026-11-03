// ================== VẼ ==================
const cv = $('cv');
let ctx = cv.getContext('2d');
const W = 1000, H = 500, FLOOR = 440, NET_X = 500, NET_TOP = 300, IN_MIN = 30, IN_MAX = 970;
const smooth = { p: [], s: null };

function draw() {
  requestAnimationFrame(draw);
  if (!inGame() && phase !== 'title') return;
  drawCourt(view ? view.venue : 'arena');
  if (!snap) return;

  // làm mượt vị trí
  snap.p.forEach((q, i) => {
    const sp = smooth.p[i] || (smooth.p[i] = { x: q[0], y: q[1] });
    sp.x += (q[0] - sp.x) * 0.5; sp.y += (q[1] - sp.y) * 0.5;
  });
  smooth.p.length = snap.p.length;
  // thông tin cố định (ngoại hình, trang phục) lấy từ danh sách ghế: thứ tự người chơi = thứ tự ghế
  const seats = view ? view.slots.flat() : [];
  snap.p.forEach((q, i) => {
    const s = seats[i] || {};
    drawPlayer(smooth.p[i].x, smooth.p[i].y, { team: q[2], sw: q[3], name: q[4], me: q[5] === myId, energy: q[6], look: s.look, gender: s.gender, outfit: s.outfit });
  });
  if (snap.s) drawShuttle(...snap.s);
  if (snap.wind) drawWind(snap.wind);
  drawStaminaPopups();
  drawServeUI();

  // thông báo
  ctx.textAlign = 'center';
  if (snap.msg) {
    ctx.font = 'bold 30px system-ui'; ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(W / 2 - 260, 80, 520, 50);
    ctx.fillStyle = snap.state === 'over' ? '#ffd84a' : '#fff';
    ctx.fillText(snap.msg, W / 2, 116);
  }
  if (snap.state === 'over' && phase !== 'title') {
    ctx.font = '18px system-ui'; ctx.fillStyle = '#fff';
    ctx.fillText(cup ? cupOverText() : room && room.host === myId ? 'Bấm "Chơi lại" để đấu tiếp' : 'Chờ chủ phòng bấm "Chơi lại"', W / 2, 160);
  }
}

// o = { team, sw, name, me, look, gender, energy, outfit }
function drawPlayer(x, y, o) {
  const { team = 0, sw = 0, name = '', me = false, look, gender, energy } = o;
  const f = team === 0 ? 1 : -1, col = team === 0 ? '#3d8bff' : '#ff5a5a';
  const [hair, skin] = look || DEFAULT_LOOK, girl = gender === 'f';
  const of = o.outfit || defaultOutfit(gender, col), c1 = of.c1, c2 = of.c2;
  // bóng
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x, FLOOR + 4, 22, 5, 0, 0, Math.PI * 2); ctx.fill();
  // chân + giày
  ctx.strokeStyle = skin; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 7, y - 3); ctx.lineTo(x - 4, y - 38); ctx.moveTo(x + 7, y - 3); ctx.lineTo(x + 4, y - 38); ctx.stroke();
  ctx.fillStyle = '#f4f4f4';
  ctx.beginPath(); ctx.ellipse(x - 7 + f * 2, y - 2, 6, 3.5, 0, 0, Math.PI * 2); ctx.ellipse(x + 7 + f * 2, y - 2, 6, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  // trang phục
  const skirt = (top, bottom, w, fill) => {
    ctx.fillStyle = fill; ctx.beginPath();
    ctx.moveTo(x - 12, top); ctx.lineTo(x + 12, top); ctx.lineTo(x + w, bottom); ctx.lineTo(x - w, bottom); ctx.closePath(); ctx.fill();
  };
  ctx.fillStyle = c1;
  if (of.s === 'tank') { ctx.beginPath(); ctx.roundRect(x - 12, y - 80, 24, 38, 6); ctx.fill(); }
  else if (girl || of.s === 'skirt' || of.s === 'dress') { ctx.beginPath(); ctx.roundRect(x - 12, y - 82, 24, 38, 8); ctx.fill(); }
  else { ctx.beginPath(); ctx.roundRect(x - 14, y - 82, 28, 40, 8); ctx.fill(); }
  if (of.s === 'skirt') skirt(y - 46, y - 30, 18, c2);
  else if (of.s === 'dress') { skirt(y - 48, y - 26, 20, c1); ctx.fillStyle = c2; ctx.fillRect(x - 12, y - 49, 24, 3); }
  else { ctx.fillStyle = c2; ctx.beginPath(); ctx.roundRect(x - 13, y - 46, 26, 14, 3); ctx.fill(); }   // quần short
  if (of.s === 'polo') {   // cổ áo
    ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(x - 7, y - 82); ctx.lineTo(x + 7, y - 82); ctx.lineTo(x, y - 73); ctx.closePath(); ctx.fill();
  }
  // đầu
  if (girl) {   // tóc đuôi ngựa phía sau gáy
    ctx.fillStyle = hair; ctx.beginPath(); ctx.ellipse(x - f * 15, y - 92, 6, 11, f * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x, y - 96, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(x, y - 100, 13, Math.PI, 0); ctx.fill();
  if (girl) { ctx.fillStyle = '#fff'; ctx.fillRect(x - 13, y - 104, 26, 3); }   // băng đô
  // tay + vợt: khi vung (sw 1 -> 0) tay quay từ sau ra trước
  const sx = x + f * 8, sy = y - 74;
  let ang = -1.2;                                // góc nghỉ (giơ vợt lên)
  if (sw > 0) ang = -2.6 + (1 - sw) * 3.2;        // vung
  const ax = sx + f * Math.cos(ang) * 30, ay = sy + Math.sin(ang) * 30;
  ctx.strokeStyle = skin; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ax, ay); ctx.stroke();
  if (of.s !== 'tank' && of.s !== 'dress') {   // tay áo ngắn
    ctx.strokeStyle = c1; ctx.lineWidth = 9; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + f * Math.cos(ang) * 9, sy + Math.sin(ang) * 9); ctx.stroke();
    ctx.lineCap = 'round';
  }
  const hx = ax + f * Math.cos(ang) * 30, hy = ay + Math.sin(ang) * 30;
  ctx.strokeStyle = '#555'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.save(); ctx.translate(hx + f * Math.cos(ang) * 12, hy + Math.sin(ang) * 12); ctx.rotate(f * ang);
  ctx.strokeStyle = '#eee'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  // tên
  ctx.textAlign = 'center'; ctx.font = (me ? 'bold ' : '') + '14px system-ui';
  ctx.fillStyle = me ? '#ffd84a' : team === 0 ? '#bcd6ff' : '#ffc2c2';   // tên theo màu đội
  ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 3; ctx.lineJoin = 'round';   // viền tối để đọc được trên mọi nền sân
  ctx.strokeText((me ? '▼ ' : '') + name, x, y - 125);
  ctx.fillText((me ? '▼ ' : '') + name, x, y - 125);
  // thanh thể lực (kiệt sức: nhấp nháy đỏ)
  if (energy != null) {
    const ex = energy <= EXHAUSTED, blink = ex && Math.floor(performance.now() / 250) % 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 21, y - 123, 42, 6);
    ctx.fillStyle = blink ? '#fff' : staminaColor(energy);
    ctx.fillRect(x - 21, y - 123, Math.max(2, 42 * energy / 100), 6);
  }
}
const EXHAUSTED = 12;   // khớp STAMINA.exhausted bên server (%)
const staminaColor = e => e > 60 ? '#35c46b' : e > 30 ? '#ffd84a' : '#ff5a5a';

// nền + sàn + lưới của từng sân
function drawCourt(venue) {
  const bg = (top, bot) => { const g = ctx.createLinearGradient(0, 0, 0, FLOOR); g.addColorStop(0, top); g.addColorStop(1, bot); ctx.fillStyle = g; ctx.fillRect(0, 0, W, FLOOR); };
  let floor = '#2e8b57', outside = '#26734a', line = '#fff';
  if (venue === 'wood') {
    bg('#3b2616', '#7a5232');
    ctx.fillStyle = 'rgba(255,220,150,0.08)';
    for (let i = 0; i < 5; i++) ctx.fillRect(40 + i * 200, 60, 120, 70);          // cửa sổ
    ctx.fillStyle = '#5a3b22'; ctx.fillRect(0, FLOOR - 40, W, 40);                 // ốp tường gỗ
    floor = '#c8894a'; outside = '#a86f3a';
  } else if (venue === 'neon') {
    bg('#07021a', '#26104a');
    ctx.strokeStyle = 'rgba(255,60,200,0.35)'; ctx.lineWidth = 2;
    for (let x = 0; x <= W; x += 50) { ctx.beginPath(); ctx.moveTo(x, FLOOR - 150); ctx.lineTo(W / 2 + (x - W / 2) * 0.3, FLOOR - 300); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,229,255,0.7)';
    for (let i = 0; i < 6; i++) ctx.fillRect(60 + i * 160, 26, 90, 6);
    floor = '#141a3a'; outside = '#0b0f26'; line = '#00e5ff';
  } else if (venue === 'park') {
    bg('#6fbef0', '#d4f0fc');
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [cx, cy, r] of [[150, 80, 26], [190, 70, 32], [230, 84, 22], [720, 110, 24], [760, 98, 30], [800, 112, 20]]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#4c9a46'; ctx.fillRect(0, FLOOR - 32, W, 32);   // bãi cỏ
    ctx.fillStyle = '#3b7d3f';
    for (let x = -20; x < W + 40; x += 70) { ctx.beginPath(); ctx.arc(x, FLOOR - 30, 50 + (x * 7 % 23), Math.PI, 0); ctx.fill(); }   // hàng cây
    floor = '#2f7fbf'; outside = '#4c9a46';
  } else {
    bg('#1d2f52', '#3a5684');
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 6; i++) ctx.fillRect(60 + i * 160, 30, 90, 12);           // đèn trần
  }
  // sàn
  ctx.fillStyle = floor; ctx.fillRect(0, FLOOR, W, H - FLOOR);
  ctx.fillStyle = outside; ctx.fillRect(0, FLOOR, IN_MIN, H - FLOOR); ctx.fillRect(IN_MAX, FLOOR, W - IN_MAX, H - FLOOR);
  if (venue === 'wood') { ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, FLOOR); ctx.lineTo(x, H); ctx.stroke(); } }
  ctx.strokeStyle = line; ctx.lineWidth = 3;
  if (venue === 'neon') { ctx.shadowColor = line; ctx.shadowBlur = 10; }
  ctx.beginPath(); ctx.moveTo(IN_MIN, FLOOR); ctx.lineTo(IN_MIN, FLOOR + 14); ctx.moveTo(IN_MAX, FLOOR); ctx.lineTo(IN_MAX, FLOOR + 14);
  ctx.moveTo(0, FLOOR); ctx.lineTo(W, FLOOR); ctx.stroke();
  ctx.shadowBlur = 0;
  // lưới
  ctx.fillStyle = '#ddd'; ctx.fillRect(NET_X - 3, NET_TOP, 6, FLOOR - NET_TOP);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
  for (let y = NET_TOP + 8; y < NET_TOP + 70; y += 8) { ctx.beginPath(); ctx.moveTo(NET_X - 9, y); ctx.lineTo(NET_X + 9, y); ctx.stroke(); }
  ctx.fillStyle = '#fff'; ctx.fillRect(NET_X - 10, NET_TOP - 4, 20, 6);
}

// mũi tên chỉ hướng & sức gió (sân ngoài trời)
function drawWind(w) {
  const len = 20 + Math.abs(w) * 0.8, d = Math.sign(w);
  ctx.save(); ctx.translate(W / 2, 40);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(-90, -16, 180, 32, 16); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-d * len / 2, 0); ctx.lineTo(d * len / 2, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(d * (len / 2 + 8), 0); ctx.lineTo(d * len / 2 - d * 4, -8); ctx.lineTo(d * len / 2 - d * 4, 8); ctx.closePath(); ctx.fill();
  ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center';
  ctx.fillText('GIÓ ' + Math.round(Math.abs(w) / 7), -d * 62 || -62, 5);
  ctx.restore();
}

function drawShuttle(x, y, vx, vy) {
  // bóng cầu dưới sàn
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(x, FLOOR + 3, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
  // cầu luôn bay đầu (núm) đi trước, lông phía sau
  const a = (vx || vy) ? Math.atan2(vy, vx) : Math.PI / 2;
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(-2, -3); ctx.lineTo(-18, -9); ctx.lineTo(-18, 9); ctx.lineTo(-2, 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d33'; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ================== NGOẠI HÌNH NGƯỜI CHƠI ==================
const DEFAULT_LOOK = ['#222222', '#f2c79c'];
const HAIRS = ['#222222', '#6b3e1f', '#c98a3c', '#e8d27a', '#d9d9d9', '#e0457b', '#3d8bff'];
const SKINS = ['#f2c79c', '#e0ac7e', '#b97d52', '#7a4e30'];
let look = DEFAULT_LOOK;
try { const l = JSON.parse(localStorage.getItem('cl_look')); if (Array.isArray(l) && l.length === 2) look = l; } catch {}

function makeSwatches(box, colors, k) {
  for (const c of colors) {
    const b = document.createElement('button');
    b.style.background = c; b.title = c;
    b.classList.toggle('on', look[k] === c);
    b.onclick = () => {
      look = look.slice(); look[k] = c;
      box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      localStorage.setItem('cl_look', JSON.stringify(look));
      nameBox.onchange();
    };
    box.appendChild(b);
  }
}
makeSwatches($('swHair'), HAIRS, 0);
makeSwatches($('swSkin'), SKINS, 1);
nameBox.oninput = drawPreview;

function drawPreview() {
  const pv = $('pview'), main = ctx;
  ctx = pv.getContext('2d');
  ctx.clearRect(0, 0, pv.width, pv.height);
  ctx.save();
  ctx.translate(pv.width / 2 - 12, pv.height - 14 - FLOOR * 1.25);
  ctx.scale(1.25, 1.25);
  drawPlayer(0, FLOOR, { name: nameBox.value, me: true, look, gender: myGender(), outfit: myOutfit() });
  ctx.restore();
  ctx = main;
  drawHero();
}
