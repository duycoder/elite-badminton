// Nhân vật & bộ chỉ số (0–99). Server dùng để tính lối đánh, client nhận qua tin 'hi' để hiển thị.

// 10 chỉ số cốt lõi, chia 4 nhóm — trung bình cộng = OVR
const STATS = [
  { group: 'THỂ CHẤT',  key: 'speed',     name: 'Tốc độ',        desc: 'Tốc độ chạy' },
  { group: 'THỂ CHẤT',  key: 'agility',   name: 'Linh hoạt',     desc: 'Độ cao bật nhảy' },
  { group: 'THỂ CHẤT',  key: 'stamina',   name: 'Thể lực',       desc: 'Chạy, đánh, nhảy đập ít mất sức hơn' },
  { group: 'TẤN CÔNG',  key: 'smashPow',  name: 'Lực đập',       desc: 'Tốc độ cú đập' },
  { group: 'TẤN CÔNG',  key: 'smashAcc',  name: 'Đập chính xác', desc: 'Cú đập ít bị lệch (rúc lưới / ra ngoài)' },
  { group: 'PHÒNG THỦ', key: 'reflex',    name: 'Phản xạ',       desc: 'Tầm với của vợt' },
  { group: 'PHÒNG THỦ', key: 'defense',   name: 'Phòng thủ',     desc: 'Đỡ đập trả cầu sâu, không bị đuối' },
  { group: 'PHÒNG THỦ', key: 'recovery',  name: 'Hồi vị trí',    desc: 'Vung vợt lại nhanh, hồi thể lực nhanh' },
  { group: 'KỸ THUẬT',  key: 'netPlay',   name: 'Đánh lưới',     desc: 'Bỏ nhỏ rơi sát lưới, chính xác' },
  { group: 'KỸ THUẬT',  key: 'deception', name: 'Đánh lừa',      desc: 'Máy đối thủ phản ứng chậm hơn' },
];

const ABILITIES = {
  smash:    { name: 'Đập Sấm Sét',  desc: 'Cú đập nhanh hơn 10%.' },
  reflex:   { name: 'Phản Xạ Chớp', desc: 'Tầm với của vợt rộng hơn hẳn.' },
  ironlung: { name: 'Lá Phổi Thép', desc: 'Chạy chỉ tốn một nửa thể lực.' },
  net:      { name: 'Bàn Tay Lụa',  desc: 'Bỏ nhỏ rơi cực sát lưới.' },
  wall:     { name: 'Bức Tường',    desc: 'Đỡ đập luôn trả cầu sâu.' },
  trick:    { name: 'Ảo Ảnh',       desc: 'Khả năng đánh lừa tăng 50%.' },
};
const WEAKNESSES = {
  backhand: { name: 'Yếu trái tay', desc: 'Cầu bay ra sau lưng thì tầm với giảm 20%.' },
  stamina:  { name: 'Hụt hơi',      desc: 'Mất thể lực nhanh hơn 30%.' },
  jump:     { name: 'Bật nhảy kém', desc: 'Nhảy thấp hơn 10%.' },
  jitters:  { name: 'Run tay',      desc: 'Lúc điểm quyết định, đập và bỏ nhỏ kém chính xác.' },
};
// lối chơi khi Máy điều khiển: jump = hệ số hay nhảy đập, drop/deep = tỉ lệ bỏ nhỏ / phông sâu
const STYLES = {
  power: { name: 'Power Attacker',   vn: 'Tấn công áp đảo, nhảy đập liên tục', jump: 2.2, drop: 0.1,  deep: 0.2 },
  speed: { name: 'Speed Demon',      vn: 'Chạy khắp sân, cầu nào cũng tới',    jump: 1,   drop: 0.2,  deep: 0.25 },
  wall:  { name: 'Defensive Wall',   vn: 'Phòng thủ chắc, phông sâu chờ sai',  jump: 0.9, drop: 0.15, deep: 0.45 },
  tech:  { name: 'Technical Player', vn: 'Bỏ nhỏ, đánh lừa, điều cầu khéo',    jump: 0.8, drop: 0.4,  deep: 0.2 },
  all:   { name: 'All-rounder',      vn: 'Cân bằng mọi mặt',                   jump: 1,   drop: 0.25, deep: 0.2 },
};

