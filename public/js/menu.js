// ================== NHÂN VẬT & CHỈ SỐ ==================
let GAME = null;   // dữ liệu nhân vật, server gửi trong tin 'hi'
let myChar = localStorage.getItem('cl_char') || 'ducphat';
const myGender = () => charOf(myChar)?.gender || 'm';
const charOf = id => GAME && GAME.chars.find(c => c.id === id);
const statColor = v => v >= 90 ? '#35e07a' : v >= 80 ? '#a6e05a' : v >= 70 ? '#ffd84a' : '#ff9f2e';

function renderCard(c, el) {
  el.innerHTML = `<div class="cc-top"><div class="cc-ovr"><b>${c.ovr}</b><small>OVR</small></div><canvas class="cc-fig" width="110" height="150"></canvas>` +
    `<div><div class="cc-name"></div><div class="cc-nick"><span class="flag">${c.country}</span> ${c.gender === 'f' ? '♀ Nữ' : '♂ Nam'} · ${GAME.continents[c.continent]}</div>` +
    `<div class="cc-style">${GAME.styles[c.style].name}</div></div></div><div class="cc-stats"></div><div class="cc-extra"></div>`;
  el.querySelector('.cc-name').textContent = c.full;
  const q = sel => el.querySelector(sel);
  const groups = {};
  for (const st of GAME.stats) (groups[st.group] ||= []).push(st);
  q('.cc-stats').innerHTML = Object.entries(groups).map(([g, list]) => `<div class="cc-g"><h4>${g}</h4>` +
    list.map(st => { const v = c.stats[st.key];
      return `<div class="cc-row" title="${st.desc}"><span>${st.name}</span><i><u style="width:${v}%;background:${statColor(v)}"></u></i><b style="color:${statColor(v)}">${v}</b></div>`;
    }).join('') + '</div>').join('');
  const ab = GAME.abilities[c.ability], wk = GAME.weaknesses[c.weak];
  q('.cc-extra').innerHTML = `<div class="ab">⚡ <b>${ab.name}</b> — ${ab.desc}</div><div class="wk">⚠ <b>${wk.name}</b> — ${wk.desc}</div>` +
    `<div>🎮 Lối chơi: ${GAME.styles[c.style].vn}</div>`;
  const fig = q('.cc-fig'), main = ctx;
  ctx = fig.getContext('2d');
  ctx.clearRect(0, 0, fig.width, fig.height);
  ctx.save();
  ctx.translate(42, fig.height - 6 - FLOOR * 0.85);
  ctx.scale(0.85, 0.85);
  drawPlayer(0, FLOOR, { look: c.look, gender: c.gender, outfit: defaultOutfit(c.gender, '#3d8bff') });
  ctx.restore();
  ctx = main;
}

function drawHero() {
  const hv = $('hero'), main = ctx;
  ctx = hv.getContext('2d');
  ctx.clearRect(0, 0, hv.width, hv.height);
  ctx.save();
  ctx.translate(hv.width / 2 - 40, hv.height - 20 - FLOOR * 3.2);
  ctx.scale(3.2, 3.2);
  drawPlayer(0, FLOOR, { look, gender: myGender(), outfit: myOutfit() });
  ctx.restore();
  ctx = main;
}

// ================== MENU CHÍNH: CHỌN CHẾ ĐỘ ==================
let online = false;   // đang ở phần chơi qua mạng (sảnh/phòng) hay chơi với Máy từ menu
const OPTS = {
  mode:   { label: 'THỂ THỨC', vals: [['1v1', '1 VS 1'], ['1v2', '1 VS 2']] },
  target: { label: 'SỐ ĐIỂM',  vals: [[21, '21'], [11, '11']] },
  level:  { label: 'ĐỘ KHÓ MÁY', vals: [['easy', 'DỄ'], ['normal', 'VỪA'], ['hard', 'KHÓ']] },
  fatigue: { label: 'THỂ LỰC',  vals: [[true, 'BẬT'], [false, 'TẮT']] },
  serve:  { label: 'GIAO CẦU TRƯỚC', vals: [['rand', 'NGẪU NHIÊN'], ['me', 'BẠN'], ['opp', 'ĐỐI THỦ']] },
};
const settings = { mode: '1v1', target: 21, level: 'normal', fatigue: true, serve: 'rand' };
try { Object.assign(settings, JSON.parse(localStorage.getItem('cl_set')) || {}); } catch {}
if (!OPTS.mode.vals.some(v => v[0] === settings.mode)) settings.mode = '1v1';   // thể thức đã bỏ (vd 2v2) -> về mặc định

