// Cầu Lông Online - server (chỉ dùng Node có sẵn, không cần npm install)
// Chạy: node server.js   rồi mở http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const track = require('./admin');   // trang theo dõi /admin
const { CHARACTERS, BY_ID, DEFAULT_CHAR, OUTFIT_STYLES, VENUES, VENUE_BY_ID, makeMods, publicData } = require('./characters');

// ================== HẰNG SỐ SÂN & VẬT LÝ ==================
const W = 1000, FLOOR = 440, NET_X = 500, NET_TOP = 300;
const IN_MIN = 30, IN_MAX = 970;          // vạch biên ngoài
const G_SHUTTLE = 900, DRAG = 1.3;         // cầu: trọng lực + lực cản không khí
const G_PLAYER = 1800, RUN = 380, JUMP = 640;
const REACH = 72;                          // bán kính vợt với tới
const SWING_TIME = 0.22, SWING_CD = 0.35;
const SHOT_BUF = { clear: 0.35, drop: 0.35, smash: 0.65 };  // bấm sớm: chờ cầu tới tầm rồi tự vung
const TICK = 1 / 60;
const INTRO_TIME = 4.5;                    // màn hình loading trước trận (giây)
// Thể lực (1 = đầy): tốn theo quãng đường chạy, mỗi cú đánh, mỗi cú nhảy / nhảy đập.
// Mệt tích luỹ: sau mỗi điểm chỉ hồi một ít, và mỗi lần mất sức thì mức trần (cap) cũng tụt một phần — không hồi lại trong trận.
const STAMINA = {
  perKm: 0.08,      // mỗi 1000px chạy
  hit: 0.015,       // mỗi cú đánh (phông, bỏ nhỏ)
  jump: 0.03,       // mỗi lần bật nhảy
  smash: 0.06,      // thêm cho mỗi cú đập
  restPoint: 0.1,   // hồi sau mỗi điểm (nhân hệ số Hồi vị trí)
  idle: 0.006,      // hồi mỗi giây khi đứng yên
  wear: 0.2,        // phần sức mất đi bị trừ luôn vào mức trần
  minCap: 0.5,      // mức trần thấp nhất
  exhausted: 0.12,  // dưới mức này: KIỆT SỨC, không nhảy được
};
const WIND_MAX = 70;                       // sân ngoài trời: gia tốc gió ngang tối đa (px/s²)

const MODES = {
  '1v1': [1, 1],
  '1v2': [1, 2],
};

// Độ khó của "Máy"
const LEVELS = {
  easy:   { name: 'Dễ',  speed: 0.72, err: 90, think: 0.35, miss: 1.8, base: 0.12, jump: 0.03, smart: 0 },
  normal: { name: 'Vừa', speed: 0.88, err: 50, think: 0.25, miss: 1,   base: 0.03, jump: 0.08, smart: 0.3 },
  hard:   { name: 'Khó', speed: 0.98, err: 18, think: 0.15, miss: 0.4, base: 0.01, jump: 0.25, smart: 0.8 },
};

// kiểm tra dữ liệu ngoại hình / trang phục client gửi lên
const hex = c => /^#[0-9a-f]{6}$/i.test(c) ? c : null;
const cleanOutfit = o => o && OUTFIT_STYLES.has(o.s) && hex(o.c1) && hex(o.c2) ? { s: o.s, c1: o.c1, c2: o.c2 } : null;

// Thời gian bay (s) để cầu rơi từ y0 với vận tốc dọc vy xuống mặt sân
function flightTime(y0, vy) {
  let y = y0, t = 0;
  while (y < FLOOR && t < 6) {
    vy += G_SHUTTLE * TICK; vy -= vy * DRAG * TICK;
    y += vy * TICK; t += TICK;
  }
  return t;
}
// Độ cao của cầu khi bay tới lưới (mô phỏng trước)
function yAtNet(s) {
  let x = s.x, y = s.y, vx = s.vx, vy = s.vy;
  for (let k = 0; k < 300; k++) {
    vy += G_SHUTTLE * TICK; vx -= vx * DRAG * TICK; vy -= vy * DRAG * TICK;
    const px = x; x += vx * TICK; y += vy * TICK;
    if ((px - NET_X) * (x - NET_X) <= 0) return y;
    if (y >= FLOOR) return FLOOR;
  }
  return FLOOR;
}
// Vận tốc ngang cần để cầu rơi đúng điểm targetX
function vxFor(x0, targetX, T) {
  return (targetX - x0) * DRAG / (1 - Math.exp(-DRAG * T));
}

// ================== PHÒNG CHƠI ==================
class Room {
  constructor(code, mode, target, hostId, level = 'normal', venue = 'arena') {
    this.code = code;
    this.mode = mode;
    this.target = target;          // 11 hoặc 21 điểm
    this.level = LEVELS[level] ? level : 'normal';
    this.solo = false;             // phòng chơi một mình với máy (không hiện trong danh sách)
    this.venue = VENUE_BY_ID[venue] ? venue : 'arena';
    this.wind = 0;
    this.fatigue = true;           // tắt = không bao giờ mệt
    this.firstServe = 'rand';      // bên giao cầu điểm đầu: rand | me (đội 0) | opp (đội 1)
    this.hostId = hostId;
    this.clients = new Map();      // id -> {send, name}
    const [a, b] = MODES[mode];
    // slots[team][i] = {id|null, name, bot}
    this.slots = [Array.from({ length: a }, () => null), Array.from({ length: b }, () => null)];
    this.state = 'lobby';          // lobby | playing | over
    this.players = [];
    this.score = [0, 0];
    this.shuttle = null;
    this.msg = '';
    this.msgTime = 0;
    this.fx = [];                  // sự kiện âm thanh trong tick này: [loại, x, cường độ]
  }

