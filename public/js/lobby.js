// ================== SẢNH ==================
document.querySelectorAll('.mode').forEach(b => b.onclick = () => {
  document.querySelectorAll('.mode').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); mode = b.dataset.m;
});
nameBox.onchange = () => { localStorage.setItem('cl_name', nameBox.value); send({ t: 'hello', name: nameBox.value, look, char: myChar, outfit: myOutfit() }); drawPreview(); };
const LEVEL_NAME = { easy: 'Dễ', normal: 'Vừa', hard: 'Khó' };
const levelBox = $('level');
levelBox.value = localStorage.getItem('cl_level') || 'normal';
levelBox.onchange = () => localStorage.setItem('cl_level', levelBox.value);
const newGame = t => { nameBox.onchange(); send({ t, mode, target: +$('target').value, level: levelBox.value }); };
$('create').onclick = () => newGame('create');
$('solo').onclick = () => newGame('solo');
$('rlevelsel').onchange = () => send({ t: 'level', level: $('rlevelsel').value });
$('join').onclick = () => { nameBox.onchange(); send({ t: 'join', code: $('code').value.trim() }); };
$('refresh').onclick = () => send({ t: 'list' });
$('leave1').onclick = $('leave2').onclick = () => send({ t: 'leave' });
$('start').onclick = () => send({ t: 'start' });
$('again').onclick = () => cup ? cupNext() : send({ t: 'start' });
$('toMenu').onclick = () => { online = false; show('menu'); };

function showRooms(list) {
  const el = $('rooms');
  el.innerHTML = list.length ? '' : '<p class="mute">Chưa có phòng nào. Hãy tạo phòng!</p>';
  for (const r of list) {
    const d = document.createElement('div');
    d.innerHTML = `<span><b>${r.code}</b> · ${r.mode} · ${r.humans} người · Máy ${LEVEL_NAME[r.level]} · ${r.state === 'lobby' ? 'đang chờ' : 'đang chơi'}</span>`;
    const b = document.createElement('button'); b.textContent = 'Vào';
    b.onclick = () => { nameBox.onchange(); send({ t: 'join', code: r.code }); };
    d.appendChild(b); el.appendChild(d);
  }
}

// ================== PHÒNG CHỜ ==================
function showRoom() {
  const isHost = room.host === myId;
  if (room.state === 'lobby') show('room');
  if (!room.solo) history.replaceState(null, '', '?room=' + room.code);
  $('rcode').textContent = room.code;
  $('rmode').textContent = room.mode;
  $('rtarget').textContent = room.target;
  $('rlevel').textContent = LEVEL_NAME[room.level];
  $('rlevelsel').value = room.level;
  $('rlink').textContent = location.origin + '/?room=' + room.code;
  $('start').style.display = $('rlevelsel').style.display = isHost ? '' : 'none';
  $('again').style.display = isHost && room.state === 'over' ? '' : 'none';
  $('waithost').textContent = isHost ? '' : 'Chờ chủ phòng bấm bắt đầu...';
  for (let t = 0; t < 2; t++) {
    const box = $('t' + t); box.innerHTML = '';
    room.slots[t].forEach((s, i) => {
      const d = document.createElement('div');
      d.className = 'slot' + (s && s.id === myId ? ' me' : '');
      const label = document.createElement('span');
      label.textContent = s ? (s.bot ? '🤖 ' : '🙂 ') + s.name + (s.id === myId ? ' (bạn)' : '') : '— trống —';
      d.appendChild(label);
      const btns = document.createElement('span');
      if (!s || s.bot) {
        const b = document.createElement('button'); b.textContent = 'Ngồi đây';
        b.onclick = () => send({ t: 'seat', team: t, idx: i }); btns.appendChild(b);
        if (isHost) {
          const b2 = document.createElement('button'); b2.textContent = s ? 'Bỏ máy' : '+ Máy';
          b2.style.marginLeft = '6px';
          b2.onclick = () => send({ t: 'bot', team: t, idx: i }); btns.appendChild(b2);
        }
      }
      d.appendChild(btns);
      box.appendChild(d);
    });
  }
}

function updateHud() {
  $('s0').textContent = snap.score[0];
  $('s1').textContent = snap.score[1];
  const over = snap.state === 'over';
  $('again').style.display = room && room.host === myId && over ? '' : 'none';
  $('again').textContent = !cup || !over ? 'Chơi lại' : snap.winner !== 0 ? 'Đấu lại vòng này'
    : cup.round < CUP.length - 1 ? 'Vòng tiếp: ' + CUP[cup.round + 1].name + ' ▶' : '🏆 Về menu';
  updateStamina();
}