// mỗi vòng gặp đối thủ có OVR trong khoảng [min, max]
const CUP = [
  { name: 'TỨ KẾT',    level: 'easy',   ovr: [0, 81] },
  { name: 'BÁN KẾT',   level: 'normal', ovr: [82, 87] },
  { name: 'CHUNG KẾT', level: 'hard',   ovr: [88, 99] },
];
const cupOpp = r => pick(GAME.chars.filter(c => c.id !== myChar && c.ovr >= CUP[r].ovr[0] && c.ovr <= CUP[r].ovr[1])).id;
let cup = null;   // { round } khi đang đá Cúp

function startSolo(o) {
  nameBox.onchange();
  online = false;
  send({ t: 'solo', mode: o.mode, target: o.target, level: o.level, venue: o.venue, opp: o.opp, oppOutfit: o.oppOutfit, fatigue: o.fatigue, serve: o.serve });
}
function startCup() { cup = { round: 0 }; startSolo({ ...settings, level: CUP[0].level, opp: cupOpp(0) }); }
function cupNext() {
  if (snap.winner !== 0) return send({ t: 'start' });                  // thua: đấu lại vòng đó
  if (cup.round === CUP.length - 1) { cup = null; return send({ t: 'leave' }); }  // vô địch: về menu
  cup.round++;
  send({ t: 'opp', char: cupOpp(cup.round) });
  send({ t: 'level', level: CUP[cup.round].level });
  send({ t: 'start' });
}
function cupOverText() {
  if (snap.winner !== 0) return 'Bị loại ở ' + CUP[cup.round].name + '... Bấm "Đấu lại vòng này"';
  return cup.round === CUP.length - 1 ? '🏆 VÔ ĐỊCH CÚP! 🏆' : 'Vào ' + CUP[cup.round + 1].name + '!';
}

const BACK = { label: '◀ QUAY LẠI', desc: 'Về menu chính.', back: true };
const MENU = {
  main: { items: [
    { label: 'GIAO HỮU', desc: 'Đấu một trận với Máy: thiết lập trận, chọn tay vợt, trang phục và sân thi đấu.', act: () => openWizard('rules', 'friendly') },
    { label: 'CÚP', dev: true, desc: 'Vượt qua 3 vòng Tứ kết – Bán kết – Chung kết, Máy mạnh dần qua từng vòng. Thua là phải đấu lại!', act: () => openWizard('rules', 'cup') },
    { label: 'TẬP LUYỆN', dev: true, desc: 'Làm quen tay: 1 vs 1 với Máy Dễ, chơi tới 11 điểm.', act: () => startSolo({ mode: '1v1', target: 11, level: 'easy' }) },
    { label: 'GIAO HỮU NGẪU NHIÊN', dev: true, desc: 'Thể thức, số điểm và độ khó đều do... số phận quyết định =))',
      act: () => startSolo({ ...Object.fromEntries(Object.entries(OPTS).map(([k, o]) => [k, pick(o.vals)[0]])), venue: pick(GAME.venues).id }) },
    { label: 'ĐẤU MẠNG', desc: 'Đấu 1 vs 1 với bạn bè qua mạng: tạo phòng rồi gửi mã, hoặc vào phòng bạn bè đã tạo.', go: 'online' },
    { label: 'HƯỚNG DẪN', desc: 'Xem cách điều khiển bằng chuột, bàn phím và cảm ứng.', go: 'help' },
  ]},
  online: { title: 'ĐẤU MẠNG', panel: 'pnOnline', items: [
    { label: 'TẠO PHÒNG', desc: () => `Tạo phòng mới (${settings.target} điểm, sân ${venueName(localStorage.getItem('cl_venue') || 'arena')}) rồi gửi mã cho bạn bè. Chủ phòng đổi được cài đặt trong phòng chờ.`, act: createRoom },
    { label: 'VÀO PHÒNG BẰNG MÃ', desc: 'Nhập mã phòng 4 chữ cái bạn bè gửi — hoặc bấm vào một phòng trong danh sách bên phải.', act: openCodeDlg },
    BACK,
  ]},
  edit: { title: 'CHỈNH SỬA', panel: 'pnEdit', items: [BACK] },
  help: { title: 'HƯỚNG DẪN', panel: 'pnHelp', items: [BACK] },
};
let menuAt = 'main', menuSel = 0;
const menuPos = {};   // nhớ mục đang chọn của từng màn