  // ---------- quản lý người chơi ----------
  addClient(id, name, send, look = null, char = DEFAULT_CHAR, outfit = null) {
    this.clients.set(id, { name, send, look, outfit, char: BY_ID[char] ? char : DEFAULT_CHAR });
    this.autoSeat(id);
  }
  autoSeat(id) {
    if (this.findSeat(id)) return;
    // ngồi vào đội còn ít người hơn
    const order = [0, 1].sort((t1, t2) => this.freeCount(t2) - this.freeCount(t1));
    for (const t of order) {
      const i = this.slots[t].findIndex(s => s === null || s.bot);
      if (i >= 0) { this.seat(id, t, i); return; }
    }
  }
  freeCount(t) { return this.slots[t].filter(s => s === null || s.bot).length; }
  findSeat(id) {
    for (let t = 0; t < 2; t++) for (let i = 0; i < this.slots[t].length; i++)
      if (this.slots[t][i] && this.slots[t][i].id === id) return { t, i };
    return null;
  }
  seat(id, t, i) {
    const cur = this.slots[t][i];
    if (cur && !cur.bot) return false;
    const old = this.findSeat(id);
    if (old) this.slots[old.t][old.i] = null;
    const { name, look, char, outfit } = this.clients.get(id);
    this.slots[t][i] = { id, name, bot: false, look, char, outfit };
    const p = this.players.find(p => p.team === t && p.idx === i);
    if (p) { Object.assign(p, this.playerInfo(this.slots[t][i])); p.input = {}; }
    if (old && this.state !== 'lobby') this.makeBot(old.t, old.i);
    return true;
  }
  makeBot(t, i, charId, outfit = null) {
    // máy lấy nhân vật được chỉ định, hoặc ngẫu nhiên một nhân vật chưa ai dùng trong phòng
    let c = BY_ID[charId];
    if (!c) {
      const used = new Set(this.slots.flat().filter(Boolean).map(s => s.char));
      const pool = CHARACTERS.filter(c => !used.has(c.id));
      c = (pool.length ? pool : CHARACTERS)[Math.random() * (pool.length || CHARACTERS.length) | 0];
    }
    // máy mặc đồ theo màu đội
    const col = t === 0 ? '#3d8bff' : '#ff5a5a';
    outfit = outfit || (c.gender === 'f' ? { s: 'skirt', c1: col, c2: col } : { s: 'tee', c1: col, c2: '#222833' });
    this.slots[t][i] = { id: null, name: c.name, bot: true, look: c.look, char: c.id, outfit };
    const p = this.players.find(p => p.team === t && p.idx === i);
    if (p) Object.assign(p, this.playerInfo(this.slots[t][i]));
  }
  playerInfo(s) {
    const c = BY_ID[s.char];
    return { id: s.id, name: s.name, bot: s.bot, char: c.id, mod: makeMods(c) };
  }
  removeClient(id) {
    const s = this.findSeat(id);
    this.clients.delete(id);
    if (s && !this.solo) {
      // đấu mạng: không cho Máy vào thay — đang đấu thì xử thắng cho bên còn lại
      this.slots[s.t][s.i] = null;
      if (this.state === 'playing') {
        this.state = 'over';
        this.winner = 1 - s.t;
        this.msg = 'Đối thủ đã rời trận — ' + (this.winner === 0 ? 'Đội Xanh' : 'Đội Đỏ') + ' THẮNG!';
        this.msgTime = 999;
        if (this.shuttle) this.shuttle.held = null;
        this.fx.push(['win', W / 2, this.winner]);
      }
    } else if (s) {
      if (this.state === 'lobby') this.slots[s.t][s.i] = null;
      else this.makeBot(s.t, s.i);
    }
    if (this.hostId === id) this.hostId = this.clients.keys().next().value || null;
  }
  // đấu mạng: đủ 2 người thật mới đánh được
  full() { return this.slots.every(team => team.every(s => s && !s.bot)); }
  // đổi tay vợt / trang phục khi đang ở phòng chờ
  setChar(id, char, outfit) {
    const c = this.clients.get(id);
    if (!c || !BY_ID[char]) return false;
    c.char = char; if (outfit) c.outfit = outfit;
    const seat = this.findSeat(id);
    if (seat) Object.assign(this.slots[seat.t][seat.i], { char, outfit: c.outfit });
    return true;
  }
  toggleBot(t, i) {
    const s = this.slots[t][i];
    if (s === null) this.makeBot(t, i);
    else if (s.bot) this.slots[t][i] = null;
  }