// 5 liên đoàn châu lục của BWF
const CONTINENTS = {
  asia:    'Châu Á',
  europe:  'Châu Âu',
  america: 'Châu Mỹ',
  africa:  'Châu Phi',
  oceania: 'Châu Đại Dương',
};

// Bộ chỉ số sinh từ OVR + lối chơi: độ lệch của từng chỉ số so với OVR (tổng = 0), theo thứ tự STATS
const TEMPLATES = {
  power: [0, 1, -1, 9, 4, -2, -6, -1, -3, -1],
  speed: [9, 8, -4, -4, -3, 5, -2, 3, -6, -6],
  wall:  [-4, -5, 8, -6, -4, 4, 9, 7, -2, -7],
  tech:  [-2, 0, -4, -6, 4, 0, -3, -1, 6, 6],
  all:   [1, 0, 1, 0, 0, 0, 0, 0, -1, -1],
};
function buildStats(id, base, style) {
  // thêm chút lệch ±2 cố định theo tên để hai người cùng lối chơi không giống hệt nhau
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const out = {};
  STATS.forEach((st, i) => {
    h = (h * 1103515245 + 12345) | 0;
    out[st.key] = Math.max(40, Math.min(99, base + TEMPLATES[style][i] + ((h >>> 16) % 5) - 2));
  });
  return out;
}

