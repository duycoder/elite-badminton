// ================== THANH THỂ LỰC (HUD) ==================
// mỗi người một thanh: Đội Xanh bên trái, Đội Đỏ bên phải; mất sức đột ngột (đánh, nhảy, đập) thì hiện "-N" bay lên trên đầu
let stamKey = '', stamRows = [];
const prevEnergy = [], popups = [];
function updateStamina() {
  const off = snap.p.length && snap.p[0][6] == null;   // trận tắt thể lực
  document.querySelector('.stam').hidden = off;
  if (off) return;
  const key = snap.p.map(q => q[2] + q[4]).join('|');
  if (key !== stamKey) {   // đổi người chơi -> dựng lại các dòng
    stamKey = key; prevEnergy.length = 0;
    $('st0').replaceChildren(); $('st1').replaceChildren();
    stamRows = snap.p.map(q => {
      const row = el('div', 'st-row' + (q[5] === myId ? ' me' : ''), '<span class="nm"></span><div class="st-bar"><i></i><s></s></div><b></b>');
      row.querySelector('.nm').textContent = (q[5] === myId ? '▼ ' : '') + q[4];
      $('st' + q[2]).appendChild(row);
      return row;
    });
  }
  snap.p.forEach((q, i) => {
    const e = q[6], row = stamRows[i];
    const bar = row.querySelector('i');
    bar.style.width = e + '%'; bar.style.background = staminaColor(e);
    row.querySelector('s').style.width = (100 - (q[7] ?? 100)) + '%';   // phần trần đã mất (mệt tích luỹ)
    row.title = 'Thể lực ' + e + '% · tối đa còn ' + (q[7] ?? 100) + '%';
    row.querySelector('b').textContent = e <= EXHAUSTED ? 'KIỆT SỨC' : e + '%';
    row.classList.toggle('ex', e <= EXHAUSTED);
    const diff = prevEnergy[i] == null ? 0 : e - prevEnergy[i];
    if (diff <= -2) popups.push({ i, text: String(diff), col: '#ff6b6b', t0: performance.now() });
    else if (diff >= 2) popups.push({ i, text: '+' + diff, col: '#5be38a', t0: performance.now() });   // hồi sức sau mỗi điểm
    prevEnergy[i] = e;
  });
}
// trên đầu mình khi đang cầm cầu: gợi ý cách giao, hoặc thanh lực khi đang giữ
function drawServeUI() {
  if (!iHold()) { charge = null; return; }
  const sp = smooth.p[snap.hold]; if (!sp) return;
  const x = sp.x, y = sp.y - 165;
  ctx.textAlign = 'center';
  if (!charge) {
    ctx.font = 'bold 13px system-ui'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = '#fff';
    const tip = 'Click: giao gần · Ctrl+Click: phông xa · giữ để căn lực';
    ctx.strokeText(tip, x, y + 8); ctx.fillText(tip, x, y + 8);
    return;
  }
  const pw = chargePower(), w = 110;
  // vùng màu: giao gần yếu quá dễ chạm lưới, phông xa mạnh quá dễ ra ngoài
  const zones = charge.kind === 'short' ? [[0, 0.28, '#ff5a5a'], [0.28, 1, '#35c46b']] : [[0, 0.82, '#35c46b'], [0.82, 1, '#ff5a5a']];
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - w / 2 - 3, y - 3, w + 6, 16);
  for (const [a, b, c] of zones) { ctx.globalAlpha = 0.35; ctx.fillStyle = c; ctx.fillRect(x - w / 2 + a * w, y, (b - a) * w, 10); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = zones.find(([a, b]) => pw >= a && pw <= b)[2]; ctx.fillRect(x - w / 2, y, w * pw, 10);
  ctx.font = 'bold 13px system-ui'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = '#ffd84a';
  const label = (charge.kind === 'short' ? 'GIAO GẦN ' : 'PHÔNG XA ') + Math.round(pw * 100) + '%';
  ctx.strokeText(label, x, y - 6); ctx.fillText(label, x, y - 6);
}
function drawStaminaPopups() {
  const now = performance.now();
  for (let k = popups.length - 1; k >= 0; k--) {
    const p = popups[k], t = (now - p.t0) / 900, sp = smooth.p[p.i];
    if (t >= 1 || !sp) { popups.splice(k, 1); continue; }
    ctx.globalAlpha = 1 - t;
    ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText(p.text, sp.x + 28, sp.y - 135 - t * 30);
    ctx.fillStyle = p.col; ctx.fillText(p.text, sp.x + 28, sp.y - 135 - t * 30);
    ctx.globalAlpha = 1;
  }
}

