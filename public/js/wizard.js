// ================== TRANG PHỤC ==================
const SHIRTS = ['#3d8bff', '#ff5a5a', '#35c46b', '#ffd84a', '#ff9f2e', '#a77bff', '#ff5a8a', '#18b5c9', '#f4f4f4', '#222833'];
const BOTTOMS = ['#222833', '#f4f4f4', '#1c3d7a', '#7a1c1c', '#3d8bff', '#ff5a8a', '#35c46b', '#a77bff'];
const outfits = { m: { s: 'tee', c1: '#3d8bff', c2: '#222833' }, f: { s: 'skirt', c1: '#ff5a8a', c2: '#ff5a8a' } };   // lưu riêng theo giới tính
try { Object.assign(outfits, JSON.parse(localStorage.getItem('cl_outfit')) || {}); } catch {}
// màu bộ đồ theo quốc gia: [màu chính, màu phụ]
const KIT_COLORS = {
  CHN: ['#de2910', '#ffde00'], THA: ['#2b3a8c', '#f4f4f4'], JPN: ['#1d3c8f', '#f4f4f4'], INA: ['#ce1126', '#f4f4f4'],
  MAS: ['#ffcc00', '#010066'], TPE: ['#0047ab', '#f4f4f4'], IND: ['#1f5fbf', '#ff9933'], VIE: ['#da251d', '#ffcd00'],
  KOR: ['#c60c30', '#003478'], DEN: ['#c8102e', '#f4f4f4'], FRA: ['#002395', '#f4f4f4'], ESP: ['#c60b1e', '#ffc400'],
  SCO: ['#005eb8', '#f4f4f4'], GER: ['#f4f4f4', '#222222'], CAN: ['#d80621', '#f4f4f4'], GUA: ['#4997d0', '#f4f4f4'],
  BRA: ['#ffdf00', '#009c3b'], USA: ['#0a3161', '#b31942'], MRI: ['#ea2839', '#1a206d'], NGR: ['#008751', '#f4f4f4'],
  EGY: ['#ce1126', '#222222'], RSA: ['#007a4d', '#ffb612'], NZL: ['#222222', '#f4f4f4'], AUS: ['#ffcd00', '#00843d'],
};
const kitColors = c => KIT_COLORS[c.country] || ['#3d8bff', '#f4f4f4'];
// kit 0 = bộ chính, 1 = bộ phụ (đảo màu), 2 = tự chọn (chỉ của mình)
function kitFor(c, idx) {
  if (idx === 2) return outfits[c.gender];
  const [a, b] = kitColors(c), s = c.gender === 'f' ? 'skirt' : 'tee';
  return idx === 0 ? { s, c1: a, c2: b } : { s, c1: b, c2: a };
}
let myKit = +localStorage.getItem('cl_kit') || 0;
const myOutfit = () => { const c = charOf(myChar); return c ? kitFor(c, myKit) : outfits[myGender()]; };
function defaultOutfit(gender, col) { return gender === 'f' ? { s: 'skirt', c1: col, c2: col } : { s: 'tee', c1: col, c2: '#222833' }; }
function saveOutfit() { localStorage.setItem('cl_outfit', JSON.stringify(outfits)); nameBox.onchange(); }

// vẽ một người vào canvas nhỏ (xem trước)
function drawFigure(canvas, scale, o) {
  const main = ctx;
  ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2 - 12 * scale, canvas.height - 8 * scale - FLOOR * scale);
  ctx.scale(scale, scale);
  drawPlayer(0, FLOOR, o);
  ctx.restore();
  ctx = main;
}

// ================== GIAO HỮU: THIẾT LẬP → NHÂN VẬT → TRANG PHỤC → SÂN  ·  CÚP: THIẾT LẬP ==================
// cont[1] = 'any' / pick[1] = 'random': đối thủ ngẫu nhiên (mọi châu lục hoặc trong châu lục đã chọn)
let wiz = null;   // { mode: 'friendly' | 'cup', step, side, cont: [..], gender: [..], pick: [tôi, đối thủ], venue }
const WZ_ID = { rules: 'wzRules', cont: 'wzCont', outfit: 'wzOutfit', venue: 'wzVenue' };
const wizOrder = () => wiz.mode === 'cup' ? ['rules'] : ['rules', 'cont', 'outfit', 'venue'];
const CONT_ICON = { asia: '🌏', europe: '🌍', america: '🌎', africa: '🌍', oceania: '🏝️' };
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

