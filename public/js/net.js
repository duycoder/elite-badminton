// ================== KẾT NỐI SERVER ==================
const $ = id => document.getElementById(id);
let ws, myId = null, room = null, snap = null, mode = '1v1';
let view = null;   // thông tin phòng đang vẽ (cả trận demo ở màn tiêu đề): sân, ghế, trang phục
const nameBox = $('name');
// lần đầu vào game (hoặc vẫn đang dùng tên ngẫu nhiên 'Người ###' do bản cũ tự lưu): hiện màn nhập tên trước menu
const savedName = localStorage.getItem('cl_name') || '';
let needName = !savedName.trim() || /^Người \d{3}$/.test(savedName);
nameBox.value = localStorage.getItem('cl_name') || ('Người ' + (Math.random() * 900 + 100 | 0));

function connect() {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => {
    send({ t: 'hello', name: nameBox.value, look, char: myChar, outfit: myOutfit() });
    if (phase === 'title') send({ t: 'demo' });
  };
  ws.onmessage = e => onMsg(JSON.parse(e.data));
  ws.onclose = () => { toast('Mất kết nối server. Đang thử lại...'); setTimeout(connect, 1500); };
}
function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }

function onMsg(m) {
  if (m.t === 'hi') {
    myId = m.id; GAME = m.game;
    // kết nối lại sau khi rớt mạng: server đã cho mình rời phòng cũ
    if (room) { room = view = snap = null; updateLoading(null); show('menu'); if (online) openMenu('online'); toast('Đã rớt khỏi phòng do mất kết nối'); }
    if (!charOf(myChar)) { myChar = GAME.defaultChar; nameBox.onchange(); }
    showRooms(m.rooms); drawPreview();
    if (pendingJoin && !needName) { joinRoom(pendingJoin); pendingJoin = null; }   // link mời
  }
  else if (m.t === 'list') showRooms(m.rooms);
  else if (m.t === 'err') { toast(m.msg); SFX.play('deny'); if (!room && pendingJoin === null) history.replaceState(null, '', location.pathname); }
  else if (phase === 'title') { if (m.t === 'st') { snap = m; playFx(m, 0.4); } else if (m.t === 'room') view = m; }   // đang xem demo: chỉ cần vẽ
  else if (m.t === 'room') { room = view = m; showRoom(); }
  else if (m.t === 'st') { if (!room) return; snap = m; playFx(m, 1); if (m.state !== 'lobby') show('game'); updateHud(); updateLoading(m.load); }
  else if (m.t === 'left') { SFX.ambience(false); SFX.charge(null); room = view = null; snap = null; updateLoading(null); cup = null; show('menu'); if (online) openMenu('online'); history.replaceState(null, '', location.pathname); }
}

function show(which) {
  if (which === 'menu') openMenu('main');
  for (const s of ['menu', 'room', 'game']) $(s).style.display = s === which ? 'block' : 'none';
  SFX.ambience(which === 'game'); }