  // ---------- bắt đầu trận ----------
  start() {
    for (let t = 0; t < 2; t++) for (let i = 0; i < this.slots[t].length; i++)
      if (this.slots[t][i] === null) this.makeBot(t, i);
    this.players = [];
    for (let t = 0; t < 2; t++) this.slots[t].forEach((s, i) => {
      this.players.push({
        ...this.playerInfo(s), team: t, idx: i,
        x: 0, y: FLOOR, vy: 0, swing: 0, cd: 0, input: {}, energy: 1, cap: 1,
        ai: { err: 0, think: 0, wait: 0 },
      });
    });
    this.score = [0, 0];
    this.serveTeam = this.firstServe === 'me' ? 0 : this.firstServe === 'opp' ? 1 : Math.random() < 0.5 ? 0 : 1;
    this.state = 'playing';
    this.winner = null;
    this.intro = INTRO_TIME;
    this.resetRally();
  }

  homeX(p) {
    const n = this.slots[p.team].length;
    const pos = n === 1 ? [250] : [150, 370];
    const x = pos[p.idx];
    return p.team === 0 ? x : W - x;
  }
  resetRally() {
    for (const p of this.players) { p.x = this.homeX(p); p.y = FLOOR; p.vy = 0; p.swing = 0; }
    const team = this.players.filter(p => p.team === this.serveTeam);
    // đội 2 người: điểm chẵn người 1 giao, điểm lẻ người 2 giao
    const server = team[this.score[this.serveTeam] % team.length];
    server.x = this.serveTeam === 0 ? 220 : W - 220;
    this.shuttle = { x: 0, y: 0, vx: 0, vy: 0, held: server, lastTeam: null, lastHitter: null };
    // sân ngoài trời: mỗi điểm gió đổi hướng & sức gió
    this.wind = VENUE_BY_ID[this.venue].wind ? Math.round((Math.random() * 2 - 1) * WIND_MAX) : 0;
    this.serveTimer = 0;
    this.pause = 0.8;
  }

  // ---------- vòng lặp game ----------
  update(dt) {
    if (this.state !== 'playing') return;
    if (this.intro > 0) { this.intro -= dt; if (this.intro <= 0) this.fx.push(['whistle', W / 2, 1]); return; }
    if (this.msgTime > 0) this.msgTime -= dt;
    if (this.pause > 0) { this.pause -= dt; }

    for (const p of this.players) {
      if (p.bot) this.botThink(p, dt);
      this.movePlayer(p, dt);
    }

    const s = this.shuttle;
    // người chơi bấm đánh hơi sớm: giữ lệnh, vung ngay khi cầu vào tầm vợt (hoặc hết thời gian chờ)
    for (const p of this.players) {
      if (!(p.buf > 0) || this.pause > 0) continue;
      p.buf -= dt;
      const f = p.team === 0 ? 1 : -1;
      const near = s.held === p || (!s.held && s.lastTeam !== p.team && Math.hypot(s.x - (p.x + f * 26), s.y - (p.y - 122)) < this.reach(p, s));
      if (near || p.buf <= 0) { p.wantSwing = true; p.buf = 0; }
    }

    if (s.held) {
      const p = s.held, f = p.team === 0 ? 1 : -1;
      s.x = p.x + f * 22; s.y = p.y - 95; s.vx = 0; s.vy = 0;
      this.serveTimer += dt;
      if (this.pause <= 0) {
        // người chơi: giao theo kiểu + lực đã chọn (giữ chuột để căn lực); máy: tự chọn; quá lâu thì tự giao
        if (p.serveReq) this.serve(p, p.serveReq.kind, p.serveReq.power);
        else if (p.bot && p.wantSwing) this.serve(p, Math.random() < 0.4 ? 'short' : 'long', 0.4 + Math.random() * 0.4);
        else if (this.serveTimer > (p.bot ? 5 : 8)) this.serve(p, 'long', 0.5);
      }
      p.wantSwing = false;
      return;
    }

    // cầu bay: trọng lực + lực cản
    s.vy += G_SHUTTLE * dt;
    s.vx += this.wind * dt;
    s.vx -= s.vx * DRAG * dt;
    s.vy -= s.vy * DRAG * dt;
    const px = s.x;
    s.x += s.vx * dt;
    s.y += s.vy * dt;

    // chạm lưới
    if ((px - NET_X) * (s.x - NET_X) <= 0 && px !== s.x && s.y > NET_TOP && s.y < FLOOR) {
      s.x = NET_X + (px < NET_X ? -6 : 6);
      s.vx = -s.vx * 0.15;
      s.vy *= 0.3;
      if (!s.netHit) this.fx.push(['net', NET_X, Math.min(1, Math.hypot(s.vx, s.vy) / 400)]);
      s.netHit = true;
    }

    // vợt đánh cầu
    for (const p of this.players) {
      if (p.wantSwing && p.cd <= 0) { p.swing = SWING_TIME; p.cd = SWING_CD * p.mod.cd * (1.4 - 0.4 * p.energy); p.hitDone = false; }   // mệt: vung lại chậm hơn
      p.wantSwing = false;
      if (p.swing > 0 && !p.hitDone && s.lastTeam !== p.team) {
        const f = p.team === 0 ? 1 : -1;
        const rx = p.x + f * 26, ry = p.y - 122;
        if (Math.hypot(s.x - rx, s.y - ry) < this.reach(p, s)) { this.hit(p, s); p.hitDone = true; }
      }
    }

    // cầu chạm sàn -> tính điểm
    if (s.y >= FLOOR) {
      s.y = FLOOR;
      let pointTo;
      const inBounds = s.x >= IN_MIN && s.x <= IN_MAX;
      this.fx.push(['land', s.x, inBounds ? 1 : 0]);
      if (!inBounds) pointTo = s.lastTeam === null ? 1 - this.serveTeam : 1 - s.lastTeam;
      else pointTo = s.x < NET_X ? 1 : 0;
      this.point(pointTo, inBounds ? (s.netHit && s.lastTeam === (s.x < NET_X ? 0 : 1) ? 'Chạm lưới!' : 'Cầu rơi trong sân!') : 'Cầu ra ngoài!');
    }
  }