// Tay vợt đơn theo châu lục. OVR & lối chơi là ước lượng cho game (phong độ tới khoảng 2025) — sửa tuỳ ý.
// [id, tên ngắn, tên đầy đủ, quốc gia, châu lục, giới tính, OVR, lối chơi, kỹ năng, điểm yếu, [tóc, da]]
const BLACK = '#222222', BROWN = '#6b3e1f', BLOND = '#e8d27a';
const SK1 = '#f2c79c', SK2 = '#e0ac7e', SK3 = '#b97d52', SK4 = '#7a4e30';
const ROSTER = [
  ['shiyuqi',   'Shi Yuqi',       'Shi Yuqi',                 'CHN', 'asia',    'm', 92, 'all',   'reflex',   'jitters',  [BLACK, SK1]],
  ['kunlavut',  'Kunlavut',       'Kunlavut Vitidsarn',       'THA', 'asia',    'm', 90, 'wall',  'wall',     'jump',     [BLACK, SK2]],
  ['naraoka',   'Naraoka',        'Kodai Naraoka',            'JPN', 'asia',    'm', 88, 'wall',  'ironlung', 'jump',     [BLACK, SK1]],
  ['jonatan',   'Jonatan',        'Jonatan Christie',         'INA', 'asia',    'm', 88, 'power', 'smash',    'stamina',  [BLACK, SK2]],
  ['leeziijia', 'Lee Zii Jia',    'Lee Zii Jia',              'MAS', 'asia',    'm', 87, 'power', 'smash',    'jitters',  [BLACK, SK1]],
  ['chou',      'Chou Tien-chen', 'Chou Tien-chen',           'TPE', 'asia',    'm', 86, 'power', 'smash',    'stamina',  [BLACK, SK1]],
  ['lakshya',   'Lakshya Sen',    'Lakshya Sen',              'IND', 'asia',    'm', 86, 'speed', 'reflex',   'jitters',  [BLACK, SK3]],
  ['ducphat',   'Đức Phát',       'Lê Đức Phát',              'VIE', 'asia',    'm', 80, 'speed', 'reflex',   'jitters',  [BLACK, SK2]],
  ['tienminh',  'Tiến Minh',      'Nguyễn Tiến Minh',         'VIE', 'asia',    'm', 79, 'tech',  'trick',    'stamina',  [BLACK, SK2]],
  ['anseyoung', 'An Se-young',    'An Se-young',              'KOR', 'asia',    'f', 95, 'wall',  'reflex',   'jump',     [BLACK, SK1]],
  ['wangzhiyi', 'Wang Zhiyi',     'Wang Zhiyi',               'CHN', 'asia',    'f', 90, 'all',   'ironlung', 'jitters',  [BLACK, SK1]],
  ['yamaguchi', 'Yamaguchi',      'Akane Yamaguchi',          'JPN', 'asia',    'f', 90, 'speed', 'ironlung', 'jump',     [BLACK, SK1]],
  ['chenyufei', 'Chen Yufei',     'Chen Yufei',               'CHN', 'asia',    'f', 89, 'wall',  'wall',     'jump',     [BLACK, SK1]],
  ['taitzuying','Tai Tzu-ying',   'Tai Tzu-ying',             'TPE', 'asia',    'f', 89, 'tech',  'trick',    'stamina',  [BLACK, SK1]],
  ['hanyue',    'Han Yue',        'Han Yue',                  'CHN', 'asia',    'f', 88, 'speed', 'reflex',   'stamina',  [BLACK, SK1]],
  ['gregoria',  'Gregoria',       'Gregoria Mariska Tunjung', 'INA', 'asia',    'f', 87, 'all',   'reflex',   'jitters',  [BLACK, SK2]],
  ['sindhu',    'Sindhu',         'P. V. Sindhu',             'IND', 'asia',    'f', 86, 'power', 'smash',    'backhand', [BLACK, SK3]],
  ['ratchanok', 'Ratchanok',      'Ratchanok Intanon',        'THA', 'asia',    'f', 85, 'tech',  'net',      'stamina',  [BLACK, SK2]],
  ['thuylinh',  'Thùy Linh',      'Nguyễn Thùy Linh',         'VIE', 'asia',    'f', 82, 'speed', 'reflex',   'jitters',  [BLACK, SK2]],
  ['axelsen',   'Axelsen',        'Viktor Axelsen',           'DEN', 'europe',  'm', 93, 'power', 'smash',    'backhand', [SK1, SK1]],
  ['antonsen',  'Antonsen',       'Anders Antonsen',          'DEN', 'europe',  'm', 89, 'all',   'ironlung', 'jitters',  [BROWN, SK1]],
  ['lanier',    'Alex Lanier',    'Alex Lanier',              'FRA', 'europe',  'm', 86, 'speed', 'reflex',   'stamina',  [BROWN, SK1]],
  ['christo',   'Christo Popov',  'Christo Popov',            'FRA', 'europe',  'm', 85, 'power', 'smash',    'jitters',  [BROWN, SK1]],
  ['toma',      'Toma Popov',     'Toma Junior Popov',        'FRA', 'europe',  'm', 84, 'tech',  'net',      'jump',     [BROWN, SK1]],
  ['marin',     'Carolina Marín', 'Carolina Marín',           'ESP', 'europe',  'f', 90, 'power', 'smash',    'backhand', [BLOND, SK1]],
  ['blichfeldt','Blichfeldt',     'Mia Blichfeldt',           'DEN', 'europe',  'f', 85, 'all',   'reflex',   'jitters',  [BLOND, SK1]],
  ['gilmour',   'Kirsty Gilmour', 'Kirsty Gilmour',           'SCO', 'europe',  'f', 82, 'tech',  'net',      'jump',     [BROWN, SK1]],
  ['line',      'Line C.',        'Line Christophersen',      'DEN', 'europe',  'f', 81, 'wall',  'wall',     'backhand', [BLOND, SK1]],
  ['yvonneli',  'Yvonne Li',      'Yvonne Li',                'GER', 'europe',  'f', 81, 'all',   'ironlung', 'jitters',  [BLACK, SK1]],
  ['brianyang', 'Brian Yang',     'Brian Yang',               'CAN', 'america', 'm', 83, 'speed', 'reflex',   'jitters',  [BLACK, SK1]],
  ['cordon',    'Kevin Cordón',   'Kevin Cordón',             'GUA', 'america', 'm', 82, 'tech',  'trick',    'stamina',  [BLACK, SK3]],
  ['victorlai', 'Victor Lai',     'Victor Lai',               'CAN', 'america', 'm', 82, 'power', 'smash',    'backhand', [BLACK, SK1]],
  ['coelho',    'Ygor Coelho',    'Ygor Coelho',              'BRA', 'america', 'm', 79, 'all',   'ironlung', 'jump',     [BLACK, SK3]],
  ['beiwen',    'Beiwen Zhang',   'Beiwen Zhang',             'USA', 'america', 'f', 85, 'tech',  'net',      'stamina',  [BLACK, SK1]],
  ['michelleli','Michelle Li',    'Michelle Li',              'CAN', 'america', 'f', 83, 'wall',  'wall',     'jump',     [BLACK, SK1]],
  ['vieira',    'Juliana Vieira', 'Juliana Viana Vieira',     'BRA', 'america', 'f', 77, 'speed', 'reflex',   'jitters',  [BROWN, SK3]],
  ['georgespaul','Georges Paul',  'Georges Julien Paul',      'MRI', 'africa',  'm', 76, 'all',   'ironlung', 'jitters',  [BLACK, SK4]],
  ['opeyemi',   'Opeyemi',        'Anuoluwapo Juwon Opeyemi', 'NGR', 'africa',  'm', 75, 'speed', 'reflex',   'backhand', [BLACK, SK4]],
  ['elgamal',   'Elgamal',        'Adham Hatem Elgamal',      'EGY', 'africa',  'm', 75, 'power', 'smash',    'stamina',  [BLACK, SK3]],
  ['dohahany',  'Doha Hany',      'Doha Hany',                'EGY', 'africa',  'f', 74, 'all',   'reflex',   'jitters',  [BLACK, SK3]],
  ['scholtz',   'Scholtz',        'Johanita Scholtz',         'RSA', 'africa',  'f', 73, 'wall',  'wall',     'jump',     [BLOND, SK1]],
  ['manota',    'Abhinav Manota', 'Abhinav Manota',           'NZL', 'oceania', 'm', 75, 'speed', 'reflex',   'jitters',  [BLACK, SK3]],
  ['chenhsuanyu','Chen Hsuan-yu', 'Chen Hsuan-yu',            'AUS', 'oceania', 'f', 77, 'wall',  'wall',     'backhand', [BLACK, SK1]],
  ['tiffanyho', 'Tiffany Ho',     'Tiffany Ho',               'AUS', 'oceania', 'f', 75, 'speed', 'reflex',   'jitters',  [BLACK, SK1]],
];
// Nét nhận biết cho chân dung 3D (không phải mô phỏng khuôn mặt thật) — ước lượng theo hình ảnh thi đấu, sửa tuỳ ý.
// hair: short | buzz | spiky | curly | bald | ponytail | bun · beard: stubble | full | goatee
// build: tall | small | slim · face: long | round · band: true = đeo băng đô
// Người không có trong bảng: nam tóc ngắn, nữ buộc đuôi ngựa.
const FEATURES = {
  shiyuqi:   { hair: 'short', face: 'long' },
  kunlavut:  { hair: 'short', build: 'slim' },
  naraoka:   { hair: 'short', face: 'round' },
  jonatan:   { hair: 'spiky', beard: 'stubble' },
  leeziijia: { hair: 'short', build: 'tall' },
  chou:      { hair: 'short', beard: 'stubble', face: 'long' },
  lakshya:   { hair: 'curly', build: 'slim' },
  ducphat:   { hair: 'short' },
  tienminh:  { hair: 'short', face: 'long' },
  axelsen:   { hair: 'bald', build: 'tall', face: 'long' },
  antonsen:  { hair: 'short', beard: 'stubble' },
  lanier:    { hair: 'curly', build: 'slim' },
  christo:   { hair: 'short' },
  toma:      { hair: 'curly', beard: 'stubble' },
  cordon:    { hair: 'buzz', beard: 'goatee' },
  coelho:    { hair: 'short', beard: 'full' },
  georgespaul: { hair: 'buzz' },
  opeyemi:   { hair: 'buzz' },
  elgamal:   { hair: 'short', beard: 'stubble' },
  anseyoung: { hair: 'ponytail', band: true },
  yamaguchi: { hair: 'ponytail', build: 'small', face: 'round' },
  chenyufei: { hair: 'ponytail', build: 'tall' },
  taitzuying:{ hair: 'ponytail' },
  sindhu:    { hair: 'bun', build: 'tall' },
  ratchanok: { hair: 'bun' },
  marin:     { hair: 'ponytail', band: true },
  line:      { hair: 'ponytail', build: 'tall' },
  vieira:    { hair: 'bun' },
};