function openWizard(step, mode) {
  if (!GAME) return;
  if (!wiz) {
    const c = charOf(myChar), opp = localStorage.getItem('cl_opp'), o = charOf(opp);
    const oc = localStorage.getItem('cl_oppcont');
    const oppCont = o ? o.continent : GAME.continents[oc] ? oc : 'any';
    wiz = { side: 0, cont: [c.continent, oppCont], gender: [c.gender, o ? o.gender : c.gender],
      pick: [myChar, o ? opp : 'random'], venue: localStorage.getItem('cl_venue') || 'arena', mode: mode || 'friendly', row: 0 };
  }
  wiz.step = step;
  document.querySelector('.m-body').hidden = true;
  $('mPanel').hidden = $('hero').hidden = true;
  for (const [k, id] of Object.entries(WZ_ID)) $(id).hidden = k !== step;
  renderWizard();
}
function closeWizard() {
  if (!wiz) return;
  wiz = null;
  for (const id of Object.values(WZ_ID)) $(id).hidden = true;
  document.querySelector('.m-body').hidden = false;
}
function setTicker(text) { const span = el('span', null); span.textContent = text; $('mDesc').replaceWith(span); span.id = 'mDesc'; }
function renderWizard() {
  ({ rules: renderRulesStep, cont: renderContStep, outfit: renderOutfitStep, venue: renderVenueStep })[wiz.step]();
}
function wizNext() {
  SFX.play('ok');
  if (wiz.step === 'cont') {
    myChar = wiz.pick[0]; localStorage.setItem('cl_char', myChar);
    localStorage.setItem('cl_opp', wiz.pick[1]);
    localStorage.setItem('cl_oppcont', wiz.cont[1]);
    nameBox.onchange();
  }
  const order = wizOrder(), i = order.indexOf(wiz.step);
  if (i < order.length - 1) return openWizard(order[i + 1]);
  if (wiz.mode === 'cup') { closeWizard(); return startCup(); }
  localStorage.setItem('cl_venue', wiz.venue);
  const opp = resolveOpp(), oc = charOf(opp);
  const o = { ...settings, venue: wiz.venue, opp, oppOutfit: oc && wiz.pick[1] !== 'random' ? kitFor(oc, wiz.kit ? wiz.kit[1] : 0) : null };
  closeWizard();
  startSolo(o);
}
function wizBack() {
  SFX.play('back');
  const order = wizOrder(), i = order.indexOf(wiz.step);
  if (i > 0) openWizard(order[i - 1]);
  else openMenu('main');
}
for (const id of Object.values(WZ_ID)) {
  $(id).querySelector('.back').onclick = () => wizBack();
  $(id).querySelector('.ok').onclick = () => wizNext();
}
// đối thủ 'random': bốc ngẫu nhiên trong châu lục + giới tính đã chọn ('any' -> để server tự chọn)
function resolveOpp() {
  if (wiz.pick[1] !== 'random') return wiz.pick[1];
  if (wiz.cont[1] === 'any') return null;
  return pick(GAME.chars.filter(c => c.continent === wiz.cont[1])).id;
}
// đổi châu lục / giới tính: nếu người đang chọn không còn trong danh sách thì chọn người mạnh nhất
function fixPick(side) {
  if (side === 1 && wiz.cont[1] === 'any') { wiz.pick[1] = 'random'; return; }
  if (side === 1 && wiz.pick[1] === 'random') return;   // giữ "ngẫu nhiên", nhưng bốc trong châu lục mới
  const c = charOf(wiz.pick[side]);
  if (c && c.continent === wiz.cont[side]) return;
  const top = GAME.chars.filter(c => c.continent === wiz.cont[side]).sort((a, b) => b.ovr - a.ovr)[0];
  wiz.pick[side] = top.id; wiz.gender[side] = top.gender;
}
const sideName = side => side === 0 ? 'BẠN' : 'ĐỐI THỦ';
function vsTicker() {
  const me = charOf(wiz.pick[0]), op = charOf(wiz.pick[1]);
  const opText = op ? `${op.full} (${op.country}, OVR ${op.ovr})`
    : wiz.cont[1] === 'any' ? 'đối thủ ngẫu nhiên' : 'đối thủ ngẫu nhiên ở ' + GAME.continents[wiz.cont[1]];
  setTicker(`${me.full} (${me.country}, OVR ${me.ovr})  VS  ${opText}`);
}
function bindSide(root, side, render) {
  root.classList.toggle('active', wiz.side === side);
  root.onpointerdown = () => { if (wiz.side !== side) { wiz.side = side; render(); } };
}
const ARROW = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1, KeyA: -1, KeyD: 1, KeyW: -1, KeyS: 1 };