  movePlayer(p, dt) {
    const inp = p.input;
    let dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
    if (this.pause > 0) dir = 0;
    // đuối sức: chạy chậm (hết sức -35%), nhảy thấp (-25%)
    const e = p.energy, x0 = p.x;
    const speed = RUN * p.mod.speed * (0.65 + 0.35 * e) * (p.bot ? LEVELS[this.level].speed : 1);
    p.x += dir * speed * dt;
    if (!dir) p.energy = Math.min(p.cap, e + STAMINA.idle * p.mod.regen * dt);
    const onGround = p.y >= FLOOR;
    if ((inp.up || p.jumpReq) && onGround && this.pause <= 0 && this.shuttle.held !== p && e > STAMINA.exhausted) {
      p.vy = -JUMP * p.mod.jump * (0.75 + 0.25 * e);
      this.tire(p, STAMINA.jump);
    }
    p.jumpReq = false;
    p.vy += G_PLAYER * dt;
    p.y += p.vy * dt;
    if (p.y >= FLOOR) { p.y = FLOOR; p.vy = 0; }
    // không được qua lưới
    if (p.team === 0) p.x = Math.max(15, Math.min(NET_X - 25, p.x));
    else p.x = Math.max(NET_X + 25, Math.min(W - 15, p.x));
    // quãng đường chạy thật sự (sau khi chặn ở lưới / biên)
    this.tire(p, Math.abs(p.x - x0) / 1000 * STAMINA.perKm * (p.mod.runFree ? 0.5 : 1));
    if (p.swing > 0) p.swing -= dt;
    if (p.cd > 0) p.cd -= dt;
  }

  // kind: 'short' = giao gần (cầu bổng ngắn, lực yếu dễ chạm lưới) · 'long' = phông xa (cầu cao sâu, lực quá tay là ra ngoài)
  serve(p, kind = 'long', power = 0.5) {
    const s = this.shuttle, f = p.team === 0 ? 1 : -1;
    s.held = null;
    p.serveReq = null; p.buf = 0;
    let vy, tx;
    if (kind === 'short') {
      vy = -(470 + power * 90);
      tx = NET_X + f * (40 + power * 150 + (Math.random() - 0.5) * (1 - p.mod.net) * 60);   // đánh lưới kém thì rơi không đều
    } else {
      vy = -(620 + power * 260);
      tx = NET_X + f * (240 + power * 280 + (Math.random() - 0.5) * 30);
    }
    s.vx = vxFor(s.x, tx, flightTime(s.y, vy));
    s.vy = vy;
    this.tire(p, STAMINA.hit);
    this.fx.push(['serve', s.x, kind === 'short' ? 0.3 : 0.5 + power * 0.5]);
    s.lastTeam = p.team; s.lastHitter = p.name; s.kind = 'serve'; s.shotId = 1;
    s.netHit = false;
    p.swing = SWING_TIME; p.cd = SWING_CD * p.mod.cd; p.hitDone = true;
  }

  // ---------- chỉ số nhân vật ----------
  tire(p, amount) {
    if (!this.fatigue) return;
    const a = amount * p.mod.drain;
    p.energy = Math.max(0, p.energy - a);
    p.cap = Math.max(STAMINA.minCap, p.cap - a * STAMINA.wear);
  }
  reach(p, s) {
    if (p.team === 0 ? s.x > NET_X - 2 : s.x < NET_X + 2) return 0;   // cầu chưa qua lưới sang sân mình: không được với qua lưới đánh
    const f = p.team === 0 ? 1 : -1;
    const backhand = p.mod.backhand && (s.x - p.x) * f < -5;   // cầu ở sau lưng
    return (REACH + p.mod.reach - (1 - p.energy) * 8) * (backhand ? 0.8 : 1);   // mệt: với kém đi
  }
  // điểm quyết định: một bên chỉ còn 1 điểm là thắng
  clutch() { return Math.max(...this.score) >= this.target - 1; }

