// ================== ĐẤU MẠNG: SẢNH (trong menu) → PHÒNG CHỜ ==================
nameBox.onchange = () => { localStorage.setItem('cl_name', nameBox.value); send({ t: 'hello', name: nameBox.value, look, char: myChar, outfit: myOutfit() }); drawPreview(); };
const LEVEL_NAME = { easy: 'Dễ', normal: 'Vừa', hard: 'Khó' };
let pendingJoin = new URLSearchParams(location.search).get('room');   // mở bằng link mời: vào phòng ngay sau khi có tên
let listTimer = 0;

// thông báo nhỏ nổi ở cuối màn hình
let toastTimer = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  t.classList.remove('in'); void t.offsetWidth; t.classList.add('in');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

// sảnh ĐẤU MẠNG trong menu: danh sách phòng đang chờ, tự làm mới mỗi 3 giây khi đang mở
function onlineMenu(on) {
  clearInterval(listTimer);
  if (on) { send({ t: 'list' }); listTimer = setInterval(() => send({ t: 'list' }), 3000); }
}
function createRoom() {
  nameBox.onchange(); online = true;
  send({ t: 'create', target: settings.target, venue: localStorage.getItem('cl_venue') || 'arena', fatigue: settings.fatigue });
}
function joinRoom(code) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return;
  nameBox.onchange(); online = true;
  send({ t: 'join', code });
}
const venueName = id => (GAME && GAME.venues.find(v => v.id === id) || { name: id }).name;
function roomRows(list) {
  return list.map(r => {
    const row = el('button', 'ol-room');
    row.type = 'button';
    const host = el('span', 'ol-host'); host.textContent = r.host;   // tên do người chơi gõ -> textContent
    row.append(el('b', 'ol-code', r.code), host, el('small', null, `${r.target} điểm · ${venueName(r.venue)}`), el('span', 'ol-go', 'VÀO ▶'));
    row.onclick = () => { SFX.play('ok'); joinRoom(r.code); };
    return row;
  });
}
// cùng một danh sách hiện ở 2 nơi: menu chính (tối đa 5 phòng) và sảnh ĐẤU MẠNG
function showRooms(list) {
  const empty = html => el('div', 'ol-empty', html);
  $('olRooms').replaceChildren(...(list.length ? roomRows(list) : [empty('Chưa có phòng nào đang chờ.<br>Tạo phòng rồi gửi mã cho bạn bè nhé!')]));
  $('mrList').replaceChildren(...(list.length ? roomRows(list.slice(0, 5)) : [empty('Chưa có ai mở phòng — tạo một phòng rồi rủ bạn bè vào đấu!')]));
  $('mrCount').textContent = list.length ? list.length + ' phòng' : '';
}
$('mrCreate').onclick = () => { SFX.play('ok'); createRoom(); };
$('mrCode').onclick = () => { SFX.play('ok'); openCodeDlg(); };

// hộp nhập mã phòng
function openCodeDlg() {
  $('cdInput').value = ''; $('cdErr').textContent = '';
  $('codeDlg').hidden = false;
  setTimeout(() => $('cdInput').focus(), 50);
}
$('codeDlg').addEventListener('submit', e => {
  e.preventDefault();
  const v = $('cdInput').value.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(v)) { $('cdErr').textContent = 'Mã phòng gồm 4 chữ cái, VD: ABCD'; return $('cdInput').focus(); }
  $('codeDlg').hidden = true;
  SFX.play('ok');
  joinRoom(v);
});
$('cdInput').addEventListener('input', () => { $('cdInput').value = $('cdInput').value.toUpperCase().replace(/[^A-Z]/g, ''); });
const closeCodeDlg = () => { $('codeDlg').hidden = true; SFX.play('back'); };
$('cdCancel').onclick = closeCodeDlg;
$('cdInput').addEventListener('keydown', e => { if (e.code === 'Escape') closeCodeDlg(); });

// ================== PHÒNG CHỜ (PES: 2 thẻ tuyển thủ đối mặt) ==================
const inviteLink = () => location.origin + '/?room=' + room.code;
const mySeat = () => room && room.slots.flat().find(s => s && s.id === myId);
const isHost = () => room && room.host === myId;
const roomFull = () => room && room.slots.every(t => t.every(s => s && !s.bot));
// thứ tự đổi tay vợt bằng ◀ ▶: OVR cao xuống thấp
const charOrder = () => [...GAME.chars].sort((a, b) => b.ovr - a.ovr || a.name.localeCompare(b.name));
function cycleChar(d) {
  if (!room || room.state !== 'lobby' || !GAME) return;
  const list = charOrder(), i = Math.max(0, list.findIndex(c => c.id === myChar));
  myChar = list[(i + d + list.length) % list.length].id;
  localStorage.setItem('cl_char', myChar);
  SFX.play('tick');
  send({ t: 'char', char: myChar, outfit: myOutfit() });
}
// cài đặt trận: chỉ chủ phòng đổi được
const RCFG = [
  { key: 'target', label: 'SỐ ĐIỂM', vals: () => [[11, '11'], [21, '21']] },
  { key: 'venue', label: 'SÂN', vals: () => GAME.venues.map(v => [v.id, v.name]) },
  { key: 'fatigue', label: 'THỂ LỰC', vals: () => [[true, 'BẬT'], [false, 'TẮT']] },
];
function cycleCfg(o, d) {
  const vals = o.vals(), i = vals.findIndex(v => v[0] === room[o.key]);
  SFX.play('tick');
  send({ t: 'cfg', [o.key]: vals[(i + d + vals.length) % vals.length][0] });
}

