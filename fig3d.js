/* Daanav – 3D exercise figures (three.js).
   Builds a muscular figure from simple shapes and drives it with the poses in figures.js.
   The muscles an exercise works are tinted with the theme's accent colour.
   One live renderer is shared by the How-to card and the zoom view; thumbnails come
   from a second renderer and are cached as images. If WebGL or the library is
   unavailable, the 2D figures stay in place. */
(function () {
  "use strict";
  var THREE = null, loading = null, failed = false;
  var K = 0.02;                       // 2D units → metres-ish
  var SHW = 0.19, HPW = 0.095;        // half shoulder / hip width
  var DUR = 2.8;                      // seconds per rep

  function load() {
    if (THREE || failed) return Promise.resolve(THREE);
    if (!loading) loading = import("./vendor/three.module.min.js").then(function (m) { THREE = m; return m; }).catch(function () { failed = true; return null; });
    return loading;
  }
  function webglOK() { try { var c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } }

  function themeColors() {
    var t = document.documentElement.dataset.theme || "red";
    return {
      red: { skin: 0xD8C0B4, hi: 0xE11D2E, metal: 0xB9BEC5, plate: 0x2A1418, rim: 0xF5B83D, prop: 0x4A2A30 },
      iron: { skin: 0xCFC6BE, hi: 0xFF5A1F, metal: 0xB9BEC5, plate: 0x1C1C21, rim: 0xFF5A1F, prop: 0x34343C },
      chalk: { skin: 0xE3DAD2, hi: 0x86B800, metal: 0x8E949B, plate: 0x0B0B0B, rim: 0xC6F432, prop: 0xBDBAB0 }
    }[t] || { skin: 0xD8C0B4, hi: 0xE11D2E, metal: 0xB9BEC5, plate: 0x2A1418, rim: 0xF5B83D, prop: 0x4A2A30 };
  }

  /* ---------- scene building ---------- */
  function Rig(T, name, part) {
    var pose = window.figPose(name, part), mus = window.figMuscles(name, part), col = themeColors();
    var self = this, V = T.Vector3, Y = new V(0, 1, 0);
    this.T = T; this.pose = pose; this.group = new T.Group();
    var skin = new T.MeshStandardMaterial({ color: col.skin, roughness: 0.55, metalness: 0.05 });
    var hot = new T.MeshStandardMaterial({ color: col.hi, roughness: 0.45, metalness: 0.05, emissive: col.hi, emissiveIntensity: 0.18 });
    var metal = new T.MeshStandardMaterial({ color: col.metal, roughness: 0.3, metalness: 0.85 });
    var plateM = new T.MeshStandardMaterial({ color: col.plate, roughness: 0.6, metalness: 0.2 });
    var rimM = new T.MeshStandardMaterial({ color: col.rim, roughness: 0.4, metalness: 0.3 });
    var propM = new T.MeshStandardMaterial({ color: col.prop, roughness: 0.8 });
    var cableM = new T.LineBasicMaterial({ color: 0x8a8a8a });
    var mm = function (key) { return mus.indexOf(key) >= 0 ? hot : skin; };
    var sph = new T.SphereGeometry(1, 24, 18), cyl = new T.CylinderGeometry(1, 1, 1, 18, 1);
    var parts = [];
    function mesh(geo, mat) { var m = new T.Mesh(geo, mat); m.castShadow = true; self.group.add(m); return m; }

    // map a 2D point into 3D; side = -1 (near/right), +1 (far/left), 0 centre
    var front = pose.front;
    function P3(p, side, dz) {
      if (!p) return null;
      if (front) return new V(0, (94 - p[1]) * K, (p[0] - 50) * K);
      return new V((p[0] - 50) * K, (94 - p[1]) * K, (side || 0) * (dz || 0));
    }
    // tapered segment between two joints
    function seg(r1, r2, mat) {
      var g = new T.CylinderGeometry(r2, r1, 1, 18, 1), m = mesh(g, mat), c1 = mesh(sph, mat), c2 = mesh(sph, mat);
      c1.scale.setScalar(r1); c2.scale.setScalar(r2);
      return function (a, b) {
        var d = new V().subVectors(b, a), len = Math.max(d.length(), 1e-4);
        m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(Y, d.clone().divideScalar(len)); m.scale.set(1, len, 1);
        c1.position.copy(a); c2.position.copy(b);
      };
    }
    // ellipsoid muscle placed in a local frame (x = along limb/torso axis offset etc.)
    function blob(mat, rx, ry, rz) {   // basis is rebuilt right-handed from y and z
      var m = mesh(sph, mat), mx = new T.Matrix4();
      return function (pos, ax, ay, az) {   // axes: unit vectors for local x,y,z
        m.position.copy(pos); mx.makeBasis(new T.Vector3().crossVectors(ay, az).normalize(), ay, az); m.quaternion.setFromRotationMatrix(mx); m.scale.set(rx, ry, rz);
      };
    }
    function perp(axis, hint, fallback) { var h = hint.clone().addScaledVector(axis, -hint.dot(axis)); if (h.lengthSq() < 1e-6) h = fallback.clone().addScaledVector(axis, -fallback.dot(axis)); return h.normalize(); }

    var Z = new V(0, 0, 1), X = new V(1, 0, 0);
    // torso pieces
    // smooth V-tapered torso (lathe profile: radius vs. height as a fraction of torso length)
    var prof = [[0.001, -0.08], [0.1, -0.07], [0.138, 0.0], [0.135, 0.12], [0.118, 0.34], [0.128, 0.5], [0.158, 0.66], [0.182, 0.8], [0.19, 0.9], [0.17, 0.98], [0.11, 1.04], [0.04, 1.07], [0.001, 1.075]].map(function (p) { return new T.Vector2(p[0], p[1]); });
    var torso = mesh(new T.LatheGeometry(prof, 32), skin), tmx = new T.Matrix4();
    var belly = blob(mm("abs"), 0.08, 0.14, 0.03);
    var obl = [blob(mm("obliques"), 0.035, 0.09, 0.05), blob(mm("obliques"), 0.035, 0.09, 0.05)];
    var pec = [blob(mm("pecs"), 0.082, 0.062, 0.04), blob(mm("pecs"), 0.082, 0.062, 0.04)];
    var lat = [blob(mm("lats"), 0.05, 0.12, 0.06), blob(mm("lats"), 0.05, 0.12, 0.06)];
    var trap = blob(mm("traps"), 0.13, 0.055, 0.05), lowb = blob(mm("lowback"), 0.08, 0.09, 0.03);
    var glute = [blob(mm("glutes"), 0.07, 0.075, 0.06), blob(mm("glutes"), 0.07, 0.075, 0.06)];
    var neck = seg(0.05, 0.045, skin), head = mesh(sph, skin); head.scale.set(0.095, 0.115, 0.09);
    var limbs = [-1, 1].map(function (s) {
      return {
        s: s, delt: blob(mm("delts"), 0.072, 0.075, 0.07),
        ua: seg(0.05, 0.042, skin), bi: blob(mm("biceps"), 0.045, 0.085, 0.045), tri: blob(mm("triceps"), 0.045, 0.09, 0.045),
        fa: seg(0.045, 0.03, mm("forearms")), hand: mesh(sph, skin),
        th: seg(0.085, 0.058, skin), quad: blob(mm("quads"), 0.07, 0.13, 0.065), ham: blob(mm("hams"), 0.06, 0.12, 0.055),
        sh: seg(0.052, 0.036, skin), calf: blob(mm("calves"), 0.048, 0.085, 0.045), foot: mesh(new T.BoxGeometry(0.19, 0.05, 0.08), skin)
      };
    });
    limbs.forEach(function (l) { l.hand.scale.set(0.04, 0.045, 0.035); });

    /* equipment */
    var e = pose.e, wt = e.wt, eq = [];
    function barbell(len) {
      var g = new T.Group(), bar = new T.Mesh(cyl, metal); bar.scale.set(0.012, len, 0.012); bar.rotation.x = Math.PI / 2; g.add(bar);
      [-1, 1].forEach(function (s) { for (var i = 0; i < 2; i++) { var p = new T.Mesh(cyl, i ? rimM : plateM); p.scale.set(i ? 0.125 : 0.13, i ? 0.012 : 0.03, i ? 0.125 : 0.13); p.rotation.x = Math.PI / 2; p.position.z = s * (len / 2 - 0.1 - i * 0.025); p.castShadow = true; g.add(p); } });
      bar.castShadow = true; self.group.add(g); return g;
    }
    function dumbbell() {
      var g = new T.Group(), h = new T.Mesh(cyl, metal); h.scale.set(0.012, 0.16, 0.012); h.rotation.x = Math.PI / 2; g.add(h);
      [-1, 1].forEach(function (s) { var p = new T.Mesh(cyl, plateM); p.scale.set(0.045, 0.05, 0.045); p.rotation.x = Math.PI / 2; p.position.z = s * 0.07; p.castShadow = true; g.add(p); });
      self.group.add(g); return g;
    }
    if (wt === "bar") eq.push({ obj: barbell(1.5), at: "W" });
    if (wt === "barS") eq.push({ obj: barbell(1.5), at: "S", off: [-6, 1] });
    if (wt === "barP") eq.push({ obj: barbell(1.3), at: "P", off: [0, -5] });
    if (wt === "db") { var d1 = dumbbell(), d2 = dumbbell(); eq.push({ obj: d1, at: "W", hand: -1 }, { obj: d2, at: "W", hand: 1 }); }
    if (wt === "grip") { var gb = new T.Mesh(cyl, metal); gb.scale.set(0.012, 0.45, 0.012); gb.rotation.x = Math.PI / 2; self.group.add(gb); eq.push({ obj: gb, at: "W" }); }
    if (wt === "wheel") { var wh = new T.Mesh(new T.TorusGeometry(0.07, 0.025, 12, 24), plateM); self.group.add(wh); eq.push({ obj: wh, at: "W" }); }
    if (e.sled) { var sl = new T.Mesh(new T.BoxGeometry(0.05, 0.35, 0.6), propM); sl.castShadow = true; self.group.add(sl); eq.push({ obj: sl, at: "F", tilt: true }); }
    if (e.roller) { var ro = new T.Mesh(cyl, plateM); ro.scale.set(0.05, 0.5, 0.05); ro.rotation.x = Math.PI / 2; self.group.add(ro); eq.push({ obj: ro, at: "F" }); }
    // static props from the 2D lines (benches, bars, frames) become boxes
    (e.props || []).forEach(function (p) {
      if (!p.line) return;
      var a = P3([p.line[0], p.line[1]]), b = P3([p.line[2], p.line[3]]), d = new V().subVectors(b, a), len = d.length();
      var thick = (p.w || 3) * K * 0.9, wide = p.w >= 5 ? 0.42 : (p.w === 4 ? 0.9 : 0.05);
      var bx = new T.Mesh(new T.BoxGeometry(len + thick, thick, wide), propM); bx.castShadow = true; bx.receiveShadow = true;
      bx.position.copy(a).addScaledVector(d, 0.5); bx.rotation.z = Math.atan2(d.y, d.x); if (front) { bx.rotation.set(0, Math.PI / 2, 0); }
      if (wide < 0.1 && !front) { // posts: one each side
        var b2 = bx.clone(); bx.position.z = -0.17; b2.position.z = 0.17; self.group.add(b2);
      }
      self.group.add(bx);
    });
    var cables = [];
    if (e.cable || e.lever) {
      var anchor = P3(e.cable || e.lever);
      [-1, 1].forEach(function (s) { var g = new T.BufferGeometry().setFromPoints([anchor, anchor]); var ln = new T.Line(g, cableM); self.group.add(ln); cables.push({ ln: ln, s: s, anchor: anchor.clone() }); });
      var pul = new T.Mesh(sph, metal); pul.scale.setScalar(0.035); pul.position.copy(anchor); self.group.add(pul);
    }

    /* per-frame update */
    var Ai = pose.A, Bi = pose.B, keys = Object.keys(Ai);
    var cur = {};
    this.set = function (u) {                      // u in [0,1]: A → B
      keys.forEach(function (k) { var a = Ai[k], b = Bi[k] || a; if (a && a.length === 2) cur[k] = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; });
      var Pm = P3(cur.P), Sm = P3(cur.S), H = P3(cur.H);
      var up = new V().subVectors(Sm, Pm).normalize();
      var fw = front ? X.clone() : perp(up, new V(up.y, -up.x, 0), X);
      var lat3 = new V().crossVectors(fw, up).normalize();   // points to +z side
      var L = Sm.distanceTo(Pm);
      torso.position.copy(Pm); tmx.makeBasis(new V().crossVectors(up, fw).normalize(), up, fw); torso.quaternion.setFromRotationMatrix(tmx); torso.scale.set(1, L, 0.68);
      belly(Pm.clone().addScaledVector(up, L * 0.36).addScaledVector(fw, 0.062), lat3, up, fw);
      lowb(Pm.clone().addScaledVector(up, L * 0.3).addScaledVector(fw, -0.062), lat3, up, fw);
      trap(Sm.clone().addScaledVector(up, 0.01).addScaledVector(fw, -0.04), lat3, up, fw);
      [-1, 1].forEach(function (s, i) {
        pec[i](Sm.clone().addScaledVector(up, -L * 0.22).addScaledVector(fw, 0.09).addScaledVector(lat3, s * 0.07), lat3, up, fw);
        lat[i](Sm.clone().addScaledVector(up, -L * 0.36).addScaledVector(fw, -0.045).addScaledVector(lat3, s * 0.125), lat3, up, fw);
        obl[i](Pm.clone().addScaledVector(up, L * 0.32).addScaledVector(lat3, s * 0.1).addScaledVector(fw, 0.02), lat3, up, fw);
        glute[i](Pm.clone().addScaledVector(fw, -0.065).addScaledVector(lat3, s * 0.065).addScaledVector(up, -0.005), lat3, up, fw);
      });
      neck(Sm.clone().addScaledVector(up, -0.01), H.clone().addScaledVector(up, -0.07));
      head.position.copy(H); head.quaternion.setFromUnitVectors(Y, up);

      limbs.forEach(function (l) {
        var s = l.s;
        var sh, el, wr, hp, kn, ft;
        if (front) {
          var pick = function (a, b) { return s < 0 ? a : b; };
          sh = P3(cur[pick("Sa", "Sb")]); el = P3(cur[pick("E", "Eb")]); wr = P3(cur[pick("W", "Wb")]);
          hp = P3(cur[pick("Pa", "Pb")]); kn = P3(cur[pick("K", "Kb")]); ft = P3(cur[pick("F", "Fb")]);
        } else {
          sh = Sm.clone().addScaledVector(lat3, s * SHW).addScaledVector(up, -0.03);
          var off = new V().subVectors(sh, Sm);
          el = P3(cur.E).add(off); wr = P3(cur.W).add(off);
          hp = Pm.clone().addScaledVector(lat3, s * HPW);
          var useSecond = cur.K2 && s > 0;
          kn = P3(useSecond ? cur.K2 : cur.K).addScaledVector(lat3, s * HPW); ft = P3(useSecond ? cur.F2 : cur.F).addScaledVector(lat3, s * HPW * 1.05);
        }
        l.delt(sh.clone().addScaledVector(up, 0.01).addScaledVector(lat3, s * 0.02), lat3, up, fw);
        l.ua(sh, el); l.fa(el, wr); l.hand.position.copy(wr);
        var ua = new V().subVectors(el, sh).normalize(), fa = new V().subVectors(wr, el);
        var inside = perp(ua, fa, fw), side = new V().crossVectors(ua, inside).normalize();
        var mid = sh.clone().lerp(el, 0.55);
        l.bi(mid.clone().addScaledVector(inside, 0.028), side, ua, inside);
        l.tri(mid.clone().addScaledVector(inside, -0.03), side, ua, inside);
        l.th(hp, kn); l.sh(kn, ft);
        var ta = new V().subVectors(kn, hp).normalize(), shin = new V().subVectors(ft, kn);
        var back = perp(ta, shin, fw.clone().negate()), tside = new V().crossVectors(ta, back).normalize();
        var tmid = hp.clone().lerp(kn, 0.5);
        l.quad(tmid.clone().addScaledVector(back, -0.035), tside, ta, back);
        l.ham(tmid.clone().addScaledVector(back, 0.035), tside, ta, back);
        var sa = shin.clone().normalize(), cback = perp(sa, new V().subVectors(hp, kn), fw.clone().negate()), cside = new V().crossVectors(sa, cback).normalize();
        l.calf(kn.clone().lerp(ft, 0.35).addScaledVector(cback, 0.028), cside, sa, cback);
        l.foot.position.copy(ft).addScaledVector(front ? X : fw.clone().setY(0).normalize(), 0.05).setY(Math.max(ft.y - 0.02, 0.025));
        l._sh = sh; l._wr = wr;
      });
      // equipment follows joints
      eq.forEach(function (q) {
        var p;
        if (q.at === "W") p = q.hand ? limbs[q.hand < 0 ? 0 : 1]._wr.clone() : limbs[0]._wr.clone().lerp(limbs[1]._wr, 0.5);
        else if (q.at === "F") p = P3(cur.F);
        else { var b2 = cur[q.at]; p = P3([b2[0] + (q.off ? q.off[0] : 0), b2[1] + (q.off ? q.off[1] : 0)]); }
        q.obj.position.copy(p);
        if (q.tilt) q.obj.rotation.z = -0.78;
        if (front && q.hand) q.obj.rotation.set(0, 0, Math.PI / 2);
      });
      cables.forEach(function (c, i) { var w = limbs[i]._wr; c.ln.geometry.setFromPoints([c.anchor.clone().setZ(front ? c.anchor.z : (i ? 0.15 : -0.15)), w]); });
    };

    // bounds for framing (both poses)
    var box = new T.Box3();
    this.set(0); this.group.updateMatrixWorld(true); box.expandByObject(this.group);
    this.set(1); this.group.updateMatrixWorld(true); box.expandByObject(this.group);
    this.box = box;
    this.dispose = function () { self.group.traverse(function (o) { if (o.geometry && o.geometry !== sph && o.geometry !== cyl) o.geometry.dispose(); }); };
  }

  /* ---------- stage: renderer + scene + camera ---------- */
  function Stage(T, opts) {
    var r = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!opts.still });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
    r.outputColorSpace = T.SRGBColorSpace;
    var scene = new T.Scene(), cam = new T.PerspectiveCamera(32, 1, 0.05, 50);
    scene.add(new T.HemisphereLight(0xffffff, 0x404048, 1.1));
    var key = new T.DirectionalLight(0xffffff, 2.2); key.position.set(2.5, 4, 3); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); var sc = key.shadow.camera; sc.left = -2; sc.right = 2; sc.top = 2; sc.bottom = -2; sc.near = 0.5; sc.far = 12; key.shadow.bias = -0.0005;
    scene.add(key);
    var rim = new T.DirectionalLight(0xffffff, 0.9); rim.position.set(-3, 2.5, -2); scene.add(rim);
    var floor = new T.Mesh(new T.CircleGeometry(1.6, 48), new T.ShadowMaterial({ opacity: 0.28 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    this.r = r; this.scene = scene; this.cam = cam; this.rig = null; this.yaw = 0.62; this.drag = 0; this.key = key;
  }
  Stage.prototype.setRig = function (rig) {
    if (this.rig) { this.scene.remove(this.rig.group); this.rig.dispose(); }
    this.rig = rig; this.scene.add(rig.group);
    var c = rig.box.getCenter(new this.T.Vector3()), s = rig.box.getSize(new this.T.Vector3());
    this.center = c; this.radius = Math.max(s.x, s.y, s.z * 0.8) * 0.5 + 0.12;
    var A = rig.pose.A, dx = A.S[0] - A.P[0], dy = A.S[1] - A.P[1];
    this.yaw = rig.pose.front ? 0.5 : (Math.abs(dy) < Math.abs(dx) * 0.9 ? 0.3 : 0.62);   // lying moves: more side-on
  };
  Stage.prototype.frame = function (w, h, yaw) {
    var cam = this.cam, d = this.radius / Math.tan(cam.fov * Math.PI / 360) * (w < h ? 1.15 * h / w : 1.08);
    cam.aspect = w / h; cam.updateProjectionMatrix();
    cam.position.set(this.center.x + Math.sin(yaw) * d, this.center.y + d * 0.28, this.center.z + Math.cos(yaw) * d);
    cam.lookAt(this.center);
  };

  /* ---------- live view (How-to card / zoom) ---------- */
  var live = null, liveName = "", livePart = "", liveTheme = "", host = null, raf = 0, t0 = 0, interactive = false;
  function ensureLive() { if (!live) { live = new Stage(THREE, {}); live.T = THREE; live.r.domElement.className = "fig3d-canvas"; bindDrag(live.r.domElement); } return live; }
  function bindDrag(el) {
    var sx = null, sy0 = 0;
    el.addEventListener("pointerdown", function (e) { if (!interactive) return; sx = e.clientX; sy0 = live.drag; el.setPointerCapture(e.pointerId); });
    el.addEventListener("pointermove", function (e) { if (sx === null) return; live.drag = sy0 + (e.clientX - sx) * 0.012; });
    el.addEventListener("pointerup", function () { sx = null; });
    el.addEventListener("pointercancel", function () { sx = null; });
  }
  function loop(now) {
    raf = 0;
    if (!host || !host.isConnected || !live) return;
    var w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) { raf = requestAnimationFrame(loop); return; }
    var c = live.r.domElement;
    if (c.width !== Math.round(w * live.r.getPixelRatio()) || c.height !== Math.round(h * live.r.getPixelRatio())) live.r.setSize(w, h, false);
    var still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var t = still ? 0.5 : ((now - t0) / 1000) % DUR / DUR;
    var u = 0.5 - 0.5 * Math.cos(t * 2 * Math.PI);
    live.rig.set(u);
    var yaw = live.yaw + live.drag + (still ? 0 : Math.sin(now / 1000 * 0.35) * 0.35);
    live.frame(w, h, yaw);
    live.r.render(live.scene, live.cam);
    if (!document.hidden) raf = requestAnimationFrame(loop);
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && host && !raf) raf = requestAnimationFrame(loop); });

  function mount(el, name, part, opts) {
    opts = opts || {};
    if (failed || !webglOK()) return Promise.resolve(false);
    return load().then(function (T) {
      if (!T || !el.isConnected) return false;
      try {
        var st = ensureLive(), theme = document.documentElement.dataset.theme;
        if (name !== liveName || part !== livePart || theme !== liveTheme) { st.setRig(new Rig(T, name, part)); liveName = name; livePart = part; liveTheme = theme; st.drag = 0; }
        interactive = !!opts.interactive;
        el.querySelectorAll("svg.fig").forEach(function (s) { s.style.display = "none"; });
        el.appendChild(st.r.domElement); el.classList.add("is3d");
        host = el; if (!raf) { t0 = performance.now(); raf = requestAnimationFrame(loop); }
        return true;
      } catch (e) { failed = true; return false; }
    });
  }

  /* ---------- thumbnails ---------- */
  var thumbStage = null, cache = {}, queue = Promise.resolve();
  function thumb(name, part) {
    var theme = document.documentElement.dataset.theme || "red", key = theme + "|" + part + "|" + name;
    if (cache[key]) return Promise.resolve(cache[key]);
    if (failed || !webglOK()) return Promise.resolve(null);
    queue = queue.then(function () { return load(); }).then(function (T) {
      if (!T) return null;
      if (cache[key]) return cache[key];
      try {
        if (!thumbStage) { thumbStage = new Stage(T, { still: true }); thumbStage.T = T; thumbStage.r.setPixelRatio(2); thumbStage.r.setSize(104, 104, false); }
        var rig = new Rig(T, name, part); thumbStage.setRig(rig); rig.set(1);
        thumbStage.frame(104, 104, thumbStage.yaw); thumbStage.r.render(thumbStage.scene, thumbStage.cam);
        cache[key] = thumbStage.r.domElement.toDataURL("image/png");
        return cache[key];
      } catch (e) { return null; }
    });
    return queue;
  }

  /* ---------- hook into the app's rendered HTML ---------- */
  function hydrate(root) {
    if (failed) return;
    var card = root.querySelector("[data-fig3d]");
    if (card) mount(card, card.dataset.fig3d, card.dataset.part, { interactive: card.dataset.interactive === "1" });
    root.querySelectorAll("[data-thumb3d]").forEach(function (t) {
      thumb(t.dataset.thumb3d, t.dataset.part).then(function (url) {
        if (!url || !t.isConnected) return;
        var img = t.querySelector("img") || document.createElement("img");
        img.alt = ""; img.src = url; img.className = "thumb3d";
        if (!img.parentNode) { t.querySelectorAll("svg").forEach(function (s) { s.style.display = "none"; }); t.appendChild(img); }
      });
    });
  }
  function resetTheme() { cache = {}; liveTheme = ""; }

  window.Fig3D = { hydrate: hydrate, mount: mount, thumb: thumb, resetTheme: resetTheme, preload: function () { if (webglOK()) load(); } };
})();