  hit(p, s) {
    const f = p.team === 0 ? 1 : -1;
    const inp = p.input;
    const toward = f === 1 ? inp.r : inp.l;   // giữ phím hướng về lưới
    const away = f === 1 ? inp.l : inp.r;     // giữ phím lùi về sau
    const inAir = p.y < FLOOR - 25;
    const drop = inp.down || p.shot === 'drop';   // phím bỏ nhỏ riêng, hoặc giữ ⬇ khi đánh
    const M = p.mod, shaky = M.jitters && this.clutch() ? 2 : 1;
    let kind;
    if (inAir && s.y < NET_TOP - 20 && !drop) {
      // ĐẬP CẦU: bay thẳng, nhanh, cắm xuống sân đối phương
      kind = 'smash';
      const speed = 1150 * M.smash * (0.8 + 0.2 * p.energy);   // mệt: đập yếu hơn tới 20%
      // bắt đầu ngắm cắm xuống, nếu không qua được lưới thì nâng góc dần lên
      let ang = toward ? 0.6 : 0.45;
      for (let k = 0; k < 20; k++) {
        s.vx = f * Math.cos(ang) * speed; s.vy = Math.sin(ang) * speed;
        if (yAtNet(s) < NET_TOP - 12) break;
        ang -= 0.04;
      }
      // đập kém chính xác: góc lệch -> có thể rúc lưới hoặc bay dài ra ngoài
      ang += (Math.random() - 0.5) * (M.smashErr + (1 - p.energy) * 0.15) * shaky;   // mệt: đập lệch hơn
      s.vx = f * Math.cos(ang) * speed; s.vy = Math.sin(ang) * speed;
      this.tire(p, STAMINA.smash);
    } else if (drop) {
      // BỎ NHỎ: cầu nhẹ rơi sát lưới — đánh lưới giỏi thì sát và đều tay hơn
      kind = 'drop';
      const vy = -430;
      const miss = (1 - M.net) * shaky;
      const tx = NET_X + f * (40 + miss * 60 + Math.random() * (25 + miss * 110));
      s.vx = vxFor(s.x, tx, flightTime(s.y, vy)); s.vy = vy;
    } else {
      // PHÔNG CẦU: cầu cao, sâu về cuối sân
      kind = 'clear';
      const vy = -880;
      let depth = toward ? 260 : away ? 440 : 360;
      // đỡ cú đập: phòng thủ kém thì cầu trả về bị đuối, ngắn
      if (s.kind === 'smash') depth -= (1 - M.def) * 260 * Math.random();
      const tx = NET_X + f * (depth + (Math.random() * 60 - 30));
      s.vx = vxFor(s.x, tx, flightTime(s.y, vy)); s.vy = vy;
    }
    this.tire(p, STAMINA.hit);
    s.lastTeam = p.team; s.lastHitter = p.name; s.netHit = false;
    s.kind = kind; s.power = kind === 'smash' ? M.smash : 1;
    this.fx.push([kind, s.x, kind === 'smash' ? M.smash * (0.8 + 0.2 * p.energy) : 1]);
    s.deceive = M.deceive;
    s.shotId = (s.shotId || 0) + 1;
  }

  point(team, why) {
    // nghỉ giữa 2 điểm: hồi một ít, không vượt mức trần
    for (const p of this.players) p.energy = Math.min(p.cap, p.energy + STAMINA.restPoint * p.mod.regen);
    this.score[team]++;
    this.serveTeam = team;
    this.msg = why + ' +1 cho ' + (team === 0 ? 'Đội Xanh' : 'Đội Đỏ');
    this.fx.push(['point', W / 2, team]);
    this.msgTime = 1.8;
    const [a, b] = this.score;
    const cap = this.target + 9;
    const won = (Math.max(a, b) >= this.target && Math.abs(a - b) >= 2) || Math.max(a, b) >= cap;
    if (won) {
      this.state = 'over';
      this.winner = a > b ? 0 : 1;
      this.msg = (this.winner === 0 ? 'Đội Xanh' : 'Đội Đỏ') + ' THẮNG!';
      this.msgTime = 999;
      this.shuttle.held = null;
      this.fx.push(['win', W / 2, this.winner]);
      return;
    }
    this.resetRally();
    this.pause = 1.4;
  }