// ---- bước 1: thiết lập trận — bảng 2 cột, dòng đang chọn tô sáng, mô tả ở dưới ----
const OPT_DESC = {
  mode: 'Số tay vợt mỗi đội. Vị trí còn trống sẽ do Máy đánh.',
  target: 'Đánh tới bao nhiêu điểm. Phải hơn 2 điểm mới thắng, chạm mốc +9 (VD: 30) là thắng luôn.',
  level: 'Độ khó của các tay vợt do Máy điều khiển.',
  fatigue: 'BẬT: thể lực tụt khi chạy, đánh, nhảy đập — đuối sức thì chạy chậm, đập yếu. TẮT: không bao giờ mệt.',
  serve: 'Bên được giao cầu ở điểm đầu tiên.',
};
function rulesRows() {
  const cupMode = wiz.mode === 'cup', c = charOf(myChar);
  const o = k => ({ opt: k, label: OPTS[k].label, desc: OPT_DESC[k] });
  return [
    { go: true, label: cupMode ? '▶ BẮT ĐẦU CÚP' : '▶ TIẾP TỤC: CHỌN NHÂN VẬT',
      desc: cupMode ? 'Vào trận Tứ kết ngay.' : 'Sang bước chọn tay vợt cho bạn và đối thủ.' },
    { label: 'CHẾ ĐỘ', value: cupMode ? 'CÚP' : 'GIAO HỮU', off: true, desc: cupMode ? 'Đấu loại trực tiếp 3 vòng.' : 'Một trận đấu với Máy.' },
    ...(cupMode ? [
      { label: 'TAY VỢT', value: c.full, off: true, desc: 'Tay vợt của bạn — đổi ở mục GIAO HỮU.' },
      { label: 'SỐ VÒNG', value: '3', off: true, desc: 'Tứ kết gặp tay vợt OVR ≤ 81 · Bán kết OVR 82–87 · Chung kết OVR 88+.' },
    ] : []),
    o('mode'), o('target'),
    cupMode ? { label: 'ĐỘ KHÓ MÁY', value: 'TĂNG DẦN', off: true, desc: 'Tứ kết Máy Dễ · Bán kết Máy Vừa · Chung kết Máy Khó.' } : o('level'),
    o('fatigue'), o('serve'),
  ];
}
function renderRulesStep() {
  const cupMode = wiz.mode === 'cup', rows = rulesRows();
  $('ptHead').textContent = cupMode ? 'CÚP' : 'GIAO HỮU';
  $('ptStep').textContent = cupMode ? 'Thiết lập giải' : 'Giao hữu · bước 1/4';
  $('ptTitle').textContent = cupMode ? 'THIẾT LẬP GIẢI ĐẤU' : 'THIẾT LẬP TRẬN ĐẤU';
  $('wzRules').querySelector('.ok').textContent = cupMode ? 'BẮT ĐẦU ▶' : 'Tiếp ▶';
  wiz.row = Math.min(wiz.row, rows.length - 1);
  $('ptRows').replaceChildren(...rows.map((r, i) => {
    const value = r.opt ? (OPTS[r.opt].vals.find(x => x[0] === settings[r.opt]) || OPTS[r.opt].vals[0])[1] : r.value;
    const row = el('div', 'pt-row' + (r.go ? ' go' : '') + (r.opt ? ' opt' : '') + (r.off ? ' off' : '') + (i === wiz.row ? ' on' : ''),
      r.go ? '<span></span>' : '<span></span><span class="v"></span>');
    row.firstChild.textContent = r.label;
    if (!r.go) row.lastChild.textContent = value;
    row.onmouseenter = () => { if (!r.off && wiz.row !== i) { wiz.row = i; renderRulesStep(); } };
    row.onclick = () => { if (r.off) return; wiz.row = i; if (r.go) wizNext(); else cycleOpt(r.opt, 1); };
    return row;
  }));
  $('ptDesc').textContent = rows[wiz.row].desc;
  setTicker(rows[wiz.row].desc);
}
function cycleOpt(k, d) {
  const vals = OPTS[k].vals, i = vals.findIndex(x => x[0] === settings[k]);
  settings[k] = vals[(i + d + vals.length) % vals.length][0];
  localStorage.setItem('cl_set', JSON.stringify(settings));
  renderRulesStep();
}
function rulesStepKey(k, e) {
  const rows = rulesRows();
  if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'KeyW' || k === 'KeyS') {
    const d = k === 'ArrowUp' || k === 'KeyW' ? -1 : 1;
    let i = wiz.row;
    do i = (i + d + rows.length) % rows.length; while (rows[i].off);   // bỏ qua dòng bị khoá
    wiz.row = i;
    renderRulesStep();
  } else if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'KeyA' || k === 'KeyD') {
    const r = rows[wiz.row];
    if (r.opt) cycleOpt(r.opt, k === 'ArrowLeft' || k === 'KeyA' ? -1 : 1);
  } else return false;
  e.preventDefault();
  return true;
}