function openMenu(screen) {
  menuPos[menuAt] = menuSel;
  menuAt = screen; menuSel = menuPos[screen] || 0;
  const m = MENU[screen];
  closeWizard();
  $('mSub').textContent = m.title || '';
  $('mPanel').hidden = !m.panel;
  for (const id of ['pnEdit', 'pnHelp', 'pnOnline']) $(id).hidden = m.panel !== id;
  $('mRooms').hidden = screen !== 'main';
  onlineMenu(screen === 'online' || screen === 'main');   // menu chính cũng hiện danh sách phòng
  $('mList').classList.toggle('compact', m.items.length > 8);
  $('hero').hidden = !!m.panel;
  renderMenu(true);
}
function renderMenu(animate) {
  const ul = $('mList'), items = MENU[menuAt].items;
  ul.replaceChildren(...items.map((it, i) => {
    const li = document.createElement('li');
    if (animate) li.style.animationDelay = i * 0.04 + 's'; else li.style.animation = 'none';
    li.classList.toggle('on', i === menuSel);
    if (it.opt) {
      const o = OPTS[it.opt], v = o.vals.find(x => x[0] === settings[it.opt]) || o.vals[0];
      li.innerHTML = `${o.label}<span class="val">${v[1]}</span>`;
    } else li.textContent = it.label;
    if (it.dev) { li.classList.add('dev'); li.append(el('span', 'dev-tag', 'DEVELOPMENT')); }
    li.onmouseenter = () => { if (menuSel !== i) { menuSel = i; renderMenu(); SFX.play('tick'); } };
    li.onclick = () => { menuSel = i; menuPick(1); };
    return li;
  }));
  const span = document.createElement('span');   // tạo lại để dòng chữ chạy lại từ đầu
  const it = items[menuSel];
  span.textContent = (it.dev ? '🚧 ĐANG PHÁT TRIỂN — ' : '') + (typeof it.desc === 'function' ? it.desc() : it.desc);
  $('mDesc').replaceWith(span); span.id = 'mDesc';
}
function menuPick(dir) {
  const it = MENU[menuAt].items[menuSel];
  if (it.opt) {
    const vals = OPTS[it.opt].vals, i = vals.findIndex(x => x[0] === settings[it.opt]);
    settings[it.opt] = vals[(i + dir + vals.length) % vals.length][0];
    localStorage.setItem('cl_set', JSON.stringify(settings));
    renderMenu(); SFX.play('tick');
  } else if (dir === 1 && it.dev) {
    SFX.play('deny');
    // chế độ đang phát triển: chưa cho vào, chỉ rung nhẹ
    const li = $('mList').children[menuSel];
    li.classList.remove('shake'); void li.offsetWidth; li.classList.add('shake');
  } else if (dir === 1) {
    SFX.play(it.back ? 'back' : 'ok');
    if (it.back) openMenu('main');
    else if (it.go) openMenu(it.go);
    else it.act();
  }
}
addEventListener('keydown', e => {
  if ($('menu').style.display !== 'block' || document.querySelector('.nm-dlg:not([hidden])')) return;
  if (wiz) return wizKey(e);
  if (e.target.tagName === 'INPUT') { if (e.code === 'Escape' || e.code === 'Enter') e.target.blur(); return; }
  const n = MENU[menuAt].items.length;
  const k = e.code;
  if (k === 'ArrowUp' || k === 'KeyW') menuSel = (menuSel + n - 1) % n;
  else if (k === 'ArrowDown' || k === 'KeyS') menuSel = (menuSel + 1) % n;
  else if (k === 'ArrowLeft' || k === 'KeyA') return e.preventDefault(), menuPick(-1);
  else if (k === 'ArrowRight' || k === 'KeyD') return e.preventDefault(), MENU[menuAt].items[menuSel].opt && menuPick(1);
  else if (k === 'Enter' || k === 'Space' || k === 'KeyZ') { if (!e.repeat) menuPick(1); return e.preventDefault(); }
  else if (k === 'Escape' || k === 'Backspace') { if (menuAt !== 'main') { SFX.play('back'); openMenu('main'); } return e.preventDefault(); }
  else return;
  e.preventDefault();
  SFX.play('tick');
  renderMenu();
});