  // ---------- trí tuệ nhân tạo cho "Máy" ----------
  predictX(s, hitY) {
    // mô phỏng cầu bay tới khi xuống tới độ cao hitY
    let x = s.x, y = s.y, vx = s.vx, vy = s.vy;
    for (let k = 0; k < 400; k++) {
      vy += G_SHUTTLE * TICK; vx += this.wind * TICK; vx -= vx * DRAG * TICK; vy -= vy * DRAG * TICK;
      x += vx * TICK; y += vy * TICK;
      if (vy > 0 && y >= hitY) break;
    }
    return x;
  }
  botThink(p, dt) {
    const s = this.shuttle, f = p.team === 0 ? 1 : -1, L = LEVELS[this.level];
    const inp = p.input = {};
    if (this.pause > 0) return;
    if (s.held === p) {
      if (this.serveTimer > 1.0) p.wantSwing = true;
      return;
    }
    if (s.held) return;
    const M = p.mod;
    p.ai.think -= dt;
    if (p.ai.think <= 0) { p.ai.think = L.think * M.think; p.ai.err = (Math.random() - 0.5) * L.err; }
    let tx = this.homeX(p);
    const coming = s.lastTeam !== p.team;
    // mỗi cú đánh của đối phương, máy "tung xúc xắc" xem có đỡ hụt không
    if (s.shotId !== p.ai.shot) {
      p.ai.shot = s.shotId;
      let missRate = { smash: 0.4, drop: 0.18, clear: 0.07 }[s.kind] || L.base;
      if (s.kind === 'smash') missRate *= (s.power || 1) * (1.4 - 0.8 * M.def);   // đập càng mạnh, thủ càng kém càng dễ hụt
      p.ai.miss = Math.random() < Math.min(0.9, missRate * L.miss);
      // cầu sẽ rơi ra ngoài: máy biết bỏ (máy càng khó phán đoán càng chuẩn)
      const land = this.predictX(s, FLOOR);
      p.ai.leave = (land > IN_MAX + 5 || land < IN_MIN - 5) && Math.random() < 0.5 + 0.5 * L.smart;
      if (coming) p.ai.wait = (s.deceive || 0) * (0.5 + Math.random());           // bị đánh lừa: khựng lại một nhịp
    }
    if (p.ai.wait > 0) { p.ai.wait -= dt; return; }
    if (coming) {
      const lx = this.predictX(s, FLOOR - 125);
      const mySide = p.team === 0 ? lx < NET_X + 10 : lx > NET_X - 10;
      // trong đội đôi: người gần điểm rơi nhất đi đỡ
      const mates = this.players.filter(q => q.team === p.team);
      const closest = mates.reduce((a, b) => Math.abs(a.x - lx) <= Math.abs(b.x - lx) ? a : b);
      if (mySide && closest === p) tx = lx - f * 22 + p.ai.err;
    }
    if (tx > p.x + 8) inp.r = true;
    else if (tx < p.x - 8) inp.l = true;
    if (coming) {
      const rx = p.x + f * 26, ry = p.y - 122;
      const d = Math.hypot(s.x - rx, s.y - ry);
      // nhảy đập nếu cầu cao rơi gần
      if (s.vy > 0 && s.y < NET_TOP - 60 && Math.abs(s.x - rx) < 50 && s.y > ry - 200 && s.y < ry - 70 && Math.random() < L.jump * M.style.jump) inp.up = true;
      if (d < this.reach(p, s) - 8 && p.cd <= 0 && !p.ai.miss && !p.ai.leave) {
        const deep = () => { inp.l = f === 1; inp.r = f !== 1; };
        if (Math.random() < L.smart) {
          // máy khôn: đối thủ đứng xa lưới thì bỏ nhỏ, đứng gần lưới thì phông sâu
          const oppDist = Math.min(...this.players.filter(q => q.team !== p.team).map(q => Math.abs(q.x - NET_X)));
          if (oppDist > 300 && p.y >= FLOOR - 25) inp.down = true;
          else if (oppDist < 200) deep();
        } else {
          // đánh theo lối chơi của nhân vật
          const r = Math.random(), st = M.style;
          if (r < st.drop) inp.down = true;
          else if (r < st.drop + st.deep) deep();
        }
        p.wantSwing = true;
      }
    }
  }

  // ---------- gửi dữ liệu cho client ----------
  lobbyInfo() {
    return {
      t: 'room', code: this.code, mode: this.mode, target: this.target,
      level: this.level, solo: this.solo, venue: this.venue,
      host: this.hostId, state: this.state, fatigue: this.fatigue,
      slots: this.slots.map(team => team.map(s => s && { name: s.name, bot: s.bot, id: s.id, look: s.look, char: s.char, gender: BY_ID[s.char].gender, outfit: s.outfit })),
    };
  }
  snapshot() {
    const s = this.shuttle;
    return {
      t: 'st', state: this.state, score: this.score, winner: this.winner,
      msg: this.msgTime > 0 ? this.msg : '', serveTeam: this.serveTeam,
      hold: s && s.held ? this.players.indexOf(s.held) : -1,   // người đang cầm cầu chờ giao
      wind: this.wind,
      fx: this.fx,
      load: this.intro > 0 ? +(1 - this.intro / INTRO_TIME).toFixed(3) : null,
      p: this.players.map(p => [Math.round(p.x), Math.round(p.y), p.team, p.swing > 0 ? +(p.swing / SWING_TIME).toFixed(2) : 0, p.name, p.id, this.fatigue ? Math.round(p.energy * 100) : null, Math.round(p.cap * 100)]),
      s: s ? [Math.round(s.x), Math.round(s.y), Math.round(s.vx), Math.round(s.vy)] : null,
    };
  }
  broadcast(obj) {
    const str = JSON.stringify(obj);
    for (const c of this.clients.values()) c.send(str);
  }
}

module.exports = { Room, MODES, LEVELS };   // để chạy mô phỏng / kiểm thử
if (require.main !== module) return;

// ================== WEBSOCKET TỰ VIẾT (không cần thư viện) ==================
function wsAccept(req, socket, onMessage, onClose) {
  const key = req.headers['sec-websocket-key'];
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  let buf = Buffer.alloc(0), closed = false;
  const send = (str) => {
    if (closed) return;
    const data = Buffer.from(str);
    let head;
    if (data.length < 126) head = Buffer.from([0x81, data.length]);
    else if (data.length < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(data.length, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(data.length), 2); }
    socket.write(Buffer.concat([head, data]));
  };
  const close = () => { if (!closed) { closed = true; onClose(); socket.destroy(); } };
  socket.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const op = buf[0] & 0x0f, masked = buf[1] & 0x80;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      const maskOff = off; if (masked) off += 4;
      if (buf.length < off + len) return;
      const payload = Buffer.from(buf.subarray(off, off + len));
      if (masked) for (let i = 0; i < len; i++) payload[i] ^= buf[maskOff + (i & 3)];
      buf = buf.subarray(off + len);
      if (op === 1) onMessage(payload.toString());
      else if (op === 8) return close();
      else if (op === 9) socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload]));
    }
  });
  socket.on('close', close);
  socket.on('error', close);
  return send;
}

