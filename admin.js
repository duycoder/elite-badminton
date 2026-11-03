// Theo dõi người truy cập: trang /admin (cần mật khẩu) xem ai đang online, đang làm gì, lịch sử ra/vào & kết quả trận.
// Mật khẩu (passkey), theo thứ tự ưu tiên:
//   1. biến môi trường ADMIN_KEY (dùng khi deploy, vd Render → Environment)
//   2. file .admin-key cạnh server (chỉ ở máy bạn, đã cho vào .gitignore — KHÔNG commit)
//   3. không có cả hai: mỗi lần chạy tạo một UUID ngẫu nhiên mới (in ra console)
// Dữ liệu chỉ lưu trong bộ nhớ: khởi động lại server là mất.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const readKeyFile = () => { try { return fs.readFileSync(path.join(__dirname, '.admin-key'), 'utf8').trim(); } catch { return ''; } };
const KEY_FROM = process.env.ADMIN_KEY ? 'env' : readKeyFile() ? 'file' : 'random';
const KEY = (process.env.ADMIN_KEY || '').trim() || readKeyFile() || crypto.randomUUID();
const MAX_EVENTS = 500;     // giữ tối đa bấy nhiêu dòng lịch sử
const MAX_GONE = 200;       // giữ bấy nhiêu người đã rời đi
const startedAt = Date.now();
const visitors = new Map(); // id kết nối -> thông tin
const events = [];
const totals = { visits: 0, matches: 0, ips: new Set() };

// ---------- ghi nhận từ server game ----------
function ipOf(req) {
  // sau proxy (Render...) IP thật nằm ở x-forwarded-for
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return (fwd || req.socket.remoteAddress || '?').replace(/^::ffff:/, '');
}
function device(ua = '') {
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '?';
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '?';
  return { os, browser: br, mobile: /Mobi|Android|iPhone|iPad/.test(ua) };
}
function log(v, text) {
  events.push({ t: Date.now(), id: v.id, name: v.name, ip: v.ip, text });
  if (events.length > MAX_EVENTS) events.shift();
}
function connect(id, req) {
  const v = { id, ip: ipOf(req), ...device(req.headers['user-agent']), name: null, char: null, since: Date.now(), last: Date.now(), status: 'Đang tải game', room: null, online: true, matches: 0 };
  visitors.set(id, v);
  totals.visits++; totals.ips.add(v.ip);
  log(v, 'Truy cập');
}
function hello(id, name, char) {
  const v = visitors.get(id); if (!v) return;
  if (v.name && v.name !== name) log(v, `Đổi tên: ${v.name} → ${name}`);
  v.name = name; v.char = char; v.last = Date.now();
  if (v.status === 'Đang tải game') v.status = 'Menu';
}
// status: đang làm gì (hiện ở bảng online) · text: có thì ghi thêm vào lịch sử
function activity(id, status, text, room) {
  const v = visitors.get(id); if (!v) return;
  v.status = status; v.last = Date.now();
  if (room !== undefined) v.room = room;
  if (text) log(v, text);
}
function matchOver(id, text) {
  const v = visitors.get(id); if (!v) return;
  v.matches++; totals.matches++;
  log(v, text);
}
function disconnect(id) {
  const v = visitors.get(id); if (!v) return;
  v.online = false; v.room = null; v.left = Date.now(); v.status = 'Đã rời';
  log(v, `Thoát (ở lại ${dur(v.left - v.since)})`);
  const gone = [...visitors.values()].filter(x => !x.online);
  if (gone.length > MAX_GONE) visitors.delete(gone[0].id);
}
const dur = ms => { const s = Math.round(ms / 1000); return s < 60 ? s + ' giây' : s < 3600 ? Math.round(s / 60) + ' phút' : (s / 3600).toFixed(1) + ' giờ'; };

// ---------- trang /admin ----------
const fails = new Map();   // ip -> { n, t } : chặn đoán mật khẩu
function authed(req) {
  const ip = ipOf(req), f = fails.get(ip);
  if (f && f.n >= 10 && Date.now() - f.t < 15 * 60e3) return 'locked';
  const got = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const h = s => crypto.createHash('sha256').update(s).digest();
  if (crypto.timingSafeEqual(h(got), h(KEY))) { fails.delete(ip); return true; }
  fails.set(ip, { n: (f && Date.now() - f.t < 15 * 60e3 ? f.n : 0) + 1, t: Date.now() });
  return false;
}
function snapshot() {
  const list = [...visitors.values()].map(v => ({
    id: v.id, ip: v.ip, os: v.os, browser: v.browser, mobile: v.mobile, name: v.name, char: v.char,
    since: v.since, last: v.last, left: v.left || null, online: v.online, matches: v.matches,
    status: v.status + (v.room && v.room.state === 'playing' ? `  ${v.room.score[0]}–${v.room.score[1]}` : ''),
  }));
  return {
    now: Date.now(), startedAt,
    totals: { visits: totals.visits, uniqueIps: totals.ips.size, matches: totals.matches, online: list.filter(v => v.online).length },
    online: list.filter(v => v.online).reverse(),
    gone: list.filter(v => !v.online).reverse().slice(0, 50),
    events: events.slice(-200).reverse(),
  };
}
// trả true nếu đã xử lý request (đường dẫn /admin...)
function handle(req, res, rel) {
  if (rel === '/admin' || rel === '/admin/') {
    fs.readFile(path.join(__dirname, 'admin.html'), (err, data) => {
      res.writeHead(err ? 500 : 200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
      res.end(err ? 'Thiếu admin.html' : data);
    });
    return true;
  }
  if (rel === '/admin/api') {
    const ok = authed(req);
    const head = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
    if (ok === 'locked') { res.writeHead(429, head); res.end('{"error":"Sai quá nhiều lần, thử lại sau 15 phút"}'); }
    else if (!ok) { res.writeHead(401, head); res.end('{"error":"Sai mật khẩu"}'); }
    else { res.writeHead(200, head); res.end(JSON.stringify(snapshot())); }
    return true;
  }
  return false;
}

module.exports = { KEY, KEY_FROM, connect, hello, activity, matchOver, disconnect, handle };