function roomCard(t) {
  const s = room.slots[t][0], card = $('rc' + t), me = s && s.id === myId;
  card.className = 'rm-card ' + (t === 0 ? 'b' : 'r') + (me ? ' me' : '') + (s ? '' : ' empty');
  if (!s) {
    card.replaceChildren(
      el('div', 'rm-side', t === 0 ? 'ĐỘI XANH' : 'ĐỘI ĐỎ'),
      el('div', 'rm-wait', '<span class="rm-dots">ĐANG CHỜ ĐỐI THỦ</span>'),
      el('div', 'rm-hint', `Gửi mã <b>${room.code}</b> hoặc link mời cho bạn bè`));
    return;
  }
  const c = charOf(s.char) || {};
  const tags = el('div', 'rm-tags');
  if (s.id === room.host) tags.append(el('span', 'rm-tag host', 'CHỦ PHÒNG'));
  if (me) tags.append(el('span', 'rm-tag me', 'BẠN'));
  const name = el('div', 'rm-name'); name.textContent = s.name;
  const fig = el('canvas', 'rm-fig'); fig.width = 190; fig.height = 250;
  const info = el('div', 'rm-char');
  const style = GAME.styles[c.style], ab = GAME.abilities[c.ability];
  info.append(el('b', 'rm-ovr', c.ovr), el('div', 'rm-cname', `${c.name || ''} <small>${c.country || ''}</small>`),
    el('div', 'rm-meta', [style && (style.vn || style.name), ab && '★ ' + ab.name].filter(Boolean).join(' · ')));
  const pickRow = el('div', 'rm-pick');
  if (me && room.state === 'lobby') {
    const prev = el('button', 'rm-arrow', '◀'), next = el('button', 'rm-arrow', '▶');
    prev.type = next.type = 'button';
    prev.title = next.title = 'Đổi tay vợt (◀ ▶)';
    prev.onclick = () => cycleChar(-1); next.onclick = () => cycleChar(1);
    pickRow.append(prev, info, next);
  } else pickRow.append(info);
  card.replaceChildren(el('div', 'rm-side', t === 0 ? 'ĐỘI XANH' : 'ĐỘI ĐỎ'), tags, fig, name, pickRow);
  drawFigure(fig, 1.3, { look: s.look || c.look, gender: s.gender, outfit: s.outfit, team: t });
}
function showRoom() {
  if (room.solo) return;
  if (room.state === 'lobby') show('room');
  history.replaceState(null, '', '?room=' + room.code);
  $('rcode').textContent = room.code;
  $('rlink').textContent = inviteLink();
  roomCard(0); roomCard(1);
  // cài đặt
  const host = isHost();
  $('rcfg').replaceChildren(...RCFG.map(o => {
    const v = o.vals().find(x => x[0] === room[o.key]) || ['', '?'];
    const row = el('div', 'rm-opt' + (host ? ' edit' : ''));
    const val = el('span', 'rm-val'); val.textContent = v[1];
    row.append(el('span', 'rm-lbl', o.label));
    if (host) {
      const a = el('button', 'rm-arrow sm', '◀'), b = el('button', 'rm-arrow sm', '▶');
      a.type = b.type = 'button';
      a.onclick = () => cycleCfg(o, -1); b.onclick = () => cycleCfg(o, 1);
      row.append(a, val, b);
    } else row.append(val);
    return row;
  }));
  // nút bắt đầu
  const full = roomFull();
  $('start').hidden = !host;
  $('start').disabled = !full;
  $('waithost').textContent = !full ? (host ? 'Chờ đối thủ vào phòng…' : 'Chờ người chơi…') : host ? 'Đủ người — bấm BẮT ĐẦU!' : 'Chờ chủ phòng bấm bắt đầu…';
}

$('rcopy').onclick = async () => {
  try { await navigator.clipboard.writeText(inviteLink()); toast('Đã sao chép link mời: ' + inviteLink()); }
  catch { getSelection().selectAllChildren($('rlink')); toast('Bôi đen sẵn rồi — bấm Ctrl+C để sao chép'); }
  SFX.play('ok');
};
$('leave1').onclick = $('leave2').onclick = () => { SFX.play('back'); send({ t: 'leave' }); };
$('start').onclick = () => { if (!$('start').disabled) { SFX.play('ok'); send({ t: 'start' }); } };
$('again').onclick = () => cup ? cupNext() : send({ t: 'start' });
addEventListener('keydown', e => {
  if ($('room').style.display !== 'block' || e.target.tagName === 'INPUT' || !room) return;
  const k = e.code;
  if (k === 'ArrowLeft' || k === 'KeyA') cycleChar(-1);
  else if (k === 'ArrowRight' || k === 'KeyD') cycleChar(1);
  else if (k === 'Enter' && !e.repeat) $('start').click();
  else if (k === 'Escape' || k === 'Backspace') $('leave1').click();
  else return;
  e.preventDefault();
});

function updateHud() {
  $('s0').textContent = snap.score[0];
  $('s1').textContent = snap.score[1];
  const over = snap.state === 'over', host = room && room.host === myId;
  // hết trận: chủ phòng bấm chơi lại; đấu mạng thì người kia thấy nút mờ "chờ chủ phòng"
  $('again').style.display = over && (host || online) ? '' : 'none';
  $('again').disabled = !host;
  $('again').textContent = !host ? 'Chờ chủ phòng chơi lại…' : !cup || !over ? 'Chơi lại' : snap.winner !== 0 ? 'Đấu lại vòng này'
    : cup.round < CUP.length - 1 ? 'Vòng tiếp: ' + CUP[cup.round + 1].name + ' ▶' : '🏆 Về menu';
  updateStamina();
}