// ---- bước 2: chọn nhân vật — châu lục, bảng tay vợt, chỉ số chi tiết ở giữa ----
const contOptions = side => [...(side === 1 ? ['any'] : []), ...Object.keys(GAME.continents)];
function renderContStep() {
  for (let side = 0; side < 2; side++) {
    const root = $('wzCont' + side);
    bindSide(root, side, renderContStep);
    root.querySelector('.ct-grid').replaceChildren(...contOptions(side).map(k => {
      let html;
      if (k === 'any') html = '<span class="ic">🎲</span><b>NGẪU NHIÊN</b><small>Bất kỳ tay vợt nào</small>';
      else {
        const all = GAME.chars.filter(c => c.continent === k), star = all.reduce((a, b) => b.ovr > a.ovr ? b : a);
        const m = all.filter(c => c.gender === 'm').length;
        html = `<span class="ic">${CONT_ICON[k]}</span><b>${GAME.continents[k].toUpperCase()}</b><small>${m} nam · ${all.length - m} nữ</small><small>⭐ ${star.name} · ${star.ovr}</small>`;
      }
      const b = el('button', 'ct-tile' + (wiz.cont[side] === k ? ' on' : ''), html);
      b.onclick = () => { wiz.side = side; setCont(side, k); renderContStep(); };
      b.ondblclick = () => wizNext();
      return b;
    }));
    renderRoster(root.querySelector('.ct-roster'), side);
  }
  // cột giữa: chỉ số chi tiết — trên của mình, dưới của đối thủ
  renderCard(charOf(wiz.pick[0]), $('midMe'));
  const op = charOf(wiz.pick[1]);
  if (op) renderCard(op, $('midOpp')); else $('midOpp').innerHTML = randomCardHTML();
  updatePortraits();
  vsTicker();
}
// chân dung 2 bên: mô hình 3D (Three.js) nếu tải được, không thì vẽ 2D
function updatePortraits() {
  [0, 1].forEach(side => {
    const c = charOf(wiz.pick[side]), box = $('pp' + side);
    const [a, b] = c ? kitColors(c) : ['#4a4f5c', '#2a2e38'];
    box.style.setProperty('--c1', a); box.style.setProperty('--c2', b);
    const emb = box.querySelector('.pp-emb');
    emb.textContent = c ? c.country : '?';
    emb.style.background = `linear-gradient(135deg, ${a} 50%, ${b} 50%)`;
    const info = box.querySelector('.pp-info');
    if (c) {
      info.innerHTML = `<div class="ovr">${c.ovr}<small>OVR</small></div><b></b><span>${c.gender === 'f' ? '♀ Nữ' : '♂ Nam'} · ${GAME.styles[c.style].name}</span>` +
        `<em>⚡ ${GAME.abilities[c.ability].name}</em><em class="wk">⚠ ${GAME.weaknesses[c.weak].name}</em>`;
      info.querySelector('b').textContent = c.full;
    } else info.innerHTML = `<div class="ovr">?</div><b>NGẪU NHIÊN</b><span>${wiz.cont[1] === 'any' ? 'Mọi châu lục' : GAME.continents[wiz.cont[1]]}</span>`;
    // chân dung = tay vợt được chọn: ngoại hình + nét nhận biết (kiểu tóc, râu, dáng người...) của chính người đó
    const d = c ? { id: c.id, gender: c.gender, hair: c.look[0], skin: c.look[1], feat: c.feat, kit: kitFor(c, side === 0 ? myKit : 0) }
      : { id: 'random', random: true, gender: 'm', hair: '#1b1f28', skin: '#2a2f3a', kit: { s: 'tee', c1: '#2a2f3a', c2: '#1b1f28' } };
    if (window.Portrait3D) window.Portrait3D.set(side, d);
    else drawFigure(box.querySelector('.pp-2d'), 0.95, { look: [d.hair, d.skin], gender: d.gender, outfit: d.kit });
  });
}
addEventListener('portrait3d-ready', () => { if (wiz && wiz.step === 'cont') updatePortraits(); });
function randomCardHTML() {
  const anyCont = wiz.cont[1] === 'any';
  return `<div class="cc-random">🎲<b>NGẪU NHIÊN</b><span>${anyCont ? 'Máy chọn một tay vợt bất kỳ'
    : 'Một tay vợt bất kỳ của ' + GAME.continents[wiz.cont[1]]}</span></div>`;
}
// danh sách tay vợt của châu lục đang chọn: bấm để chọn sẵn cho bước sau, bấm đúp để sang luôn
const rosterIds = side => [...(side === 1 ? ['random'] : []), ...GAME.chars.filter(c => c.continent === wiz.cont[side]).sort((a, b) => b.ovr - a.ovr).map(c => c.id)];
const ROSTER_STATS = [['speed', 'TĐ', 'Tốc độ'], ['smashPow', 'ĐẬP', 'Lực đập'], ['defense', 'THỦ', 'Phòng thủ'], ['netPlay', 'LƯỚI', 'Đánh lưới']];
function renderRoster(box, side) {
  const k = wiz.cont[side];
  if (k === 'any') { box.innerHTML = '<h4>NGẪU NHIÊN</h4><p class="mute" style="margin:0">Máy sẽ bốc một trong ' + GAME.chars.length + ' tay vợt của cả 5 châu lục.</p>'; return; }
  const list = GAME.chars.filter(c => c.continent === k).sort((a, b) => b.ovr - a.ovr);
  box.innerHTML = `<h4>TAY VỢT ${GAME.continents[k].toUpperCase()} (${list.length})</h4><table class="ct-table"><thead><tr><th>NƯỚC</th><th>TÊN</th><th></th>` +
    `<th class="st">LỐI CHƠI</th>${ROSTER_STATS.map(([, ab, full]) => `<th class="num" title="${full}">${ab}</th>`).join('')}<th class="num">OVR</th></tr></thead><tbody></tbody></table>`;
  const rows = list.map(c => {
    const tr = el('tr', wiz.pick[side] === c.id ? 'on' : '',
      `<td><span class="flag">${c.country}</span></td><td class="nm"></td><td>${c.gender === 'f' ? '♀' : '♂'}</td><td class="st">${GAME.styles[c.style].name}</td>` +
      ROSTER_STATS.map(([key]) => `<td class="num" style="color:${statColor(c.stats[key])}">${c.stats[key]}</td>`).join('') + `<td class="num ovr">${c.ovr}</td>`);
    tr.querySelector('.nm').textContent = c.full;
    tr.title = GAME.abilities[c.ability].name + ' · Điểm yếu: ' + GAME.weaknesses[c.weak].name;
    tr.onclick = () => { wiz.side = side; wiz.gender[side] = c.gender; wiz.pick[side] = c.id; renderContStep(); };
    tr.ondblclick = () => wizNext();
    return tr;
  });
  if (side === 1) {   // đối thủ: vẫn có thể để ngẫu nhiên trong châu lục này
    const tr = el('tr', wiz.pick[1] === 'random' ? 'on' : '', `<td colspan="${5 + ROSTER_STATS.length}">🎲 Ngẫu nhiên trong ${GAME.continents[k]}</td>`);
    tr.onclick = () => { wiz.side = 1; wiz.pick[1] = 'random'; renderContStep(); };
    tr.ondblclick = () => wizNext();
    rows.unshift(tr);
  }
  box.querySelector('tbody').replaceChildren(...rows);
}
function setCont(side, k) {
  if (wiz.cont[side] === k) return;
  wiz.cont[side] = k;
  fixPick(side);
}
function contStepKey(k, e) {
  const side = wiz.side, opts = contOptions(side), i = opts.indexOf(wiz.cont[side]);
  const d = ARROW[k], horiz = k === 'ArrowLeft' || k === 'ArrowRight' || k === 'KeyA' || k === 'KeyD';
  if (k === 'Tab') wiz.side = 1 - side;
  else if (d && horiz) setCont(side, opts[(i + d + opts.length) % opts.length]);
  else if (d && wiz.cont[side] !== 'any') {
    const list = rosterIds(side), j = list.indexOf(wiz.pick[side]);
    wiz.pick[side] = list[Math.max(0, Math.min(list.length - 1, j < 0 ? 0 : j + d))];
    const c = charOf(wiz.pick[side]); if (c) wiz.gender[side] = c.gender;
  } else return false;
  e.preventDefault();
  renderContStep();
  return true;
}