const CHARACTERS = ROSTER.map(([id, name, full, country, continent, gender, base, style, ability, weak, look]) =>
  ({ id, name, full, country, continent, gender, style, ability, weak, look, stats: buildStats(id, base, style) }));
const DEFAULT_CHAR = 'ducphat';

// Trang phục theo giới tính
const OUTFITS = {
  m: [['tee', 'Áo thun'], ['tank', 'Áo ba lỗ'], ['polo', 'Áo polo']],
  f: [['skirt', 'Áo + váy'], ['shorts', 'Áo + quần short'], ['dress', 'Đầm liền']],
};
const OUTFIT_STYLES = new Set(Object.values(OUTFITS).flat().map(o => o[0]));

// Sân thi đấu (wind = có gió thổi lệch cầu)
const VENUES = [
  { id: 'arena', name: 'Nhà thi đấu Quốc tế', desc: 'Thảm xanh tiêu chuẩn, đèn trắng — sân chuẩn thi đấu.' },
  { id: 'wood',  name: 'Sân gỗ Truyền thống', desc: 'Sàn gỗ ấm cúng kiểu nhà văn hoá phường.' },
  { id: 'neon',  name: 'Sân Neon Đêm',        desc: 'Đèn neon tím xanh, không khí như sàn đấu esports.' },
  { id: 'park',  name: 'Sân Công viên',       desc: 'Ngoài trời — có GIÓ thổi lệch đường cầu, mỗi điểm một hướng!', wind: true },
];
const VENUE_BY_ID = Object.fromEntries(VENUES.map(v => [v.id, v]));
const BY_ID = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));
const ovr = c => Math.round(STATS.reduce((a, s) => a + c.stats[s.key], 0) / STATS.length);

