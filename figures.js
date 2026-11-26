/* Daanav – animated exercise figures.
   Each exercise has a start pose (a) and an end pose (b). A pose places the hip,
   leans the torso, and either aims the hands/feet at targets (joints solved
   automatically) or sets limb angles. The figure animates a → b → a. */
(function () {
  "use strict";
  var L = { torso: 24, neck: 9, ua: 13, fa: 12, th: 17, sh: 17 };
  var R = Math.PI / 180;

  function dir(deg) { return [Math.sin(deg * R), Math.cos(deg * R)]; }      // 0 = down, 90 = forward (+x)
  function up(deg) { return [Math.sin(deg * R), -Math.cos(deg * R)]; }      // 0 = up, + = lean forward
  function add(p, v, k) { return [p[0] + v[0] * k, p[1] + v[1] * k]; }
  // Two-bone solver. sign +1 puts the middle joint on the clockwise side of root→target
  // (screen coords): for a standing leg that is "knee forward"; for an arm hanging down, "elbow forward".
  function ik(root, target, a, b, sign) {
    var dx = target[0] - root[0], dy = target[1] - root[1];
    var d = Math.hypot(dx, dy);
    d = Math.max(Math.abs(a - b) + 0.01, Math.min(a + b - 0.01, d));
    var base = Math.atan2(dy, dx), off = Math.acos((a * a + d * d - b * b) / (2 * a * d));
    var j1 = [root[0] + a * Math.cos(base + off), root[1] + a * Math.sin(base + off)];
    var j2 = [root[0] + a * Math.cos(base - off), root[1] + a * Math.sin(base - off)];
    var cr = function (j) { return dx * (j[1] - root[1]) - dy * (j[0] - root[0]); };
    var want = (sign || 1) > 0 ? -1 : 1;
    return Math.sign(cr(j1)) === want ? j1 : j2;
  }
  function limb(root, p, tKey, aKey, bKey, la, lb, signKey) {
    if (p[tKey]) { var j = ik(root, p[tKey], la, lb, p[signKey]); var v = [p[tKey][0] - j[0], p[tKey][1] - j[1]], n = Math.hypot(v[0], v[1]) || 1; return [j, add(j, [v[0] / n, v[1] / n], lb)]; }
    var j2 = add(root, dir(p[aKey] || 0), la); return [j2, add(j2, dir(p[bKey] || 0), lb)];
  }
  function solve(p) {
    var hip = p.hip, t = p.t || 0;
    var S = add(hip, up(t), L.torso);
    if (p.sy) S = [S[0], S[1] + p.sy];
    var H = add(S, up(t + (p.nt || 0)), L.neck);
    var front = !!p.front;
    var Sa = front ? [S[0] + 7, S[1]] : S, Ha = front ? [hip[0] + 4, hip[1]] : hip;
    var arm = limb(Sa, p, "hand", "ua", "fa", L.ua, L.fa, "eb");
    var leg = limb(Ha, p, "foot", "th", "sh", L.th, L.sh, "kb");
    var o = { H: H, S: S, P: hip, Sa: Sa, Pa: Ha, E: arm[0], W: arm[1], K: leg[0], F: leg[1] };
    if (p.foot2) { var l2 = ik(hip, p.foot2, L.th, L.sh, p.kb2); o.K2 = l2; o.F2 = p.foot2; }
    if (front) {
      var m = function (q) { return [2 * S[0] - q[0], q[1]]; };
      o.Sb = m(Sa); o.Eb = m(o.E); o.Wb = m(o.W); o.Pb = [2 * hip[0] - Ha[0], Ha[1]]; o.Kb = [2 * hip[0] - o.K[0], o.K[1]]; o.Fb = [2 * hip[0] - o.F[0], o.F[1]];
    }
    return o;
  }

  /* ---- shared pieces ---- */
  var FLAT = { hip: [58, 62], t: -90, foot: [76, 92], kb: 1 };
  var INC = { hip: [58, 64], t: -56, foot: [78, 92], kb: 1 };
  var STAND = { hip: [50, 58], t: 0 };
  var SEAT = { hip: [46, 66], t: -6, foot: [64, 88], kb: 1 };
  var HINGE = { hip: [42, 62], t: 70, foot: [52, 92], kb: 1 };
  var KNEEL = { hip: [50, 74], th: 0, sh: -90 };
  function P(base, extra) { var o = {}, k; for (k in base) o[k] = base[k]; for (k in extra) o[k] = extra[k]; return o; }

  var flatBench = [{ line: [20, 68, 66, 68], w: 5 }, { line: [26, 68, 26, 93], w: 3 }, { line: [60, 68, 60, 93], w: 3 }];
  var incBench = [{ line: [26, 46, 58, 70], w: 5 }, { line: [56, 70, 72, 70], w: 5 }, { line: [60, 70, 60, 93], w: 3 }];
  var seat = [{ line: [38, 70, 62, 70], w: 5 }, { line: [38, 70, 35, 38], w: 5 }, { line: [50, 70, 50, 93], w: 3 }];
  var pullBar = [{ line: [28, 7, 72, 7], w: 4 }];
  var dipBars = [{ line: [38, 52, 70, 52], w: 4 }, { line: [66, 52, 66, 93], w: 3 }];

  var EX = {
    /* Chest */
    "Bench press": { a: P(FLAT, { hand: [36, 51], eb: -1 }), b: P(FLAT, { hand: [34, 37], eb: -1 }), props: flatBench, wt: "bar", cue: "Lie flat, lower the bar to mid-chest, then press straight up." },
    "Incline bench press": { a: P(INC, { hand: [43, 41], eb: -1 }), b: P(INC, { hand: [40, 24], eb: -1 }), props: incBench, wt: "bar", cue: "Bench at 30–45°. Lower to upper chest, press up over your shoulders." },
    "Dumbbell bench press": { a: P(FLAT, { hand: [35, 54], eb: -1 }), b: P(FLAT, { hand: [34, 37], eb: -1 }), props: flatBench, wt: "db", cue: "Dumbbells beside your chest, press up until arms are straight." },
    "Incline dumbbell press": { a: P(INC, { hand: [42, 44], eb: -1 }), b: P(INC, { hand: [40, 24], eb: -1 }), props: incBench, wt: "db", cue: "On an incline, lower dumbbells to upper chest and press up." },
    "Machine chest press": { a: P(SEAT, { hand: [52, 40], eb: 1 }), b: P(SEAT, { hand: [68, 40], eb: 1 }), props: seat, wt: "grip", cue: "Sit tall, back on the pad. Push the handles forward, don't lock elbows hard." },
    "Chest fly (machine)": { a: P(SEAT, { hand: [36, 42], eb: -1 }), b: P(SEAT, { hand: [66, 40], eb: 1 }), props: seat, wt: "grip", cue: "Soft elbows. Bring hands together in a wide hug, then open slowly." },
    "Cable crossover": { a: P(STAND, { t: 15, hand: [42, 20], eb: 1 }), b: P(STAND, { t: 15, hand: [70, 58], eb: 1 }), props: [], cable: [22, 6], wt: "grip", cue: "Lean slightly forward and sweep the handles down and together." },
    "Push-ups": { a: { hip: [49, 86], t: -80, hand: [30, 92], eb: -1, foot: [82, 92], kb: 1 }, b: { hip: [51.7, 77.3], t: -64.5, hand: [30, 92], eb: -1, foot: [82, 92], kb: 1 }, props: [], cue: "Body in one straight line. Chest to the floor, push back up." },
    "Dips": { a: { hip: [44, 63], t: 15, hand: [52, 52], eb: -1, foot: [38, 86], kb: 1 }, b: { hip: [44, 51], t: 15, hand: [52, 52], eb: -1, foot: [38, 76], kb: 1 }, props: dipBars, cue: "Lean forward a little, lower until shoulders are below elbows, push up." },
    /* Back */
    "Deadlift": { a: { hip: [37, 68], t: 62, hand: [58, 81], eb: 1, foot: [52, 92], kb: 1 }, b: { hip: [48, 58], t: 0, hand: [53, 69], eb: 1, foot: [50, 92], kb: 1 }, props: [], wt: "bar", cue: "Flat back, bar close to shins. Push the floor away and stand tall." },
    "Pull-ups": { a: { hip: [50, 57], t: 0, hand: [50, 7], eb: -1, foot: [46, 89], kb: 1 }, b: { hip: [49, 44], t: 0, hand: [50, 7], eb: -1, foot: [43, 75], kb: 1 }, props: pullBar, cue: "Hang with straight arms, pull until your chin clears the bar." },
    "Lat pulldown": { a: P(SEAT, { hip: [46, 68], t: -8, hand: [48, 18], eb: -1 }), b: P(SEAT, { hip: [46, 68], t: -8, hand: [50, 42], eb: -1 }), props: seat, cable: [54, 1], wt: "grip", cue: "Lean back slightly, pull the bar to your upper chest, squeeze your back." },
    "Barbell row": { a: P(HINGE, { hand: [64, 78], eb: 1 }), b: P(HINGE, { hand: [56, 66], eb: -1 }), props: [], wt: "bar", cue: "Hinge forward with a flat back. Row the bar to your belly button." },
    "Seated cable row": { a: { hip: [42, 70], t: 15, hand: [74, 60], eb: 1, foot: [78, 72], kb: 1 }, b: { hip: [42, 70], t: -8, hand: [52, 58], eb: -1, foot: [78, 72], kb: 1 }, props: [{ line: [30, 74, 60, 74], w: 5 }, { line: [82, 62, 82, 80], w: 4 }], cable: [92, 62], wt: "grip", cue: "Sit tall, pull the handle to your stomach, elbows close to your sides." },
    "Dumbbell row": { a: P(HINGE, { hand: [64, 78], eb: 1 }), b: P(HINGE, { hand: [54, 64], eb: -1 }), props: [{ line: [62, 64, 88, 64], w: 5 }, { line: [84, 64, 84, 93], w: 3 }], wt: "db", cue: "One hand and knee on the bench. Row the dumbbell up to your hip." },
    "T-bar row": { a: P(HINGE, { hand: [64, 78], eb: 1 }), b: P(HINGE, { hand: [56, 66], eb: -1 }), props: [], lever: [14, 92], wt: "bar", cue: "Chest up, back flat. Pull the bar toward your chest." },
    "Face pull": { a: P(STAND, { t: -5, hand: [76, 30], eb: 1 }), b: P(STAND, { t: -5, hand: [56, 22], eb: 1 }), props: [], cable: [94, 30], wt: "grip", cue: "Rope at face height. Pull toward your eyes, elbows high and wide." },
    /* Shoulders */
    "Overhead press": { a: P(STAND, { hand: [56, 31], eb: 1 }), b: P(STAND, { hand: [51, 9], eb: 1 }), props: [], wt: "bar", cue: "Bar at your collarbone. Brace your core and press straight overhead." },
    "Dumbbell shoulder press": { a: P(STAND, { hand: [57, 32], eb: 1 }), b: P(STAND, { hand: [52, 9], eb: 1 }), props: [], wt: "db", cue: "Dumbbells at shoulder height, press up until arms are straight." },
    "Arnold press": { a: P(STAND, { hand: [58, 36], eb: 1 }), b: P(STAND, { hand: [51, 9], eb: 1 }), props: [], wt: "db", cue: "Start palms facing you, rotate them out as you press overhead." },
    "Lateral raise": { a: P(STAND, { front: true, hand: [61, 60], eb: -1, foot: [54, 92] }), b: P(STAND, { front: true, hand: [80, 36], eb: -1, foot: [54, 92] }), props: [], wt: "db", cue: "Slight bend in the elbows, raise the dumbbells out to the sides to shoulder height." },
    "Front raise": { a: P(STAND, { hand: [52, 59], eb: 1 }), b: P(STAND, { hand: [74, 32], eb: 1 }), props: [], wt: "db", cue: "Arms almost straight, lift the weight in front to shoulder height." },
    "Rear delt fly": { a: P(HINGE, { hand: [66, 77], eb: 1 }), b: P(HINGE, { hand: [72, 56], eb: 1 }), props: [], wt: "db", cue: "Hinge forward, raise the dumbbells out wide, squeeze your upper back." },
    "Shrugs": { a: P(STAND, { front: true, hand: [58, 59], eb: -1, foot: [54, 92] }), b: P(STAND, { front: true, sy: -4, hand: [58, 55], eb: -1, foot: [54, 92] }), props: [], wt: "db", cue: "Arms straight, lift your shoulders up to your ears and hold for a second." },
    /* Legs */
    "Squat": { a: P(STAND, { hand: [46, 32], eb: 1, foot: [52, 92], kb: 1 }), b: { hip: [38, 74], t: 40, hand: [49, 55], eb: 1, foot: [52, 92], kb: 1 }, props: [], wt: "barS", cue: "Bar on your upper back. Sit down and back until thighs are level, then stand." },
    "Leg press": { a: { hip: [40, 78], t: -60, hand: [44, 82], eb: 1, foot: [60, 62], kb: 1 }, b: { hip: [40, 78], t: -60, hand: [44, 82], eb: 1, foot: [74, 50], kb: 1 }, props: [{ line: [14, 58, 36, 84], w: 5 }, { line: [36, 84, 50, 84], w: 5 }, { line: [58, 78, 92, 44], w: 2 }], sled: true, cue: "Feet shoulder-width on the plate. Lower slowly, push back without locking knees." },
    "Romanian deadlift": { a: P(STAND, { hand: [50, 59], eb: 1, foot: [50, 92], kb: 1 }), b: { hip: [40, 60], t: 70, hand: [62, 77], eb: 1, foot: [50, 92], kb: 1 }, props: [], wt: "bar", cue: "Soft knees. Push your hips back, slide the bar down your legs, feel the hamstrings." },
    "Walking lunges": { a: P(STAND, { hip: [48, 58], foot: [58, 92], kb: 1, foot2: [38, 92], kb2: 1 }), b: { hip: [48, 72], t: 0, foot: [62, 92], kb: 1, foot2: [30, 92], kb2: 1 }, props: [], wt: "db", cue: "Big step forward, drop the back knee toward the floor, step through." },
    "Bulgarian split squat": { a: { hip: [46, 58], t: 0, foot: [58, 92], kb: 1, foot2: [26, 66], kb2: 1 }, b: { hip: [46, 72], t: 10, foot: [60, 92], kb: 1, foot2: [26, 66], kb2: 1 }, props: [{ line: [12, 68, 32, 68], w: 5 }, { line: [22, 68, 22, 93], w: 3 }], wt: "db", cue: "Back foot on a bench. Lower straight down on the front leg." },
    "Leg extension": { a: P(SEAT, { th: 90, sh: 0, foot: null, hand: [50, 70], eb: 1 }), b: P(SEAT, { th: 90, sh: 85, foot: null, hand: [50, 70], eb: 1 }), props: seat, roller: true, cue: "Sit back, straighten your legs fully, lower slowly." },
    "Leg curl": { a: { hip: [52, 58], t: -90, hand: [20, 64], eb: 1, th: 90, sh: 90 }, b: { hip: [52, 58], t: -90, hand: [20, 64], eb: 1, th: 90, sh: 200 }, props: [{ line: [14, 63, 84, 63], w: 5 }, { line: [22, 63, 22, 93], w: 3 }, { line: [76, 63, 76, 93], w: 3 }], roller: true, cue: "Lie face down, curl your heels toward your glutes, lower with control." },
    "Hip thrust": { a: { hip: [50, 76], t: -60, hand: [50, 72], eb: 1, foot: [66, 92], kb: 1 }, b: { hip: [52, 60], t: -86, hand: [52, 56], eb: 1, foot: [66, 92], kb: 1 }, props: [{ line: [14, 62, 32, 62], w: 5 }, { line: [22, 62, 22, 93], w: 3 }], wt: "barP", cue: "Upper back on the bench. Drive your hips up until your body is flat." },
    "Calf raise": { a: P(STAND, { hip: [50, 57], hand: [50, 59], eb: 1, foot: [50, 91], kb: 1 }), b: P(STAND, { hip: [50, 53], hand: [50, 55], eb: 1, foot: [50, 87], kb: 1 }), props: [{ line: [42, 93, 64, 93], w: 4 }], wt: "db", cue: "Balls of your feet on a step. Rise up high, lower your heels below the step." },
    /* Biceps */
    "Barbell curl": { a: P(STAND, { ua: 0, fa: 10 }), b: P(STAND, { ua: 8, fa: 150 }), props: [], wt: "bar", cue: "Elbows pinned to your sides. Curl up, squeeze, lower all the way." },
    "Dumbbell curl": { a: P(STAND, { ua: 0, fa: 10 }), b: P(STAND, { ua: 8, fa: 150 }), props: [], wt: "db", cue: "Palms up, elbows still. Curl to your shoulders and lower slowly." },
    "Hammer curl": { a: P(STAND, { ua: 0, fa: 10 }), b: P(STAND, { ua: 8, fa: 150 }), props: [], wt: "db", cue: "Palms facing each other. Curl up without swinging." },
    "Preacher curl": { a: { hip: [42, 68], t: 10, ua: 45, fa: 30, foot: [62, 92], kb: 1 }, b: { hip: [42, 68], t: 10, ua: 45, fa: 165, foot: [62, 92], kb: 1 }, props: [{ line: [44, 40, 66, 58], w: 5 }, { line: [58, 58, 58, 93], w: 3 }], wt: "bar", cue: "Upper arms flat on the pad. Curl up, lower until arms are almost straight." },
    "Cable curl": { a: P(STAND, { ua: 0, fa: 10 }), b: P(STAND, { ua: 8, fa: 150 }), props: [], cable: [82, 92], wt: "grip", cue: "Stand close to a low pulley. Elbows still, curl the handle up." },
    "Incline dumbbell curl": { a: { hip: [52, 68], t: -30, ua: -15, fa: -15, foot: [72, 92], kb: 1 }, b: { hip: [52, 68], t: -30, ua: -10, fa: 140, foot: [72, 92], kb: 1 }, props: [{ line: [30, 36, 50, 72], w: 5 }, { line: [48, 72, 64, 72], w: 5 }, { line: [56, 72, 56, 93], w: 3 }], wt: "db", cue: "Lie back on an incline, arms hanging. Curl without moving your elbows." },
    /* Triceps */
    "Tricep pushdown": { a: P(STAND, { t: 8, ua: 10, fa: 125 }), b: P(STAND, { t: 8, ua: 10, fa: 5 }), props: [], cable: [66, 2], wt: "grip", cue: "Elbows tucked at your sides. Push down until arms are straight." },
    "Overhead tricep extension": { a: P(STAND, { ua: 172, fa: -15 }), b: P(STAND, { ua: 172, fa: 178 }), props: [], wt: "db", cue: "Weight behind your head, elbows pointing up. Straighten your arms." },
    "Skull crushers": { a: P(FLAT, { ua: 172, fa: -60 }), b: P(FLAT, { ua: 178, fa: 178 }), props: flatBench, wt: "bar", cue: "Upper arms still. Lower the bar toward your forehead, then extend." },
    "Close-grip bench press": { a: P(FLAT, { hand: [37, 51], eb: -1 }), b: P(FLAT, { hand: [35, 37], eb: -1 }), props: flatBench, wt: "bar", cue: "Hands shoulder-width, elbows tucked. Lower to lower chest, press up." },
    "Tricep dips": { a: { hip: [48, 63], t: 0, hand: [52, 52], eb: -1, foot: [42, 86], kb: 1 }, b: { hip: [48, 51], t: 0, hand: [52, 52], eb: -1, foot: [42, 76], kb: 1 }, props: dipBars, cue: "Body upright. Lower until elbows reach 90°, then push up." },
    /* Core */
    "Hanging leg raise": { a: { hip: [50, 57], t: 0, hand: [50, 7], eb: -1, th: 0, sh: 0 }, b: { hip: [48, 57], t: -6, hand: [50, 7], eb: -1, th: 88, sh: 88 }, props: pullBar, cue: "Hang still, lift your legs to hip height without swinging." },
    "Cable crunch": { a: P(KNEEL, { t: -8, hand: [52, 30], eb: -1 }), b: P(KNEEL, { t: 62, hand: [68, 62], eb: -1 }), props: [], cable: [62, 2], wt: "grip", cue: "Kneel, rope by your head. Crunch your ribs toward your hips." },
    "Ab wheel rollout": { a: P(KNEEL, { t: 35, hand: [62, 88], eb: 1 }), b: P(KNEEL, { t: 78, hand: [86, 88], eb: 1 }), props: [], wt: "wheel", cue: "From your knees, roll out slowly with a tight core, then pull back." },
    "Russian twist": { a: { hip: [46, 84], t: -35, hand: [62, 66], eb: 1, foot: [72, 74], kb: 1 }, b: { hip: [46, 84], t: -40, hand: [50, 74], eb: 1, foot: [72, 74], kb: 1 }, props: [], wt: "db", cue: "Lean back, feet up. Rotate the weight from side to side." },
    "Crunches": { a: { hip: [58, 88], t: -90, hand: [28, 84], eb: -1, foot: [76, 92], kb: 1 }, b: { hip: [58, 88], t: -62, hand: [32, 72], eb: -1, foot: [76, 92], kb: 1 }, props: [], cue: "Knees bent, lift your shoulders off the floor, lower slowly." }
  };
  var BY_PART = { Chest: "Bench press", Back: "Barbell row", Shoulders: "Dumbbell shoulder press", Legs: "Squat", Biceps: "Dumbbell curl", Triceps: "Tricep pushdown", Core: "Crunches" };
  var WORDS = [["pull", "Pull-ups"], ["chin", "Pull-ups"], ["row", "Barbell row"], ["deadlift", "Deadlift"], ["squat", "Squat"], ["lunge", "Walking lunges"], ["leg press", "Leg press"], ["curl", "Dumbbell curl"], ["pushdown", "Tricep pushdown"], ["extension", "Overhead tricep extension"], ["dip", "Dips"], ["push", "Push-ups"], ["fly", "Chest fly (machine)"], ["raise", "Lateral raise"], ["press", "Dumbbell shoulder press"], ["crunch", "Crunches"], ["plank", "Push-ups"], ["calf", "Calf raise"]];
  function pick(name, part) {
    if (EX[name]) return EX[name];
    var n = String(name || "").toLowerCase();
    for (var i = 0; i < WORDS.length; i++) if (n.indexOf(WORDS[i][0]) >= 0) {
      if (WORDS[i][0] === "press" && part === "Chest") return EX["Bench press"];
      if (WORDS[i][0] === "press" && part === "Legs") return EX["Leg press"];
      return EX[WORDS[i][1]];
    }
    return EX[BY_PART[part] || "Dumbbell curl"];
  }

  /* ---- drawing ---- */
  var DUR = "2.8s", SPL = ".45 0 .55 1;.45 0 .55 1";
  function f(n) { return Math.round(n * 10) / 10; }
  function anim(attr, a, b, on) { return on && a !== b ? '<animate attributeName="' + attr + '" values="' + a + ";" + b + ";" + a + '" keyTimes="0;.5;1" calcMode="spline" keySplines="' + SPL + '" dur="' + DUR + '" repeatCount="indefinite"/>' : ""; }
  function seg(p, q, A, B, w, cls, on) {
    if (!A[p] || !A[q] || !B[p] || !B[q]) return "";
    var x1 = f(A[p][0]), y1 = f(A[p][1]), x2 = f(A[q][0]), y2 = f(A[q][1]);
    return '<line class="' + cls + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke-width="' + w + '">' +
      anim("x1", x1, f(B[p][0]), on) + anim("y1", y1, f(B[p][1]), on) + anim("x2", x2, f(B[q][0]), on) + anim("y2", y2, f(B[q][1]), on) + "</line>";
  }
  function dot(k, A, B, r, cls, on, dx, dy) {
    dx = dx || 0; dy = dy || 0;
    var x = f(A[k][0] + dx), y = f(A[k][1] + dy);
    return '<circle class="' + cls + '" cx="' + x + '" cy="' + y + '" r="' + r + '">' + anim("cx", x, f(B[k][0] + dx), on) + anim("cy", y, f(B[k][1] + dy), on) + "</circle>";
  }
  function rectAt(k, A, B, w, h, cls, on) {
    var x = f(A[k][0] - w / 2), y = f(A[k][1] - h / 2);
    return '<rect class="' + cls + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="1.5">' + anim("x", x, f(B[k][0] - w / 2), on) + anim("y", y, f(B[k][1] - h / 2), on) + "</rect>";
  }

  function svg(name, part, animate, size) {
    var e = pick(name, part), on = !!animate;
    try { if (on && window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) on = false; } catch (x) {}
    var A = solve(e.a), B = solve(e.b);
    // static thumbnails show the end position
    if (!on) A = B;
    var g = '<line class="fg-floor" x1="4" y1="94" x2="96" y2="94" stroke-width="2"/>';
    (e.props || []).forEach(function (p) { if (p.line) g += '<line class="fg-prop" x1="' + p.line[0] + '" y1="' + p.line[1] + '" x2="' + p.line[2] + '" y2="' + p.line[3] + '" stroke-width="' + (p.w || 3) + '"/>'; });
    if (e.cable) { g += '<circle class="fg-prop2" cx="' + e.cable[0] + '" cy="' + e.cable[1] + '" r="2.5"/>'; A.C = e.cable; B.C = e.cable; g += seg("C", "W", A, B, 1.2, "fg-cable", on); }
    if (e.lever) { A.L = e.lever; B.L = e.lever; g += seg("L", "W", A, B, 2.5, "fg-prop", on); }
    var front = !!e.a.front;
    // far limbs (drawn lighter, behind)
    if (front) { g += seg("Pb", "Kb", A, B, 5, "fg-far", on) + seg("Kb", "Fb", A, B, 5, "fg-far", on) + seg("Sb", "Eb", A, B, 4.5, "fg-far", on) + seg("Eb", "Wb", A, B, 4.5, "fg-far", on); }
    if (A.K2) g += seg("P", "K2", A, B, 5.5, "fg-far", on) + seg("K2", "F2", A, B, 5.5, "fg-far", on);
    // body
    g += seg("P", "S", A, B, 6.5, "fg-body", on);
    if (front) g += seg("Pa", "P", A, B, 6.5, "fg-body", on) + seg("Sb", "Sa", A, B, 6, "fg-body", on);
    g += seg(front ? "Pa" : "P", "K", A, B, 5.5, "fg-body", on) + seg("K", "F", A, B, 5.5, "fg-body", on);
    g += seg(front ? "Sa" : "S", "E", A, B, 5, "fg-body", on) + seg("E", "W", A, B, 5, "fg-body", on);
    g += dot("H", A, B, 5.6, "fg-head", on);
    // equipment
    var w = e.wt;
    if (w === "bar") g += dot("W", A, B, 6.5, "fg-plate", on) + dot("W", A, B, 1.8, "fg-hub", on);
    else if (w === "barS") g += dot("S", A, B, 6.5, "fg-plate", on, -6, 1) + dot("S", A, B, 1.8, "fg-hub", on, -6, 1);
    else if (w === "barP") g += dot("P", A, B, 6.5, "fg-plate", on, 0, -5) + dot("P", A, B, 1.8, "fg-hub", on, 0, -5);
    else if (w === "db") { g += rectAt("W", A, B, 9, 4.5, "fg-db", on); if (front) g += rectAt("Wb", A, B, 9, 4.5, "fg-db", on); }
    else if (w === "grip") g += dot("W", A, B, 2.6, "fg-db", on);
    else if (w === "wheel") g += dot("W", A, B, 4.5, "fg-plate", on);
    if (e.sled) g += rectAt("F", A, B, 4, 16, "fg-db", on);
    if (e.roller) g += dot("F", A, B, 3.2, "fg-db", on);
    var sz = size ? ' width="' + size + '" height="' + size + '"' : "";
    return '<svg class="fig" viewBox="0 0 100 100"' + sz + ' role="img" aria-label="' + String(name).replace(/[&<>"']/g, "") + ' position">' + g + "</svg>";
  }
  function cue(name, part) { return pick(name, part).cue + (EX[name] ? "" : " (Example shown — your exercise may differ.)"); }

  /* ---- muscles worked (keys drive the 3D highlight; labels show in the How-to view) ---- */
  var MUSCLE_LABEL = { pecs: "Chest", delts: "Shoulders", traps: "Traps", lats: "Lats", biceps: "Biceps", triceps: "Triceps", forearms: "Forearms", abs: "Abs", obliques: "Obliques", glutes: "Glutes", quads: "Quads", hams: "Hamstrings", calves: "Calves", lowback: "Lower back" };
  var PART_MUS = { Chest: ["pecs", "delts", "triceps"], Back: ["lats", "traps", "biceps"], Shoulders: ["delts", "traps"], Legs: ["quads", "glutes", "hams"], Biceps: ["biceps", "forearms"], Triceps: ["triceps"], Core: ["abs", "obliques"] };
  var MUS = {
    "Chest fly (machine)": ["pecs", "delts"], "Cable crossover": ["pecs", "delts"], "Push-ups": ["pecs", "triceps", "delts", "abs"], "Dips": ["pecs", "triceps", "delts"],
    "Deadlift": ["glutes", "hams", "lowback", "traps", "forearms"], "Pull-ups": ["lats", "biceps", "forearms"], "Face pull": ["delts", "traps"], "T-bar row": ["lats", "traps", "biceps", "lowback"],
    "Lateral raise": ["delts"], "Front raise": ["delts"], "Rear delt fly": ["delts", "traps"], "Shrugs": ["traps", "forearms"],
    "Squat": ["quads", "glutes", "hams", "lowback"], "Leg press": ["quads", "glutes"], "Romanian deadlift": ["hams", "glutes", "lowback"], "Walking lunges": ["quads", "glutes", "hams"],
    "Bulgarian split squat": ["quads", "glutes"], "Leg extension": ["quads"], "Leg curl": ["hams"], "Hip thrust": ["glutes", "hams"], "Calf raise": ["calves"],
    "Close-grip bench press": ["triceps", "pecs"], "Hanging leg raise": ["abs", "obliques", "forearms"], "Ab wheel rollout": ["abs", "lats"], "Russian twist": ["obliques", "abs"]
  };
  var TIPS = {
    Chest: ["Keep your shoulder blades squeezed together and down.", "Lower for about 2 seconds, push up with power.", "Breathe in on the way down, out as you push."],
    Back: ["Lead with your elbows, not your hands.", "Pause and squeeze your back at the top.", "Keep your chest up and back flat."],
    Shoulders: ["Brace your core so your lower back doesn’t arch.", "Use a weight you can control without swinging.", "Stop just short of shrugging your shoulders up."],
    Legs: ["Keep your knees in line with your toes.", "Push through your whole foot, not just the toes.", "Control the way down — no bouncing."],
    Biceps: ["Keep your elbows still at your sides.", "Lower all the way for a full stretch.", "Squeeze at the top for a second."],
    Triceps: ["Keep your upper arms still.", "Lock out fully and squeeze.", "Lower slowly — the stretch builds strength."],
    Core: ["Move slowly and keep tension the whole time.", "Breathe out as you crunch or lift.", "Stop if you feel it in your lower back."]
  };
  function muscles(name, part) { return (MUS[name] || PART_MUS[part] || PART_MUS.Chest).slice(); }
  function partOf(name, part) { if (part) return part; for (var p in BY_PART) if (BY_PART[p] === name) return p; return "Chest"; }

  window.figSvg = svg;
  window.figCue = cue;
  window.figNames = Object.keys(EX);
  window.figPose = function (name, part) { var e = pick(name, part); return { e: e, A: solve(e.a), B: solve(e.b), front: !!e.a.front }; };
  window.figMuscles = function (name, part) { return muscles(name, partOf(name, part)); };
  window.figMuscleLabel = MUSCLE_LABEL;
  window.figTips = function (name, part) { return TIPS[partOf(name, part)] || TIPS.Chest; };
})();