// ---- bước 3: chọn trang phục — mỗi tay vợt có bộ chính / bộ phụ theo màu quốc gia, riêng mình có thêm "tự chọn" ----
const KIT_NAMES = ['Bộ chính', 'Bộ phụ', 'Tự chọn'];
const kitsOf = side => side === 0 ? [0, 1, 2] : charOf(wiz.pick[1]) ? [0, 1] : [0];
function renderOutfitStep() {
  const me = charOf(myChar), op = charOf(wiz.pick[1]);
  if (!wiz.kit) wiz.kit = [myKit, 0];
  if (!kitsOf(1).includes(wiz.kit[1])) wiz.kit[1] = 0;
  // tên + huy hiệu (màu quốc gia)
  const nameTo = (box, c) => { box.innerHTML = c ? `<span class="flag">${c.country}</span><small>${c.ovr}</small>` : '🎲 '; box.append(c ? c.full : 'Ngẫu nhiên'); };
  nameTo($('ksName0'), me); nameTo($('ksName1'), op);
  $('ksName1').prepend(...[...$('ksName1').childNodes].slice(-1));   // bên phải: tên trước, cờ sau
  const emb = (box, c) => {
    const [a, b] = c ? kitColors(c) : ['#555', '#333'];
    box.style.background = `linear-gradient(135deg, ${a} 50%, ${b} 50%)`;
    box.textContent = c ? c.country : '?';
  };
  emb($('ksEmb0'), me); emb($('ksEmb1'), op);
  drawRadar($('ksRadar'), [[me, '#3d8bff'], ...(op ? [[op, '#ff5a5a']] : [])]);
  // bộ đồ 2 bên
  drawKit($('ksKit0'), kitFor(me, wiz.kit[0]));
  drawKit($('ksKit1'), op ? kitFor(op, wiz.kit[1]) : null);
  $('ksText').textContent = KIT_NAMES[wiz.kit[0]] + ' / ' + (op ? KIT_NAMES[wiz.kit[1]] : '?');
  $('ksSub').textContent = 'Trang phục: ' + (me.gender === 'f' ? 'nữ' : 'nam') + ' / ' + (op ? (op.gender === 'f' ? 'nữ' : 'nam') : 'ngẫu nhiên');
  const A = kitsOf(0), B = kitsOf(1);
  $('ksCount').textContent = `Chọn trang phục - [${A.indexOf(wiz.kit[0]) * B.length + B.indexOf(wiz.kit[1]) + 1}/${A.length * B.length}]`;
  // "Tự chọn": hiện bảng chỉnh kiểu + màu
  $('ksCustom').hidden = wiz.kit[0] !== 2;
  if (wiz.kit[0] === 2) renderCustomKit();
  setTicker(`${me.full}: ${KIT_NAMES[wiz.kit[0]]}  VS  ${op ? op.full + ': ' + KIT_NAMES[wiz.kit[1]] : 'đối thủ ngẫu nhiên'}`);
}
function renderCustomKit() {
  const g = myGender(), of = outfits[g];
  const fig = o => ({ name: '', look, gender: g, outfit: o });
  $('ofStyles').replaceChildren(...GAME.outfits[g].map(([st, label]) => {
    const b = el('button', of.s === st ? 'on' : '', `<canvas width="72" height="100"></canvas><span>${label}</span>`);
    drawFigure(b.querySelector('canvas'), 0.55, fig({ ...of, s: st }));
    b.onclick = () => { of.s = st; saveOutfit(); renderOutfitStep(); };
    return b;
  }));
  const swatches = (box, colors, key) => box.replaceChildren(...colors.map(col => {
    const b = el('button', of[key] === col ? 'on' : ''); b.style.background = col;
    b.onclick = () => { of[key] = col; saveOutfit(); renderOutfitStep(); };
    return b;
  }));
  swatches($('ofC1'), SHIRTS, 'c1');
  swatches($('ofC2'), BOTTOMS, 'c2');
  $('ofC2Label').textContent = { skirt: 'MÀU VÁY', dress: 'MÀU THẮT LƯNG', polo: 'MÀU QUẦN & CỔ ÁO' }[of.s] || 'MÀU QUẦN';
}
// đổi bộ: side = undefined -> đổi theo cặp (như bộ đếm [n/N]), 0/1 -> đổi riêng một bên
function cycleKit(d, side) {
  const A = kitsOf(0), B = kitsOf(1);
  if (side != null) {
    const L = side ? B : A;
    wiz.kit[side] = L[(L.indexOf(wiz.kit[side]) + d + L.length) % L.length];
  } else {
    const n = A.length * B.length, i = (A.indexOf(wiz.kit[0]) * B.length + B.indexOf(wiz.kit[1]) + d + n) % n;
    wiz.kit = [A[Math.floor(i / B.length)], B[i % B.length]];
  }
  myKit = wiz.kit[0]; localStorage.setItem('cl_kit', myKit);
  nameBox.onchange();   // gửi trang phục mới lên server
  renderOutfitStep();
}
$('ksPrev').onclick = () => cycleKit(-1);
$('ksNext').onclick = () => cycleKit(1);
$('ksKit0').onclick = () => cycleKit(1, 0);
$('ksKit1').onclick = () => cycleKit(1, 1);
function outfitStepKey(k, e) {
  if (k === 'ArrowLeft' || k === 'ArrowRight') cycleKit(k === 'ArrowRight' ? 1 : -1);
  else return false;
  e.preventDefault();
  return true;
}

