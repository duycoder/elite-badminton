// ================== GIỚI THIỆU → TIÊU ĐỀ (DEMO) → MENU ==================
const AUTHOR = 'DUYNN';   // đổi tên người làm ở đây
const SPLASH = [
  `<small>Một sản phẩm của</small><big>${AUTHOR}</big>`,
  `<dl class="sp-credits">
     <dt>Ý tưởng &amp; Lập trình</dt><dd>${AUTHOR}</dd>
     <dt>Vật lý cầu &amp; AI Máy</dt><dd>${AUTHOR}</dd>
     <dt>Đồ hoạ</dt><dd>Canvas 2D thuần</dd>
     <dt>Âm thanh</dt><dd>Web Audio tổng hợp</dd>
     <dt>Cảm ơn</dt><dd>Bạn — người chơi!</dd>
   </dl>`,
  `<div class="sp-logo">🏸 CẦU LÔNG ONLINE</div><small style="margin-top:14px">1 vs 1 · 1 vs 2</small>`,
];
let phase = new URLSearchParams(location.search).get('room') ? 'menu' : 'splash';   // link mời: vào thẳng menu
let phaseAt = 0, splashTimer = 0;

function setPhase(p) {
  phase = p; phaseAt = performance.now();
  $('splash').hidden = p !== 'splash';
  $('title').hidden = p !== 'title';
}
function playSplash(i) {
  if (phase !== 'splash') return;
  if (i >= SPLASH.length) return goTitle();
  const card = document.createElement('div');
  card.className = 'sp-card'; card.innerHTML = SPLASH[i];
  $('spStage').replaceChildren(card);
  splashTimer = setTimeout(() => playSplash(i + 1), 2600);
}
function goTitle() {
  clearTimeout(splashTimer);
  setPhase('title');
  snap = null; smooth.p.length = 0;
  $('tdemo').appendChild(cv);
  send({ t: 'demo' });
}
// ---------- tên tuyển thủ (lưu ở localStorage 'cl_name') ----------
function showMyName() { $('meName').textContent = nameBox.value; }
function openNameDlg(first) {
  $('nameDlg').dataset.first = first ? '1' : '';
  $('nameDlg').classList.toggle('first', !!first);   // lần đầu: cả màn hình riêng, ô nhập nổi giữa
  $('nmCancel').hidden = first;   // lần đầu bắt buộc phải đặt tên
  $('nmInput').value = first ? '' : nameBox.value;
  $('nmErr').textContent = '';
  $('nameDlg').hidden = false;
  setTimeout(() => $('nmInput').focus(), 50);
}
function closeNameDlg() { $('nameDlg').hidden = true; }
$('nameDlg').addEventListener('submit', e => {
  e.preventDefault();
  const v = $('nmInput').value.replace(/\s+/g, ' ').trim();
  if (!v) { $('nmErr').textContent = 'Nhập tên đã nhé!'; return $('nmInput').focus(); }
  nameBox.value = v.slice(0, 12);
  nameBox.onchange();   // lưu cl_name + báo server
  needName = false;
  showMyName();
  closeNameDlg();
  SFX.play('ok');
});
$('nmCancel').onclick = () => { closeNameDlg(); SFX.play('back'); };
$('nmInput').addEventListener('keydown', e => { if (e.code === 'Escape' && !$('nameDlg').dataset.first) { closeNameDlg(); SFX.play('back'); } });
$('meChip').onclick = () => { SFX.play('ok'); openNameDlg(false); };
showMyName();

function goMenu() {
  setPhase('menu');
  snap = null; smooth.p.length = 0;
  $('game').insertBefore(cv, $('game').querySelector('.keys'));
  send({ t: 'leave' });
  show('menu');
  drawPreview();
  if (needName) openNameDlg(true);
}
function skip(e) {
  if (e.repeat || performance.now() - phaseAt < 600) return;
  if (phase === 'splash') goTitle();
  else if (phase === 'title') goMenu();
}
addEventListener('keydown', skip);
$('splash').onclick = $('title').onclick = skip;

setPhase(phase);
if (phase === 'splash') playSplash(0);
else { online = true; show('lobby'); }   // link mời: vào thẳng phần nối mạng
drawPreview();
connect();
draw();