// ================== HTTP + PHÒNG ==================
const PORT = process.env.PORT || 3000;
const rooms = new Map();
// client nằm trong public/: index.html, css/, js/ — chỉ phục vụ file trong thư mục này
const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { rel = '/'; }
  if (track.handle(req, res, rel)) return;
  if (rel === '/' || !path.extname(rel)) rel = '/index.html';   // /?room=... và mọi đường dẫn khác -> trang game
  const file = path.join(PUBLIC, path.normalize(rel));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Không tìm thấy ' + rel); }
    res.writeHead(200, { 'Content-Type': (MIME[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

let nextId = 1;
function newCode() {
  let c;
  do { c = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random() * 24 | 0]).join(''); } while (rooms.has(c));
  return c;
}
// mô tả trận cho trang theo dõi
const matchDesc = r => `${r.solo ? 'Giao hữu' : 'Phòng ' + r.code} ${r.mode} · Máy ${LEVELS[r.level].name} · vs ${
  r.players.filter(p => p.team === 1).map(p => BY_ID[p.char] ? BY_ID[p.char].name : p.name).join(' & ')}`;
function roomList() {
  return [...rooms.values()].filter(r => !r.solo && r.state === 'lobby' && !r.full()).map(r => ({
    host: (r.clients.get(r.hostId) || {}).name || '?', venue: r.venue, target: r.target,
    code: r.code, mode: r.mode, state: r.state, level: r.level,
    humans: r.clients.size,
  }));
}

server.on('upgrade', (req, socket) => {
  const id = 'u' + nextId++;
  let room = null, name = 'Khách', look = null, char = DEFAULT_CHAR, outfit = null;
  track.connect(id, req);
  const send = wsAccept(req, socket, (txt) => {
    let m; try { m = JSON.parse(txt); } catch { return; }
    if (m.t === 'hello') {
      name = String(m.name || 'Khách').slice(0, 12);
      look = Array.isArray(m.look) && hex(m.look[0]) && hex(m.look[1]) ? [m.look[0], m.look[1]] : null;
      if (BY_ID[m.char]) char = m.char;
      outfit = cleanOutfit(m.outfit);
      track.hello(id, name, char);
      send(JSON.stringify({ t: 'hi', id, rooms: roomList(), game: publicData() })); }
    else if (m.t === 'list') send(JSON.stringify({ t: 'list', rooms: roomList() }));
    else if ((m.t === 'create' || m.t === 'solo') && !room && (MODES[m.mode] || m.t === 'create')) {
      room = new Room(newCode(), m.t === 'create' ? '1v1' : m.mode, m.target === 11 ? 11 : 21, id, m.level, m.venue);
      if (m.t === 'create') room.fatigue = m.fatigue !== false;
      rooms.set(room.code, room);
      room.addClient(id, name, send, look, char, outfit);
      if (m.t === 'solo') {
        // chơi với máy: ngồi Đội Xanh, các ô còn lại là máy, vào trận luôn
        room.solo = true;
        room.fatigue = m.fatigue !== false;
        room.firstServe = m.serve === 'me' || m.serve === 'opp' ? m.serve : 'rand';
        room.seat(id, 0, 0);
        if (BY_ID[m.opp]) room.makeBot(1, 0, m.opp, cleanOutfit(m.oppOutfit));   // đối thủ + trang phục chọn ở màn Giao hữu
        room.start();
        track.activity(id, 'Đang đấu: ' + matchDesc(room), 'Bắt đầu ' + matchDesc(room), room);
      } else track.activity(id, 'Phòng chờ ' + room.code, 'Tạo phòng mạng ' + room.code + ' (' + room.mode + ')', room);
      room.broadcast(room.lobbyInfo());
    } else if (m.t === 'demo' && !room) {
      // màn hình tiêu đề: trận toàn Máy đánh với nhau, người xem không ngồi ghế nào
      room = new Room(newCode(), '1v1', 11, id, 'hard', VENUES[Math.random() * VENUES.length | 0].id);
      room.solo = room.demo = true;
      room.clients.set(id, { name, send, look });
      room.start();
      room.intro = 0;
      rooms.set(room.code, room);
      track.activity(id, 'Màn hình tiêu đề (xem demo)', null, null);
      send(JSON.stringify(room.lobbyInfo()));
    } else if (m.t === 'join' && !room) {
      const code = String(m.code || '').toUpperCase().slice(0, 8), r = rooms.get(code);
      if (!r || r.solo) return send(JSON.stringify({ t: 'err', msg: 'Không tìm thấy phòng ' + code }));
      if (r.state !== 'lobby') return send(JSON.stringify({ t: 'err', msg: 'Phòng ' + code + ' đang đấu, đợi trận xong nhé' }));
      if (r.full()) return send(JSON.stringify({ t: 'err', msg: 'Phòng ' + code + ' đã đủ 2 người' }));
      room = r;
      room.addClient(id, name, send, look, char, outfit);
      track.activity(id, 'Phòng ' + room.code, 'Vào phòng mạng ' + room.code, room);
      room.broadcast(room.lobbyInfo());
      if (room.state !== 'lobby') send(JSON.stringify(room.snapshot()));
    } else if (!room) return;
    else if (m.t === 'char' && room.state === 'lobby') {
      if (BY_ID[m.char]) { char = m.char; outfit = cleanOutfit(m.outfit) || outfit; }
      if (room.setChar(id, char, outfit)) room.broadcast(room.lobbyInfo());
    }
    else if (m.t === 'cfg' && id === room.hostId && !room.solo && room.state === 'lobby') {
      if (m.target === 11 || m.target === 21) room.target = m.target;
      if (VENUE_BY_ID[m.venue]) room.venue = m.venue;
      if (typeof m.fatigue === 'boolean') room.fatigue = m.fatigue;
      room.broadcast(room.lobbyInfo());
    }
    else if (m.t === 'seat') { room.seat(id, m.team | 0, m.idx | 0); room.broadcast(room.lobbyInfo()); }
    else if (m.t === 'bot' && id === room.hostId && room.state === 'lobby') { room.toggleBot(m.team | 0, m.idx | 0); room.broadcast(room.lobbyInfo()); }
    else if (m.t === 'opp' && id === room.hostId && room.solo && BY_ID[m.char] && room.state !== 'playing') { room.makeBot(1, 0, m.char); room.broadcast(room.lobbyInfo()); }
    else if (m.t === 'level' && id === room.hostId && LEVELS[m.level]) { room.level = m.level; room.broadcast(room.lobbyInfo()); }
    else if (m.t === 'start' && id === room.hostId && room.state !== 'playing') {
      if (!room.solo && !room.full()) {
        // đấu mạng thiếu người (vd đối thủ vừa rời): quay về phòng chờ
        room.state = 'lobby';
        send(JSON.stringify({ t: 'err', msg: 'Cần đủ 2 người mới bắt đầu được' }));
        return room.broadcast(room.lobbyInfo());
      }
      room.start(); room.logged = false;
      for (const cid of room.clients.keys()) track.activity(cid, 'Đang đấu: ' + matchDesc(room), 'Bắt đầu ' + matchDesc(room), room);
      room.broadcast(room.lobbyInfo());
    }
    else if (m.t === 'in') {
      const p = room.players.find(p => p.id === id);
      if (p && !p.bot && !(room.intro > 0)) {
        p.input = { l: !!m.l, r: !!m.r, up: !!m.u, down: !!m.d };
        // s: 1 = đánh (tự đập nếu đang nhảy & cầu cao), 2 = bỏ nhỏ, 3 = nhảy đập
        const shot = { 1: 'clear', 2: 'drop', 3: 'smash' }[m.s];
        if (shot) {
          p.shot = shot; p.buf = SHOT_BUF[shot];
          if (shot === 'smash') p.jumpReq = true;
        }
      }
    } else if (m.t === 'srv') {   // giao cầu: k = short | long, p = lực 0..1
      const p = room.players.find(p => p.id === id);
      if (p && !p.bot && room.shuttle && room.shuttle.held === p && room.intro <= 0)
        p.serveReq = { kind: m.k === 'short' ? 'short' : 'long', power: Math.max(0, Math.min(1, +m.p || 0)) };
    } else if (m.t === 'leave') leave();
  }, () => { leave(); track.disconnect(id); });

  function leave() {
    if (!room) return;
    track.activity(id, 'Menu', room.demo ? null : room.state === 'playing' ? `Bỏ ngang trận (${room.score[0]}–${room.score[1]})` : 'Rời phòng', null);
    room.removeClient(id);
    if (room.clients.size === 0) rooms.delete(room.code);
    else room.broadcast(room.lobbyInfo());
    room = null;
    send(JSON.stringify({ t: 'left' }));
  }
});

let last = Date.now(), frame = 0;
setInterval(() => {
  const now = Date.now();
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  frame++;
  for (const r of rooms.values()) {
    r.update(dt);
    // trận demo hết thì nghỉ 3 giây rồi đấu lại
    if (r.demo && r.state === 'over' && (r.demoWait = (r.demoWait || 0) + dt) > 3) { r.start(); r.intro = 0; r.demoWait = 0; }
    if (r.state !== 'lobby') r.broadcast(r.snapshot());
    // hết trận: ghi kết quả cho từng người thật trong phòng (đội Xanh = team 0)
    if (!r.demo && r.state === 'over' && !r.logged) {
      r.logged = true;
      for (const cid of r.clients.keys()) {
        const p = r.players.find(p => p.id === cid), mine = p ? p.team : 0;
        const [a, b] = mine === 0 ? r.score : [r.score[1], r.score[0]];
        track.matchOver(cid, `${r.winner === mine ? '🏆 Thắng' : '❌ Thua'} ${a}–${b} · ${matchDesc(r)}`);
        track.activity(cid, 'Xem kết quả trận');
      }
    }
    r.fx = [];
  }
}, 1000 / 60);

server.listen(PORT, () => {
  console.log('🏸 Cầu Lông Online đang chạy!');
  console.log('   Mở trình duyệt: http://localhost:' + PORT);
  const nets = require('os').networkInterfaces();
  for (const list of Object.values(nets)) for (const n of list)
    if (n.family === 'IPv4' && !n.internal) console.log('   Bạn bè cùng wifi mở: http://' + n.address + ':' + PORT);
  console.log('🔐 Trang theo dõi: http://localhost:' + PORT + '/admin');
  // passkey cố định (ADMIN_KEY / .admin-key) thì không in ra log, tránh lộ trên log của Render
  console.log('   Passkey: ' + ({ env: 'lấy từ biến ADMIN_KEY', file: 'lấy từ file .admin-key' }[track.KEY_FROM] || track.KEY + '  (ngẫu nhiên, đổi mỗi lần chạy — đặt ADMIN_KEY hoặc tạo file .admin-key để cố định)'));
});