// biểu đồ ngũ giác so sánh 2 tay vợt (thang 50–99 để thấy rõ chênh lệch)
const RADAR = [
  ['TỐC ĐỘ', s => (s.speed + s.agility) / 2],
  ['TẤN CÔNG', s => (s.smashPow + s.smashAcc) / 2],
  ['PHÒNG THỦ', s => (s.reflex + s.defense + s.recovery) / 3],
  ['KỸ THUẬT', s => (s.netPlay + s.deception) / 2],
  ['THỂ LỰC', s => s.stamina],
];
function drawRadar(cvs, list) {
  const g = cvs.getContext('2d'), cx = cvs.width / 2, cy = cvs.height / 2 + 8, R = 68;
  const pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / RADAR.length; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
  const poly = f => { g.beginPath(); RADAR.forEach((_, i) => { const [x, y] = f(i); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); };
  g.clearRect(0, 0, cvs.width, cvs.height);
  poly(i => pt(i, R)); g.fillStyle = '#1b1430'; g.fill(); g.strokeStyle = '#c9a8ff'; g.lineWidth = 3; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1;
  for (let k = 1; k < 4; k++) { poly(i => pt(i, R * k / 4)); g.stroke(); }
  RADAR.forEach((_, i) => { const [x, y] = pt(i, R); g.beginPath(); g.moveTo(cx, cy); g.lineTo(x, y); g.stroke(); });
  for (const [c, col] of list) {
    poly(i => pt(i, R * Math.max(0.06, (RADAR[i][1](c.stats) - 50) / 49)));
    g.fillStyle = col + '55'; g.fill(); g.strokeStyle = col; g.lineWidth = 2.5; g.stroke();
  }
  g.font = 'bold 12px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  RADAR.forEach(([label], i) => {
    const [x, y] = pt(i, R + 26);
    g.lineWidth = 4; g.strokeStyle = '#000'; g.strokeText(label, x, y);
    g.fillStyle = '#fff'; g.fillText(label, x, y);
  });
}