// chỉ số -> hệ số dùng trong vật lý / AI (75 điểm ~ như trước khi có chỉ số)
const lerp = (lo, hi, v) => lo + (hi - lo) * v / 99;
function makeMods(c) {
  const s = c.stats, ab = c.ability, wk = c.weak;
  return {
    speed:    lerp(0.68, 1.2, s.speed),
    jump:     lerp(0.8, 1.15, s.agility) * (wk === 'jump' ? 0.9 : 1),
    drain:    lerp(1.8, 0.5, s.stamina) * (wk === 'stamina' ? 1.3 : 1),
    runFree:  ab === 'ironlung',
    smash:    lerp(0.78, 1.18, s.smashPow) * (ab === 'smash' ? 1.1 : 1),
    smashErr: lerp(0.3, 0.02, s.smashAcc),
    reach:    lerp(-12, 12, s.reflex) + (ab === 'reflex' ? 8 : 0),
    think:    lerp(1.4, 0.7, s.reflex),
    def:      ab === 'wall' ? 1 : s.defense / 99,
    cd:       lerp(1.35, 0.75, s.recovery),
    regen:    lerp(0.6, 1.4, s.recovery),
    net:      ab === 'net' ? 1 : s.netPlay / 99,
    deceive:  lerp(0, 0.12, s.deception) * (ab === 'trick' ? 1.5 : 1),
    backhand: wk === 'backhand',
    jitters:  wk === 'jitters',
    style:    STYLES[c.style],
  };
}

// dữ liệu gửi cho client
const publicData = () => ({
  stats: STATS, abilities: ABILITIES, weaknesses: WEAKNESSES, continents: CONTINENTS,
  outfits: OUTFITS, venues: VENUES, defaultChar: DEFAULT_CHAR,
  styles: Object.fromEntries(Object.entries(STYLES).map(([k, v]) => [k, { name: v.name, vn: v.vn }])),
  chars: CHARACTERS.map(c => ({ ...c, ovr: ovr(c), feat: FEATURES[c.id] || {} })),
});

module.exports = { CHARACTERS, BY_ID, DEFAULT_CHAR, OUTFIT_STYLES, VENUES, VENUE_BY_ID, makeMods, publicData, ovr };