// ================== MÀN HÌNH LOADING ==================
const TIPS = [
  'Nhảy (Space) rồi Click để đập cầu cực mạnh.',
  'Ctrl + Click để bỏ nhỏ sát lưới khi đối thủ đứng cuối sân.',
  'Giữ phím lùi về sau khi đánh để phông cầu sâu hơn.',
  'Giữ phím tiến về lưới khi đánh để phông cầu ngắn hơn.',
  'Bấm đánh hơi sớm cũng được — vợt sẽ tự vung khi cầu tới tầm.',
  'Đánh đôi: điểm chẵn người 1 giao, điểm lẻ người 2 giao.',
  'Giao cầu: Click giao gần, Ctrl+Click phông xa — giữ chuột để căn lực. Giao gần yếu quá chạm lưới, phông xa mạnh quá ra ngoài!',
  'Cầm cầu quá 8 giây sẽ tự động phông xa.',
  'Máy Khó rất hay bỏ nhỏ khi bạn đứng xa lưới.',
  'Phải hơn 2 điểm mới thắng, nhưng chạm mốc +9 (VD: 30) là thắng luôn.',
  'Thể lực tụt khi chạy, mỗi cú đánh và nhất là nhảy đập. Đuối sức thì chạy chậm, đập yếu và lệch.',
  'Mệt tích luỹ: sau mỗi điểm chỉ hồi một ít, và mức thể lực tối đa giảm dần theo trận (phần sọc đỏ trên thanh).',
  'Dưới 12% thể lực là KIỆT SỨC: không nhảy đập được nữa! Bớt nhảy đập, giữ sức cho điểm quyết định.',
  'Tay vợt có chỉ số Thể lực cao mất sức chậm hơn hẳn — đánh lâu sẽ thấy rõ.',
];
const WEATHER = ['Buổi tối · 27°C', 'Buổi chiều · Nắng nhẹ', 'Ban đêm · Mưa (may mà trong nhà)', 'Buổi sáng · Gió 0 km/h'];
// mũi tên phong độ: chỉ để cho vui
const FORM = [['↑', '#ff4d4d'], ['↗', '#ff9f2e'], ['→', '#35c46b'], ['↘', '#3d8bff'], ['↓', '#a77bff']];
const pick = a => a[Math.random() * a.length | 0];
const ld = $('loading');

function openLoading() {
  $('ldInfo').textContent = (cup ? 'CÚP · ' + CUP[cup.round].name + ' · ' : '') + `${room.mode.replace('v', ' VS ')} · ${room.target} ĐIỂM · MÁY ${LEVEL_NAME[room.level].toUpperCase()}`;
  const v = GAME && GAME.venues.find(v => v.id === room.venue);
  $('ldVenue').textContent = (v ? v.name : 'Nhà thi đấu') + ' · ' + (v && v.wind ? 'Ngoài trời · Có gió' : pick(WEATHER));
  $('ldTip').textContent = pick(TIPS);
  for (let t = 0; t < 2; t++) {
    const ul = $('ld' + t); ul.innerHTML = '';
    room.slots[t].forEach((s, i) => {
      if (!s) return;
      const li = document.createElement('li');
      li.style.animationDelay = (0.25 + i * 0.12) + 's';
      if (s.id === myId) li.classList.add('me');
      const [arrow, col] = pick(FORM);
      li.innerHTML = `<span class="num" title="OVR">${charOf(s.char)?.ovr ?? i + 1}</span><span class="nm"></span><span class="form" style="color:${col}">${arrow}</span>`;
      li.querySelector('.nm').textContent = (s.bot ? '🤖 ' : '') + s.name + (s.id === myId ? ' (bạn)' : '');
      ul.appendChild(li);
    });
  }
  $('ldFill').style.width = '0%';
  ld.classList.remove('out');
  ld.hidden = false;
}

function updateLoading(load) {
  if (load == null) {
    if (!ld.hidden && !ld.classList.contains('out')) {
      ld.classList.add('out');
      setTimeout(() => { if (ld.classList.contains('out')) { ld.hidden = true; ld.classList.remove('out'); } }, 500);
    }
    return;
  }
  if ((ld.hidden || ld.classList.contains('out')) && room) openLoading();
  const pct = Math.round(load * 100);
  $('ldFill').style.width = pct + '%';
  $('ldPct').textContent = pct;
}