// bộ đồ trải phẳng: áo / quần hoặc váy / tất + giày (of = null: chưa biết)
function drawKit(cvs, of) {
  const g = cvs.getContext('2d'), cx = cvs.width / 2;
  g.clearRect(0, 0, cvs.width, cvs.height);
  g.lineJoin = 'round'; g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,.45)';
  const shape = (pts, fill) => {
    g.fillStyle = fill; g.beginPath();
    pts.forEach(([x, y], i) => i ? g.lineTo(cx + x, y) : g.moveTo(cx + x, y));
    g.closePath(); g.fill(); g.stroke();
  };
  if (!of) {
    of = { s: 'tee', c1: '#3a3f4b', c2: '#2a2e38' };
    g.globalAlpha = 0.6;
  }
  const TEE = [[-16, 8], [-6, 15], [6, 15], [16, 8], [44, 24], [37, 42], [27, 37], [27, 84], [-27, 84], [-27, 37], [-37, 42], [-44, 24]];
  if (of.s === 'tank') shape([[-17, 8], [-9, 8], [-6, 20], [6, 20], [9, 8], [17, 8], [27, 32], [27, 84], [-27, 84], [-27, 32]], of.c1);
  else if (of.s === 'dress') {
    shape([[-14, 8], [-6, 15], [6, 15], [14, 8], [25, 22], [23, 64], [40, 126], [-40, 126], [-23, 64], [-25, 22]], of.c1);
    g.fillStyle = of.c2; g.fillRect(cx - 23, 62, 46, 6);
  } else shape(TEE, of.c1);
  if (of.s === 'polo') { shape([[-9, 10], [9, 10], [0, 26]], of.c2); g.fillStyle = 'rgba(0,0,0,.4)'; for (const y of [30, 38]) { g.beginPath(); g.arc(cx, y, 1.8, 0, Math.PI * 2); g.fill(); } }
  // quần / váy
  if (of.s === 'skirt') shape([[-25, 92], [25, 92], [38, 128], [-38, 128]], of.c2);
  else if (of.s !== 'dress') shape([[-27, 92], [27, 92], [30, 128], [5, 128], [0, 110], [-5, 128], [-30, 128]], of.c2);
  // tất + giày
  for (const sd of [-1, 1]) {
    const x = cx + sd * 15;
    g.fillStyle = '#f4f4f4'; g.fillRect(x - 7, 138, 14, 30); g.strokeRect(x - 7, 138, 14, 30);
    g.fillStyle = of.c1; g.fillRect(x - 7, 142, 14, 4);   // vạch màu áo trên tất
    g.fillStyle = '#222'; g.beginPath(); g.ellipse(x + sd * 3, 172, 11, 6, 0, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  if (of.c1 === '#3a3f4b') { g.fillStyle = '#fff'; g.font = 'bold 30px system-ui'; g.textAlign = 'center'; g.fillText('?', cx, 60); }
}

// ---- bước 4: sân thi đấu ----
function renderVenueStep() {
  $('vnList').replaceChildren(...GAME.venues.map(v => {
    const b = el('button', 'vn-card' + (wiz.venue === v.id ? ' on' : ''), `<canvas width="250" height="125"></canvas><b></b><span></span>`);
    b.querySelector('b').textContent = (v.wind ? '🍃 ' : '') + v.name;
    b.querySelector('span').textContent = v.desc;
    const cvs = b.querySelector('canvas'), main = ctx;
    ctx = cvs.getContext('2d'); ctx.save(); ctx.scale(0.25, 0.25); drawCourt(v.id); ctx.restore(); ctx = main;
    b.onclick = () => { wiz.venue = v.id; renderVenueStep(); };
    return b;
  }));
  const v = GAME.venues.find(v => v.id === wiz.venue);
  setTicker(v.name + ' — ' + v.desc);
}
function venueStepKey(k, e) {
  const ids = GAME.venues.map(v => v.id), i = ids.indexOf(wiz.venue);
  if (k === 'ArrowLeft' || k === 'ArrowRight') { wiz.venue = ids[(i + (k === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length]; renderVenueStep(); }
  else return false;
  e.preventDefault();
  return true;
}

function wizKey(e) {
  if (e.target.tagName === 'INPUT') return;
  const k = e.code;
  if (k === 'Escape' || k === 'Backspace') { e.preventDefault(); return wizBack(); }
  if (k === 'Enter') { e.preventDefault(); if (!e.repeat) wizNext(); return; }
  if (/^(Arrow|Key[WASD]$)/.test(k)) SFX.play('tick');
  ({ rules: rulesStepKey, cont: contStepKey, outfit: outfitStepKey, venue: venueStepKey })[wiz.step](k, e);
}
