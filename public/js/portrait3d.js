import * as THREE from 'three';

// số "ngẫu nhiên" cố định theo id để mỗi tay vợt có khuôn mặt / kiểu tóc riêng
const hashOf = id => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0; return h >>> 0; };
const rnd = (h, k) => (Math.imul(h ^ Math.imul(k + 1, 2654435761), 1597334677) >>> 0) % 1000 / 1000;
const mat = (color, roughness = 0.6) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
const mesh = (geo, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); return o; };
const sphere = (r, w = 32, h = 24) => new THREE.SphereGeometry(r, w, h);

// tượng bán thân theo nét nhận biết của từng tay vợt (d.feat): dáng người, khuôn mặt, kiểu tóc, râu, băng đô
// nam: vai rộng, cổ to, hàm vuông, mày dày · nữ: vai hẹp, cổ thon, cằm nhỏ, mày mảnh, mi mắt, môi hồng, lọn tóc hai bên, khuyên tai
function buildBust(d) {
  const h = hashOf(d.id), girl = d.gender === 'f', dark = d.random, f = d.feat || {};
  const style = d.hair === d.skin ? 'bald' : f.hair || (girl ? 'ponytail' : ['short', 'short', 'spiky'][Math.floor(rnd(h, 5) * 3)]);
  const skin = mat(d.skin, 0.55), hair = mat(d.hair, 0.85);
  const shirt = mat(d.kit.c1, 0.75), trim = mat(d.kit.c2, 0.6);
  const root = new THREE.Group(), body = new THREE.Group(), head = new THREE.Group();
  root.add(body); body.add(head);

  // ---- thân, vai, cổ ----
  const build = { tall: 1.08, small: 0.9, slim: 0.92 }[f.build] || 1;
  const wide = (girl ? 1.6 : 2.08) * build, neckLen = f.build === 'tall' ? 1.15 : 1, drop = neckLen - 1;
  body.add(mesh(sphere(1, 48, 32), shirt, 0, -2.75 - drop, 0, d.kit.s === 'tank' ? wide * 0.8 : wide, girl ? 1.4 : 1.5, girl ? 0.9 : 1));
  if (d.kit.s === 'tank') for (const sx of [-1, 1]) body.add(mesh(sphere(0.5), skin, sx * wide * 0.78, -1.85 - drop, 0, 1, 0.8, 0.9));
  const collar = mesh(new THREE.TorusGeometry(girl ? 0.42 : 0.52, d.kit.s === 'polo' ? 0.15 : 0.09, 12, 40), trim, 0, -1.33 - drop, 0.05);
  collar.rotation.x = Math.PI / 2 - 0.25;
  body.add(collar);
  body.add(mesh(new THREE.CylinderGeometry(girl ? 0.32 : 0.44, girl ? 0.38 : 0.5, neckLen, 24), skin, 0, -1 - drop / 2, 0));

  // ---- đầu ----
  let hw = (girl ? 0.82 : 0.9) + rnd(h, 1) * 0.05, hh = (girl ? 1.02 : 1.05) + rnd(h, 2) * 0.06;
  if (f.face === 'long') { hh += 0.08; hw -= 0.03; } else if (f.face === 'round') { hw += 0.05; hh -= 0.05; }
  head.add(mesh(sphere(1, 64, 48), skin, 0, 0, 0, hw, hh, 0.96));
  const jaw = girl ? [0.5, hw * 0.85, 0.62, 0.85, -0.55, 0.2] : [0.62, hw * 1.14, 0.74, 0.92, -0.5, 0.12];   // [r, sx, sy, sz, y, z]
  head.add(mesh(sphere(jaw[0]), skin, 0, jaw[4], jaw[5], jaw[1], jaw[2], jaw[3]));
  for (const sx of [-1, 1]) {
    head.add(mesh(sphere(0.18, 16, 12), skin, sx * hw * 0.98, -0.05, 0, 0.6, 1, 0.8));   // tai
    if (girl && !dark) head.add(mesh(sphere(0.05, 12, 8), mat('#e8c25a', 0.3), sx * hw * 1.0, -0.22, 0.02));   // khuyên tai
  }
  if (!dark) {
    const eyeGap = 0.29 + rnd(h, 3) * 0.05, eyeR = girl ? 0.13 : 0.115;
    for (const sx of [-1, 1]) {
      head.add(mesh(sphere(eyeR, 20, 16), mat('#f4f1ea', 0.3), sx * eyeGap, 0.08, 0.84, 1, 0.8, 0.55));
      head.add(mesh(sphere(0.062, 16, 12), mat('#2a1b12', 0.2), sx * eyeGap, 0.08, 0.9));
      if (girl) {   // mi mắt
        const lash = mesh(new THREE.BoxGeometry(0.27, 0.035, 0.05), mat('#1a1410', 0.6), sx * eyeGap, 0.17, 0.88);
        lash.rotation.z = sx * -0.15;
        head.add(lash);
      }
      // mày: nam dày & thẳng, nữ mảnh & cong
      const brow = mesh(new THREE.BoxGeometry(girl ? 0.27 : 0.34, girl ? 0.03 : 0.075, 0.06), hair, sx * eyeGap, girl ? 0.33 : 0.3, 0.88);
      brow.rotation.z = sx * (girl ? -0.22 : -0.06);
      head.add(brow);
    }
    head.add(mesh(sphere(girl ? 0.09 : 0.115, 20, 16), skin, 0, -0.12, 0.95, 1, (girl ? 1.35 : 1.55) + rnd(h, 4) * 0.35, 1.2));   // mũi
    if (girl) {   // môi hồng
      const lips = mesh(new THREE.CapsuleGeometry(0.035, 0.18, 4, 12), mat('#c8606a', 0.4), 0, -0.47, 0.86, 1, 1, 0.8);
      lips.rotation.z = Math.PI / 2;
      head.add(lips);
    } else head.add(mesh(new THREE.BoxGeometry(0.3, 0.035, 0.04), mat('#9c4f47', 0.5), 0, -0.47, 0.86));

    // râu (nam)
    if (!girl && f.beard) {
      const shell = (opacity) => new THREE.MeshStandardMaterial({ color: d.hair, roughness: 1, transparent: true, opacity });
      if (f.beard === 'goatee') head.add(mesh(sphere(0.2), hair, 0, -0.76, 0.5, 0.9, 1.1, 0.8));
      else head.add(mesh(sphere(jaw[0]), shell(f.beard === 'full' ? 0.92 : 0.32), 0, jaw[4] - 0.02, jaw[5] + 0.02, jaw[1] * 1.05, jaw[2] * 1.05, jaw[3] * 1.05));
      head.add(mesh(new THREE.BoxGeometry(0.34, 0.06, 0.05), f.beard === 'stubble' ? shell(0.45) : hair, 0, -0.37, 0.9));   // ria
    }
  }

  // ---- tóc ----
  const cap = (theta, tilt, r = 1.04) => {
    const c = mesh(new THREE.SphereGeometry(r, 48, 32, 0, Math.PI * 2, 0, Math.PI * theta), hair, 0, 0.02, -0.02, hw * 1.03, hh * 1.01, 1);
    c.rotation.x = tilt;
    head.add(c);
  };
  if (style === 'buzz') cap(0.47, -0.3, 1.012);
  else if (style === 'short') cap(0.42, -0.35);
  else if (style === 'spiky') {
    cap(0.4, -0.35);
    for (let i = 0; i < 7; i++) {
      const spike = mesh(new THREE.ConeGeometry(0.16, 0.42, 10), hair, (i - 3) * 0.22, 0.98 - Math.abs(i - 3) * 0.05, 0.15 - Math.abs(i - 3) * 0.04);
      spike.rotation.z = (i - 3) * -0.12;
      head.add(spike);
    }
  } else if (style === 'curly') {
    cap(0.44, -0.33);
    const tilt = -0.33;
    for (let i = 0; i < 30; i++) {   // các lọn xoăn rải trên đỉnh đầu
      const th = rnd(h, 20 + i) * Math.PI * 0.42, ph = rnd(h, 60 + i) * Math.PI * 2;
      const x = Math.sin(th) * Math.cos(ph), y0 = Math.cos(th), z0 = Math.sin(th) * Math.sin(ph);
      const y = y0 * Math.cos(tilt) - z0 * Math.sin(tilt), z = y0 * Math.sin(tilt) + z0 * Math.cos(tilt);
      head.add(mesh(sphere(0.17, 12, 10), hair, x * hw * 1.04, y * hh * 1.04 + 0.02, z * 1.04 - 0.02));
    }
  } else if (style === 'ponytail' || style === 'bun') {
    cap(0.5, -0.28);
    for (const sx of [-1, 1]) head.add(mesh(sphere(0.2, 16, 12), hair, sx * hw * 0.93, -0.12, 0.3, 0.75, 2.4, 1));   // lọn tóc hai bên mặt
    if (style === 'ponytail') { const tail = mesh(sphere(0.34), hair, 0, -0.2, -1.05, 0.8, 1.8, 0.8); tail.rotation.x = 0.45; head.add(tail); }
    else head.add(mesh(sphere(0.4), hair, 0, 0.6, -0.82));
  }
  if (f.band && style !== 'bald') {   // băng đô
    const band = mesh(new THREE.TorusGeometry(0.95, 0.06, 10, 48), mat('#f4f4f4', 0.5), 0, 0.42, -0.08, hw * 1.03, 1, 0.98);
    band.rotation.x = Math.PI / 2 - 0.35;
    head.add(band);
  }

  root.position.y = 0.35;
  body.rotation.y = 0.3;   // nghiêng 3/4 như ảnh chân dung
  root.userData = { head, body, phase: rnd(h, 9) * 6 };
  return root;
}
function dispose(obj) { obj.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }

class Portrait {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
    this.camera.position.set(0, -0.15, 10.5);
    this.camera.lookAt(0, -0.4, 0);
    // đèn: chính (ấm, trước-trái) + phụ + 2 đèn viền phía sau (tạo viền sáng như ảnh menu)
    this.scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x1a1a2a, 0.9));
    const light = (c, i, x, y, z) => { const l = new THREE.DirectionalLight(c, i); l.position.set(x, y, z); this.scene.add(l); };
    light(0xfff1dd, 2.4, -3, 2.5, 5);
    light(0x9fc4ff, 0.6, 4, 0, 3);
    light(0xffffff, 3, -4, 3, -4);
    light(0x88ccff, 2.4, 4, 2, -4);
    this.key = '';
  }
  set(d) {
    const k = JSON.stringify(d);
    if (k === this.key) return;
    this.key = k;
    if (this.bust) { this.scene.remove(this.bust); dispose(this.bust); }
    this.bust = buildBust(d);
    this.scene.add(this.bust);
  }
  render(t) {
    if (!this.bust) return;
    const w = this.canvas.clientWidth, hgt = this.canvas.clientHeight;
    if (!w || !hgt) return;
    if (w !== this.w || hgt !== this.h) {
      this.w = w; this.h = hgt;
      this.renderer.setSize(w, hgt, false);
      this.camera.aspect = w / hgt; this.camera.updateProjectionMatrix();
    }
    // thở nhẹ + đầu lắc chậm, quay theo con trỏ chuột
    const { head, body, phase } = this.bust.userData;
    body.scale.y = 1 + Math.sin(t * 1.6 + phase) * 0.012;
    head.rotation.y = Math.sin(t * 0.5 + phase) * 0.12 + pointer.x * 0.3 - 0.1;
    head.rotation.x = pointer.y * 0.12;
    this.renderer.render(this.scene, this.camera);
  }
}

const pointer = { x: 0, y: 0 };
addEventListener('pointermove', e => { pointer.x = e.clientX / innerWidth * 2 - 1; pointer.y = e.clientY / innerHeight * 2 - 1; });
try {
  const portraits = [0, 1].map(i => new Portrait(document.querySelector('#pp' + i + ' .pp-3d')));
  const loop = t => {
    requestAnimationFrame(loop);
    if (document.getElementById('wzCont').hidden) return;   // chỉ vẽ khi đang ở màn chọn nhân vật
    for (const p of portraits) p.render(t / 1000);
  };
  requestAnimationFrame(loop);
  window.Portrait3D = { set: (side, d) => portraits[side].set(d) };
  document.body.classList.add('has-3d');
  dispatchEvent(new Event('portrait3d-ready'));
} catch (err) {
  console.warn('Không bật được chân dung 3D, dùng hình 2D:', err);
}
