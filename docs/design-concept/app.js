/* Rulebook design concept. Vanilla JS, no dependencies. All data below is fictional DEMO content. */
"use strict";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c != null) node.append(c);
  return node;
};
const icon = (id) => {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("aria-hidden", "true");
  const u = document.createElementNS("http://www.w3.org/2000/svg", "use");
  u.setAttribute("href", "#" + id);
  s.append(u);
  return s;
};

/* ---------------- Physics: damped spring (semi-implicit Euler, fixed substeps) ---------------- */
class Spring {
  constructor({ value = 0, k = 170, c = 26, m = 1, onUpdate, onRest }) {
    Object.assign(this, { value, target: value, velocity: 0, k, c, m, onUpdate, onRest });
    this.raf = 0;
    this.last = 0;
    this.tick = this.tick.bind(this);
  }
  to(target, velocity) {
    this.target = target;
    if (velocity !== undefined) this.velocity = velocity;
    if (reducedMotion.matches) return this.set(target);
    if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.tick); }
  }
  set(value) {
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.value = this.target = value; this.velocity = 0;
    this.onUpdate && this.onUpdate(value);
    this.onRest && this.onRest(value);
  }
  tick(now) {
    let dt = Math.min((now - this.last) / 1000, 1 / 30);
    this.last = now;
    const step = 1 / 240;
    while (dt > 0) {
      const h = Math.min(step, dt);
      const force = -this.k * (this.value - this.target) - this.c * this.velocity;
      this.velocity += (force / this.m) * h;
      this.value += this.velocity * h;
      dt -= h;
    }
    this.onUpdate && this.onUpdate(this.value);
    if (Math.abs(this.velocity) < 0.002 && Math.abs(this.value - this.target) < 0.0005) {
      this.raf = 0; this.value = this.target; this.onUpdate && this.onUpdate(this.value);
      this.onRest && this.onRest(this.value);
      return;
    }
    this.raf = requestAnimationFrame(this.tick);
  }
}

/* Compile a spring into CSS linear() so CSS transitions move like real springs */
function springToLinear({ k, c, m = 1, duration = 0.9, samples = 48 }) {
  let x = 0, v = 0;
  const pts = [];
  const dt = duration / samples;
  for (let i = 0; i <= samples; i++) {
    pts.push(+(x).toFixed(4));
    for (let s = 0; s < 8; s++) {
      const h = dt / 8;
      v += ((-k * (x - 1) - c * v) / m) * h;
      x += v * h;
    }
  }
  pts[pts.length - 1] = 1;
  return "linear(" + pts.join(", ") + ")";
}
(function installSpringEasing() {
  const easing = springToLinear({ k: 170, c: 19 });
  if (window.CSS && CSS.supports("transition-timing-function", easing)) {
    document.documentElement.style.setProperty("--ease-spring", easing);
  }
})();

/* ---------------- Demo data (fictional) ---------------- */
const DOCS = {
  handbook: { title: "Student Handbook 2025", short: "Handbook", type: "Handbook", date: "Effective 1 Jul 2025", pages: 96, pattern: "ruled" },
  regs: { title: "B.Tech Academic Regulations R22", short: "Regulations R22", type: "Regulations", date: "Effective AY 2022-23", pages: 86, pattern: "grid" },
  placement: { title: "Placement Policy 2025-26", short: "Placement Policy", type: "Policy", date: "Effective 15 Jun 2025", pages: 24, pattern: "stripes" },
  hostel: { title: "Hostel Rules", short: "Hostel Rules", type: "Rules", date: "Revised Jan 2025", pages: 18, pattern: "dots" },
  circular: { title: "Circular: Revised attendance condonation", short: "Circular 03/2025", type: "Circular", date: "Dated 3 Mar 2025", pages: 2, pattern: "zigzag", sticker: "Updated circular" },
  syllabus: { title: "CSE Syllabus, Semester 5", short: "CSE Syllabus", type: "Syllabus", date: "Effective AY 2025-26", pages: 38, pattern: "plus" },
};

/* Page text. `m` marks a passage that a citation can highlight. */
const PAGES = {
  "handbook:14": { section: "Section 4 · Attendance", blocks: [
    { h: "4.1 Minimum attendance" },
    { p: "Attendance is recorded for every scheduled lecture, tutorial and laboratory session. It is computed separately for each course registered in the semester." },
    { p: "A student must have a minimum of 75% attendance in each course to be eligible to write the end-semester examination of that course.", m: "a" },
    { p: "Attendance is counted from the first instructional day of the semester as notified in the academic calendar, irrespective of the date of admission or registration." },
    { h: "4.2 Leave on duty" },
    { p: "Students representing the Institute in sports, cultural or technical events with prior written approval of the Head of Department may be granted on-duty leave, which is counted as attendance up to a maximum of 10% of the classes in a course.", m: "b" },
  ]},
  "handbook:22": { section: "Section 4 · Attendance (continued)", blocks: [
    { h: "4.6 Condonation of shortage" },
    { p: "Shortage of attendance may be condoned by the Academic Council on medical grounds or for other valid reasons, provided the attendance in the course is not less than 60%.", m: "a" },
    { note: "superseded by Circular 03/2025" },
    { p: "A condonation fee as notified by the Institute shall be paid. Condonation may be granted to a student a maximum of two times during the programme." },
    { p: "Students whose shortage is not condoned shall be detained in the course and must re-register for it when it is next offered." },
  ]},
  "handbook:31": { section: "Section 9 · Scholarships and concessions", blocks: [
    { h: "9.1 Merit scholarships" },
    { p: "Merit scholarships are awarded each year to the top 5% of students in each programme, based on the CGPA of the previous academic year, as a waiver of 50% of the tuition fee.", m: "a" },
    { h: "9.2 Fee concessions" },
    { p: "Students from families with an annual income below the limit notified by the State Government may apply for a fee concession through the Accounts Section before 31 August." },
  ]},
  "circular:1": { section: "Office of the Dean, Academics · No. NIT/ACAD/03/2025 · 3 March 2025", blocks: [
    { h: "Subject: Revised norms for condonation of attendance shortage" },
    { p: "In partial modification of Clause 4.6 of the Student Handbook, the Academic Council in its meeting held on 24 February 2025 has resolved as follows, with effect from the Even Semester 2024-25:" },
    { p: "(a) Shortage of attendance may be condoned only where the attendance in the course is not less than 65%, on medical grounds supported by certificates, or for representing the Institute.", m: "a" },
    { p: "(b) A condonation fee of Rs. 500 per course shall be paid before the last date for submission of examination forms.", m: "b" },
    { p: "(c) All other provisions of Clause 4.6 remain unchanged." },
  ]},
  "placement:3": { section: "Section 1 · About the Cell", blocks: [
    { h: "1.4 Training resources" },
    { p: "The Training and Placement Cell maintains a computer laboratory with 60 systems, open from 9 am to 8 pm on working days, for aptitude practice and online assessments.", m: "a" },
  ]},
  "placement:6": { section: "Section 3 · Eligibility", blocks: [
    { h: "3.1 Eligibility to register" },
    { p: "A student is eligible to register with the Training and Placement Cell if they have a CGPA of 6.0 or above, without rounding, at the time of registration, and not more than one active backlog.", m: "a" },
    { h: "3.2 Active backlogs" },
    { p: "An active backlog is a course for which the student has not secured a pass grade. A backlog cleared in a supplementary examination ceases to be active from the date the results are published.", m: "b" },
    { h: "3.3 Company criteria" },
    { p: "Recruiting organisations may prescribe eligibility criteria stricter than the above. Such criteria, stated in the drive notification, shall prevail for that drive.", m: "c" },
    { h: "3.4 After an offer" },
    { p: "A student who has accepted one offer may apply to a further drive only if the CTC offered is at least 1.5 times that of the accepted offer.", m: "d" },
  ]},
  "regs:41": { section: "Clause 14 · Revaluation and photocopy", blocks: [
    { p: "14.1 A student may apply for revaluation of an end-semester theory examination answer script within seven working days of the publication of results, through the examination portal.", m: "a" },
    { p: "14.2 The fee is Rs. 1,000 per course for revaluation and Rs. 300 per course for a photocopy of the answer script.", m: "b" },
    { p: "14.3 If revaluation results in a change of 15% or more of the maximum marks, the revaluation fee shall be refunded.", m: "c" },
    { p: "14.4 Revaluation is not permitted for laboratory, project work, seminar or internship evaluations.", m: "d" },
  ]},
  "hostel:9": { section: "Section 7 · Room allotment and change", blocks: [
    { p: "7.1 Rooms are allotted at the beginning of the academic year by the Chief Warden, based on year of study and availability." },
    { p: "7.2 Requests for a change of room are considered only during the first two weeks of each semester, by written application to the Warden.", m: "a" },
    { p: "7.3 A change of room outside this period may be permitted only on medical grounds, on the recommendation of the Institute Medical Officer and with the approval of the Chief Warden.", m: "b" },
  ]},
  "syllabus:3": { section: "Programme structure · Semester V", blocks: [
    { h: "Professional Elective I (choose one)" },
    { p: "CS5E1 Cloud Computing; CS5E2 Natural Language Processing; CS5E3 Computer Graphics; CS5E4 Software Testing. Each carries 3 credits.", m: "a" },
    { h: "Open Elective I" },
    { p: "Chosen from the list published by the Dean, Academics, before the start of the semester. Students may not choose an open elective offered by their own department.", m: "b" },
  ]},
};

const ANSWERS = {
  attendance: {
    q: "What's the minimum attendance for end-sem exams?",
    blocks: [
      { p: ["You need ", { b: "at least 75% attendance in each course" }, " to write that course's end-semester exam. It's counted per course, not as an overall average.", { c: "handbook:14:a" }] },
      { ul: [
        ["If you're short, you can ask for condonation only if you're at ", { b: "65% or above" }, " and have a medical reason or were representing the college.", { c: "circular:1:a" }],
        ["Condonation costs ", { b: "Rs. 500 per course" }, ", paid before the exam form deadline.", { c: "circular:1:b" }],
        ["Approved on-duty leave for sports or events counts as attendance, up to 10% of a course's classes.", { c: "handbook:14:b" }],
      ]},
    ],
    conflict: {
      text: ["The Handbook allows condonation down to 60%", { c: "handbook:22:a" }, ". Circular 03/2025, dated 3 Mar 2025, raised that to 65%", { c: "circular:1:a" }, ". The answer above uses the circular."],
    },
    followups: ["How many backlogs are allowed for placements?", "How do I apply for re-evaluation?", "Is there a laptop subsidy for first years?"],
  },
  placement: {
    q: "How many backlogs are allowed for placements?",
    blocks: [
      { p: ["You can register for placements with ", { b: "at most one active backlog" }, " and a ", { b: "CGPA of 6.0 or more" }, ". The CGPA is not rounded, so 5.98 does not count.", { c: "placement:6:a" }] },
      { p: ["A backlog stops being active the day supplementary results are published, so clearing it in supplementaries makes you eligible again.", { c: "placement:6:b" }] },
      { p: ["Companies can ask for more, like zero backlogs. Their criteria are in each drive notice and override this minimum.", { c: "placement:6:c" }, " Once you accept an offer, you can only apply to drives paying at least 1.5 times that CTC.", { c: "placement:6:d" }] },
    ],
    followups: ["What's the minimum attendance for end-sem exams?", "Is revaluation allowed for lab exams?"],
  },
  reeval: {
    q: "How do I apply for re-evaluation?",
    blocks: [
      { p: ["Apply on the exam portal ", { b: "within 7 working days" }, " of results being published.", { c: "regs:41:a" }] },
      { ul: [
        ["Revaluation is ", { b: "Rs. 1,000 per course" }, "; a photocopy of your answer script is Rs. 300.", { c: "regs:41:b" }],
        ["If your marks change by 15% of the maximum or more, the revaluation fee is refunded.", { c: "regs:41:c" }],
        ["It is only for theory papers. Labs, projects, seminars and internships can't be revalued.", { c: "regs:41:d" }],
      ]},
    ],
    followups: ["How many backlogs are allowed for placements?", "What are the Sem 5 CSE electives?"],
  },
  hostel: {
    q: "Can I change my hostel room mid-semester?",
    blocks: [
      { p: ["Usually not. Room changes are considered ", { b: "only in the first two weeks of each semester" }, ", by written application to the Warden.", { c: "hostel:9:a" }] },
      { p: ["Mid-semester, it's possible only on medical grounds, with a recommendation from the Institute Medical Officer and the Chief Warden's approval.", { c: "hostel:9:b" }] },
    ],
    followups: ["What's the minimum attendance for end-sem exams?", "Is there a laptop subsidy for first years?"],
  },
  electives: {
    q: "What are the Sem 5 CSE electives?",
    blocks: [
      { p: ["For Professional Elective I you pick one of ", { b: "Cloud Computing, NLP, Computer Graphics or Software Testing" }, ", 3 credits each.", { c: "syllabus:3:a" }] },
      { p: ["Open Elective I comes from the Dean's list published before the semester, and it can't be one offered by your own department.", { c: "syllabus:3:b" }] },
    ],
    followups: ["How do I apply for re-evaluation?", "How many backlogs are allowed for placements?"],
  },
  notfound: {
    q: "Is there a laptop subsidy for first years?",
    notfound: true,
    closest: [
      { ref: "handbook:31:a", text: "Merit scholarships are awarded each year to the top 5% of students in each programme...", score: "Weak match" },
      { ref: "placement:3:a", text: "The Training and Placement Cell maintains a computer laboratory with 60 systems...", score: "Weak match" },
    ],
    followups: ["What's the minimum attendance for end-sem exams?", "Can I change my hostel room mid-semester?"],
  },
};

const ROUTES = [
  ["notfound", /laptop|subsidy|bus|wifi|wi-fi|canteen|dress/],
  ["reeval", /re-?eval|revaluat|photocopy|answer script|recheck/],
  ["placement", /backlog|placement|cgpa|drive|offer|ctc|recruit/],
  ["hostel", /hostel|room|warden|mess/],
  ["electives", /elective|syllabus|sem(ester)? ?5|credits/],
  ["attendance", /attendance|condon|medical|detain|on-duty|sports|75/],
];
const routeQuestion = (q) => (ROUTES.find(([, re]) => re.test(q.toLowerCase())) || ["notfound"])[0];

const TICKER = {
  a: ["How many backlogs are allowed for placements?", "What's the minimum attendance for end-sem exams?", "How do I apply for re-evaluation?", "Can I change my hostel room mid-semester?", "Is there a laptop subsidy for first years?", "What are the Sem 5 CSE electives?", "Can medical leave be condoned?"],
  b: ["Is CGPA 5.98 rounded to 6 for placements?", "What does a photocopy of my answer script cost?", "Does sports duty count as attendance?", "Can I sit a second drive after getting an offer?", "Can I take an open elective from my own department?", "What's the condonation fee?", "Is revaluation allowed for lab exams?"],
};

const parseRef = (ref) => { const [doc, page, mark] = ref.split(":"); return { doc, page: +page, mark: mark || null }; };
const citeLabel = (ref) => { const { doc, page } = parseRef(ref); return DOCS[doc].short + " p." + page; };

/* ---------------- Toast ---------------- */
let toastTimer = 0;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-toast]");
  if (b) toast(b.dataset.toast);
});

/* ---------------- Theme ---------------- */
function applyTheme(mode) {
  const root = document.documentElement;
  try {
    if (mode === "system") { delete root.dataset.theme; localStorage.removeItem("rb-theme"); }
    else { root.dataset.theme = mode; localStorage.setItem("rb-theme", mode); }
  } catch (e) { if (mode !== "system") root.dataset.theme = mode; }
  syncThemeButtons();
}
function effectiveTheme() {
  const t = document.documentElement.dataset.theme;
  if (t) return t;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function syncThemeButtons() {
  const explicit = document.documentElement.dataset.theme || "system";
  const eff = effectiveTheme();
  $$("[data-theme-set]").forEach((b) => {
    const inStrip = !!b.closest(".concept-strip");
    const on = inStrip ? b.dataset.themeSet === eff : b.dataset.themeSet === explicit;
    b.setAttribute("aria-pressed", String(on));
  });
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-theme-set]");
  if (b) applyTheme(b.dataset.themeSet);
});
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncThemeButtons);

/* ---------------- Springy square buttons ---------------- */
const pressSprings = new WeakMap();
function pressSpring(btn) {
  let s = pressSprings.get(btn);
  if (!s) {
    s = new Spring({ value: 1, k: 600, c: 22, onUpdate: (v) => btn.style.setProperty("--press", v.toFixed(4)) });
    pressSprings.set(btn, s);
  }
  return s;
}
function press(btn, down) {
  if (!btn || btn.disabled) return;
  btn.classList.toggle("is-pressed", down);
  pressSpring(btn).to(down ? 0.94 : 1);
}
document.addEventListener("pointerdown", (e) => press(e.target.closest("[data-spring]"), true));
["pointerup", "pointercancel"].forEach((t) => document.addEventListener(t, () => $$("[data-spring].is-pressed").forEach((b) => press(b, false))));
document.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) press(e.target.closest && e.target.closest("[data-spring]"), true); });
document.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") $$("[data-spring].is-pressed").forEach((b) => press(b, false)); });

/* ---------------- Stickers: spring pop ---------------- */
function popSticker(node, delay = 0) {
  if (reducedMotion.matches) { node.style.setProperty("--pop", "1"); return; }
  node.style.setProperty("--pop", "0");
  setTimeout(() => {
    const s = new Spring({ value: 0, k: 420, c: 16, onUpdate: (v) => node.style.setProperty("--pop", Math.max(0, v).toFixed(4)) });
    s.to(1, 2);
  }, delay);
}
const stickerObserver = new IntersectionObserver((entries) => {
  entries.forEach((en, i) => {
    if (!en.isIntersecting) return;
    stickerObserver.unobserve(en.target);
    popSticker(en.target, i * 90);
  });
}, { threshold: 0.6 });
function watchStickers(root = document) {
  $$("[data-sticker]", root).forEach((s) => { if (!s.closest("[hidden]")) stickerObserver.observe(s); });
}

/* ---------------- Word-by-word heading reveal ---------------- */
function splitWords(heading) {
  const label = heading.textContent.replace(/\s+/g, " ").trim();
  const visual = el("span", { "aria-hidden": "true" });
  let i = 0;
  const addWords = (text, cls) => {
    text.split(/\s+/).filter(Boolean).forEach((word) => {
      const inner = el("span", { text: word });
      if (cls) inner.className = cls;
      const w = el("span", { class: "w" }, inner);
      w.style.setProperty("--i", i++);
      visual.append(w, " ");
    });
  };
  heading.childNodes.forEach((n) => {
    if (n.nodeType === 3) addWords(n.textContent);
    else if (n.nodeType === 1) addWords(n.textContent, n.className);
  });
  heading.textContent = "";
  heading.append(el("span", { class: "visually-hidden", text: label }), visual);
}
function initReveals() {
  const heads = $$(".reveal");
  heads.forEach(splitWords);
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold: 0.35 });
  heads.forEach((h) => {
    if (h.dataset.reveal === "load") {
      const go = () => requestAnimationFrame(() => h.classList.add("in"));
      (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(go, go);
    } else io.observe(h);
  });
  const stepIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); stepIO.unobserve(en.target); } });
  }, { threshold: 0.3 });
  $$("[data-inview]").forEach((s) => stepIO.observe(s));
}

/* ---------------- Cover patterns (type is told apart by pattern, not colour) ---------------- */
const PATTERN_TILES = {
  ruled: '<pattern id="ID" width="12" height="10" patternUnits="userSpaceOnUse"><path d="M0 9.5h12" stroke="currentColor" stroke-width="1.2"/></pattern>',
  grid: '<pattern id="ID" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M14 0V14H0" fill="none" stroke="currentColor" stroke-width="1.2"/></pattern>',
  stripes: '<pattern id="ID" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="10" fill="currentColor"/></pattern>',
  dots: '<pattern id="ID" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="2.2" fill="currentColor"/></pattern>',
  zigzag: '<pattern id="ID" width="16" height="12" patternUnits="userSpaceOnUse"><path d="M0 9l4-6 4 6 4-6 4 6" fill="none" stroke="currentColor" stroke-width="1.6"/></pattern>',
  plus: '<pattern id="ID" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M8 4v8M4 8h8" stroke="currentColor" stroke-width="1.6"/></pattern>',
};
let patternSeq = 0;
function patternSVG(kind) {
  const id = "pt-" + kind + "-" + patternSeq++;
  return '<svg aria-hidden="true" width="100%" height="100%"><defs>' + PATTERN_TILES[kind].replace("ID", id) + '</defs><rect width="100%" height="100%" fill="url(#' + id + ')"/></svg>';
}

/* ---------------- Shelf: drag, flick, friction, rubber band, idle drift ---------------- */
function initShelf() {
  const viewport = $("#shelf-viewport");
  const track = $("#shelf-track");
  Object.entries(DOCS).forEach(([key, d]) => {
    const cover = el("button", { type: "button", class: "cover" + (key === "circular" ? " cover--circular" : ""), "data-open-doc": key, "aria-label": d.title + ", " + d.type + ", " + d.date + ", " + d.pages + " pages, demo document. Open." });
    cover.innerHTML = '<span class="pattern">' + patternSVG(d.pattern) + '</span>' +
      '<span class="type">' + d.type + '</span><span class="demo">DEMO</span>' +
      '<span class="title">' + d.title + '</span>' +
      '<span class="meta"><span>' + d.date + '</span><span>' + d.pages + ' pp</span></span>';
    if (d.sticker) cover.append(el("span", { class: "sticker sticker--accent", "data-sticker": "", text: d.sticker }));
    track.append(el("li", {}, cover));
  });

  const FRICTION = 0.94, RUBBER = 0.35, EDGE_K = 170, EDGE_C = 26, DRIFT = 12;
  let x = 0, v = 0, min = 0, dragging = false, moved = 0, lastX = 0, lastT = 0, samples = [];
  let target = null, raf = 0, prev = 0, lastInput = -1e9, hover = false, focused = false, visible = false, driftDir = -1, lean = 0;

  const measure = () => { min = Math.min(0, viewport.clientWidth - track.scrollWidth); };
  const rubber = (val) => (val > 0 ? val * RUBBER : val < min ? min + (val - min) * RUBBER : val);
  const render = () => {
    track.style.transform = "translate3d(" + x.toFixed(2) + "px,0,0)";
    track.style.setProperty("--lean", lean.toFixed(2) + "deg");
  };
  const wake = () => { if (!raf) { prev = performance.now(); raf = requestAnimationFrame(loop); } };

  function loop(now) {
    const dt = Math.min((now - prev) / 1000, 1 / 30);
    prev = now;
    if (!dragging) {
      if (target !== null) {
        v += (-EDGE_K * (x - target) - EDGE_C * v) * dt;
        x += v * dt;
        if (Math.abs(x - target) < 0.3 && Math.abs(v) < 4) { x = target; v = 0; target = null; }
      } else if (x > 0 || x < min) {
        const edge = x > 0 ? 0 : min;
        v += (-EDGE_K * (x - edge) - EDGE_C * v) * dt;
        x += v * dt;
        if (Math.abs(x - edge) < 0.3 && Math.abs(v) < 4) { x = edge; v = 0; }
      } else if (Math.abs(v) > 4) {
        x += v * dt;
        v *= Math.pow(FRICTION, dt * 60);
      } else {
        v = 0;
        const idle = now - lastInput > 3000 && !hover && !focused && visible && !reducedMotion.matches;
        if (idle && min < 0) {
          x += driftDir * DRIFT * dt;
          if (x <= min) { x = min; driftDir = 1; }
          if (x >= 0) { x = 0; driftDir = -1; }
        }
      }
    }
    const goal = clamp(-v / 300, -7, 7);
    lean += (goal - lean) * Math.min(1, dt * 10);
    render();
    const resting = !dragging && target === null && v === 0 && Math.abs(lean) < 0.05 && x <= 0 && x >= min;
    const drifting = visible && !reducedMotion.matches && !hover && !focused;
    raf = resting && !drifting ? 0 : requestAnimationFrame(loop);
    if (!raf) { lean = 0; render(); }
  }

  // `pos` is the unconstrained finger position; the shelf shows rubber(pos) so overscroll resists.
  let pos = 0, captured = false;
  const unrubber = (val) => (val > 0 ? val / RUBBER : val < min ? min + (val - min) / RUBBER : val);
  viewport.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    measure();
    dragging = true; moved = 0; target = null; v = 0; captured = false;
    pos = unrubber(x);
    lastX = e.clientX; lastT = performance.now(); samples = [];
    lastInput = performance.now();
    wake();
  });
  viewport.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const now = performance.now();
    const dx = e.clientX - lastX;
    moved += Math.abs(dx);
    // Capture only once it is clearly a drag, so a plain tap still clicks the cover.
    if (!captured && moved > 6) {
      captured = true;
      viewport.setPointerCapture(e.pointerId);
      viewport.classList.add("is-dragging");
    }
    pos += dx;
    x = rubber(pos);
    samples.push({ dx, t: now });
    samples = samples.filter((s) => now - s.t < 100);
    const span = samples.length > 1 ? now - samples[0].t : 16;
    v = (samples.reduce((a, s) => a + s.dx, 0) / Math.max(span, 16)) * 1000;
    lastX = e.clientX; lastT = now; lastInput = now;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove("is-dragging");
    if (performance.now() - lastT > 80) v = 0;
    lastInput = performance.now();
    wake();
  };
  viewport.addEventListener("pointerup", end);
  viewport.addEventListener("pointercancel", end);
  viewport.addEventListener("click", (e) => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
  viewport.addEventListener("scroll", () => { viewport.scrollLeft = 0; });
  viewport.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") hover = true; });
  viewport.addEventListener("pointerleave", () => { hover = false; wake(); });

  const nudge = (dir) => {
    measure();
    const step = (track.firstElementChild ? track.firstElementChild.getBoundingClientRect().width : 200) + 24;
    target = clamp((target ?? x) - dir * step, min, 0);
    lastInput = performance.now();
    if (reducedMotion.matches) { x = target; target = null; render(); return; }
    wake();
  };
  viewport.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); nudge(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); nudge(-1); }
    else if (e.key === "Home") { e.preventDefault(); measure(); target = 0; wake(); }
    else if (e.key === "End") { e.preventDefault(); measure(); target = min; wake(); }
  });
  viewport.addEventListener("focusin", (e) => {
    focused = true;
    const cover = e.target.closest(".cover");
    if (!cover) return;
    measure();
    const vr = viewport.getBoundingClientRect(), cr = cover.getBoundingClientRect();
    if (cr.left < vr.left + 16) target = clamp(x + (vr.left + 24 - cr.left), min, 0);
    else if (cr.right > vr.right - 16) target = clamp(x - (cr.right - vr.right + 24), min, 0);
    wake();
  });
  viewport.addEventListener("focusout", () => { focused = false; wake(); });
  $$("[data-shelf]").forEach((b) => b.addEventListener("click", () => nudge(+b.dataset.shelf)));

  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) wake(); }).observe(viewport);
  window.addEventListener("resize", () => { measure(); wake(); });
  measure();
  render();
}

/* ---------------- Tickers and starter chips ---------------- */
function questionChip(q, cls = "chip") {
  return el("button", { type: "button", class: cls, "data-ask": q, text: q });
}
function initTickers() {
  $$("[data-questions]").forEach((track) => {
    const list = TICKER[track.dataset.questions];
    [0, 1].forEach((copy) => list.forEach((q) => {
      const chip = questionChip(q);
      if (copy) { chip.setAttribute("tabindex", "-1"); chip.setAttribute("aria-hidden", "true"); }
      track.append(chip, el("span", { class: "sep", "aria-hidden": "true", text: "/" }));
    }));
  });
  const pause = $("#ticker-pause");
  pause.addEventListener("click", () => {
    const on = pause.getAttribute("aria-pressed") !== "true";
    pause.setAttribute("aria-pressed", String(on));
    pause.textContent = on ? "Play" : "Pause";
    $$(".ticker").forEach((t) => t.classList.toggle("is-paused", on));
  });
  const starters = ["What's the minimum attendance for end-sem exams?", "How many backlogs are allowed for placements?", "How do I apply for re-evaluation?", "Is there a laptop subsidy for first years?", "What are the Sem 5 CSE electives?"];
  starters.forEach((q) => $("#starters").append(questionChip(q)));
  starters.slice(0, 3).forEach((q) => $("#empty-starters").append(questionChip(q)));
  ["Can I change my hostel room mid-semester?", "Is CGPA 5.98 rounded to 6 for placements?", "Is revaluation allowed for lab exams?"].forEach((q) => {
    $("#side-history").append(el("li", {}, el("button", { type: "button", "data-ask": q, text: q })));
  });
  Object.entries(DOCS).forEach(([key, d]) => {
    const glyph = el("span", { class: "glyph", "aria-hidden": "true", html: patternSVG(d.pattern) });
    $("#side-docs").append(el("li", {}, el("button", { type: "button", "data-open-doc": key }, [glyph, el("span", { text: d.short }), el("span", { class: "count", text: d.pages + "p" })])));
  });
}

/* ---------------- Ask demo: streaming answers ---------------- */
const thread = $("#thread");
const inner = $("#thread-inner");
let busy = false;
let remaining = 18;

function makeCite(ref) {
  const { doc, page } = parseRef(ref);
  const b = el("button", { type: "button", class: "cite", "data-cite": ref, "aria-expanded": "false", "aria-label": "Open " + DOCS[doc].title + " at page " + page }, [icon("i-page"), citeLabel(ref)]);
  return b;
}
function nearBottom() { return thread.scrollHeight - thread.scrollTop - thread.clientHeight < 120; }
function stickToBottom(force) { if (force || nearBottom()) thread.scrollTop = thread.scrollHeight; }

function tokenize(blocks) {
  const ops = [];
  const pushParts = (parts) => parts.forEach((part) => {
    if (typeof part === "string") part.split(/(\s+)/).filter(Boolean).forEach((s) => ops.push({ t: "text", s }));
    else if (part.b) part.b.split(/(\s+)/).filter(Boolean).forEach((s) => ops.push({ t: "text", s, bold: true }));
    else if (part.c) ops.push({ t: "cite", ref: part.c });
  });
  blocks.forEach((blk) => {
    if (blk.p) { ops.push({ t: "open", tag: "p" }); pushParts(blk.p); }
    if (blk.ul) { ops.push({ t: "open", tag: "ul" }); blk.ul.forEach((item) => { ops.push({ t: "li" }); pushParts(item); }); }
  });
  return ops;
}

function stream(container, blocks) {
  return new Promise((resolve) => {
    const ops = tokenize(blocks);
    const caret = el("span", { class: "caret", "aria-hidden": "true" });
    let target = null, list = null, i = 0;
    const perTick = reducedMotion.matches ? 12 : 1;
    const apply = (op) => {
      if (op.t === "open") {
        const node = el(op.tag);
        container.append(node);
        list = op.tag === "ul" ? node : null;
        target = op.tag === "ul" ? null : node;
      } else if (op.t === "li") {
        target = el("li"); list.append(target);
      } else if (op.t === "cite") {
        const c = makeCite(op.ref); c.classList.add("pop"); target.append(c);
      } else if (op.bold) {
        const last = target.lastChild;
        if (last && last.nodeName === "STRONG") last.append(op.s); else target.append(el("strong", { text: op.s }));
      } else target.append(op.s);
    };
    const tick = () => {
      for (let n = 0; n < perTick && i < ops.length; n++) apply(ops[i++]);
      if (target) target.append(caret);
      stickToBottom();
      if (i < ops.length) setTimeout(tick, 16 + Math.random() * 22);
      else { caret.remove(); resolve(); }
    };
    tick();
  });
}

function feedbackRow() {
  const row = el("div", { class: "feedback" });
  const up = el("button", { type: "button", class: "icon-btn", "aria-pressed": "false", "aria-label": "Helpful" }, icon("i-up"));
  const down = el("button", { type: "button", class: "icon-btn", "aria-pressed": "false", "aria-label": "Not helpful" }, icon("i-down"));
  const reasons = el("div", { class: "reasons", hidden: "", role: "group", "aria-label": "What was wrong?" });
  ["Wrong answer", "Outdated rule", "Wrong page cited", "Didn't answer my question"].forEach((r) => {
    const chip = el("button", { type: "button", class: "chip", "aria-pressed": "false", text: r });
    chip.addEventListener("click", () => {
      reasons.replaceWith(el("span", { class: "thanks" }, [icon("i-check"), "Sent: “" + r + "”. Your admin will see it."]));
    });
    reasons.append(chip);
  });
  up.addEventListener("click", () => {
    up.setAttribute("aria-pressed", "true"); down.setAttribute("aria-pressed", "false"); reasons.hidden = true;
    toast("Thanks. Marked as helpful.");
  });
  down.addEventListener("click", () => {
    down.setAttribute("aria-pressed", "true"); up.setAttribute("aria-pressed", "false");
    if (reasons.isConnected) { reasons.hidden = false; reasons.firstChild.focus(); }
  });
  row.append(el("span", { class: "label", text: "Was this right?" }), up, down, reasons);
  return row;
}

function followupRow(list) {
  const row = el("div", { class: "followups", role: "group", "aria-label": "Ask next" });
  list.forEach((q) => row.append(questionChip(q)));
  return row;
}

function conflictBox(conflict) {
  const p = el("p");
  conflict.text.forEach((part) => p.append(typeof part === "string" ? part : makeCite(part.c)));
  const sticker = el("span", { class: "sticker sticker--warn" }, [icon("i-clock"), "Newer rule wins"]);
  const box = el("div", { class: "conflict", role: "note" }, [
    el("div", { class: "conflict-head" }, [icon("i-warn"), el("span", { text: "Two documents disagree" }), sticker]),
    p,
  ]);
  popSticker(sticker, 120);
  return box;
}

function sourcesLine(blocks, conflict) {
  const refs = new Set();
  const scan = (parts) => parts.forEach((x) => x && x.c && refs.add(x.c.split(":").slice(0, 2).join(":")));
  blocks.forEach((b) => { if (b.p) scan(b.p); if (b.ul) b.ul.forEach(scan); });
  if (conflict) scan(conflict.text);
  const line = el("div", { class: "sources" }, el("span", { text: "Read from" }));
  refs.forEach((r) => line.append(makeCite(r)));
  return line;
}

function notFoundCard(a) {
  const card = el("div", { class: "notfound", role: "note" });
  card.innerHTML = '<div class="notfound-head"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 52h52" stroke-width="4"/><path d="M12 52V24h10v28M26 52V30h8v22" fill="var(--paper)"/><circle cx="44" cy="26" r="9" fill="var(--paper)"/><path d="M50.5 32.5L58 40"/><path d="M41 23l6 6M47 23l-6 6" stroke="var(--accent)"/></svg>' +
    '<div><h3>Not in Northfield’s documents</h3><p>None of the 6 documents on the shelf answer this, so Rulebook won’t guess. Here are the closest passages it found, in case they help. Your admin can see that this was asked.</p></div></div>';
  const list = el("ul", { class: "closest", "aria-label": "Closest passages" });
  a.closest.forEach((c) => {
    const li = el("li", {}, [el("span", { text: "“" + c.text + "”" }), el("span", { class: "score", text: c.score }), el("br"), makeCite(c.ref)]);
    list.append(li);
  });
  card.append(list, el("div", {}, el("button", { type: "button", class: "btn btn-sm", "data-spring": "", "data-toast": "Demo: your space admin gets this question in their gaps list." }, "Ask admin to add a document")));
  return card;
}

async function ask(question, { scroll = false } = {}) {
  question = (question || "").trim();
  if (busy) return;
  if (question.length < 4) { toast("Type a full question, like “What's the re-evaluation fee?”"); return; }
  if (remaining <= 0) { toast("You've used 20 questions this hour. Next question at 4:12 pm. (Demo rate limit)"); return; }
  if (scroll) $("#ask-demo").scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });

  busy = true;
  remaining -= 1;
  $("#rate").textContent = remaining + " of 20 questions left this hour";
  const send = $("#app-send");
  send.disabled = true;
  thread.setAttribute("aria-busy", "true");

  const key = routeQuestion(question);
  const a = ANSWERS[key];
  inner.append(el("div", { class: "msg-q", text: question }));
  const msg = el("article", { class: "msg-a", "aria-label": "Answer" });
  const who = el("div", { class: "who" });
  who.innerHTML = '<svg class="dot" aria-hidden="true"><use href="#logo"/></svg><span>Rulebook</span>';
  const thinking = el("span", { class: "thinking", html: "<i></i><i></i><i></i>&nbsp;Searching 6 documents" });
  who.append(thinking);
  msg.append(who);
  inner.append(msg);
  stickToBottom(true);

  await new Promise((r) => setTimeout(r, reducedMotion.matches ? 150 : 520));
  thinking.replaceWith(el("span", { text: "· 6 documents searched · 0.9 s" }));

  if (a.notfound) {
    msg.append(notFoundCard(a));
  } else {
    const body = el("div", { class: "answer" });
    msg.append(body);
    await stream(body, a.blocks);
    if (a.conflict) msg.append(conflictBox(a.conflict));
    msg.append(sourcesLine(a.blocks, a.conflict));
    msg.append(feedbackRow());
  }
  msg.append(followupRow(a.followups));
  stickToBottom(true);

  busy = false;
  send.disabled = false;
  thread.setAttribute("aria-busy", "false");
}

function initAsk() {
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ask]");
    if (!b) return;
    const inApp = !!b.closest(".app");
    ask(b.dataset.ask, { scroll: !inApp });
  });
  $("#app-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#app-input");
    const q = input.value;
    if (!busy && q.trim().length >= 4) input.value = "";
    ask(q);
  });
  $("#hero-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#hero-input");
    ask(input.value || input.placeholder, { scroll: true });
    input.value = "";
  });
  let seeded = false;
  new IntersectionObserver(([en], obs) => {
    if (en.isIntersecting && !seeded && !inner.children.length) { seeded = true; obs.disconnect(); ask(ANSWERS.attendance.q); }
  }, { threshold: 0.35 }).observe($(".app"));
}

/* ---------------- PDF panel: side sheet (desktop) / bottom sheet (mobile) ---------------- */
const panel = $("#pdf-panel");
const scrim = $("#scrim");
const pdfBody = $("#pdf-body");
const isSheet = () => window.matchMedia("(max-width: 899px)").matches;
let pdfState = { doc: "handbook", page: 1, mark: null };
let returnFocus = null;
let panelOpen = false;
const panelSpring = new Spring({
  value: 1, k: 380, c: 34,
  onUpdate: (p) => {
    panel.style.transform = isSheet()
      ? "translateY(" + (p * 100).toFixed(3) + "%)"
      : "translateX(calc(" + (p * 100).toFixed(3) + "% + " + (p * 40).toFixed(1) + "px))";
  },
  onRest: (p) => { if (p >= 1) { panel.classList.remove("open"); panel.style.transform = ""; } },
});

function pageNode(doc, page, mark) {
  const d = DOCS[doc];
  const data = PAGES[doc + ":" + page];
  const pg = el("article", { class: "pdf-page", "aria-label": d.title + ", page " + page });
  pg.append(el("div", { class: "pg-head" }, [el("span", { text: "Northfield Institute of Technology" }), el("span", { text: d.short })]));
  if (data) {
    pg.append(el("p", { style: "font: 600 .6875rem/1.4 var(--font-ui); letter-spacing:.06em; text-transform:uppercase; color:#4B463D; text-align:left", text: data.section }));
    data.blocks.forEach((b) => {
      if (b.h) pg.append(el("h5", { text: b.h }));
      else if (b.note) pg.append(el("div", { class: "pdf-note", "aria-label": "Annotation: " + b.note, text: "← " + b.note }));
      else {
        const p = el("p");
        if (b.m && b.m === mark) p.append(el("mark", { id: "pdf-hit", text: b.p })); else p.textContent = b.p;
        pg.append(p);
      }
    });
  } else if (page === 1) {
    pg.append(el("div", { style: "padding: 72px 0 40px; text-align:center" }, [
      el("p", { style: "font: 800 1.9rem/1 var(--font-display); letter-spacing:-.03em; text-align:center", text: d.title }),
      el("p", { style: "margin-top:14px; text-align:center", text: d.type + " · " + d.date }),
      el("p", { style: "margin-top:4px; text-align:center", text: d.pages + " pages" }),
    ]));
  } else {
    pg.append(el("p", { style: "padding: 80px 0; text-align:center; color:#4B463D", text: "This concept only includes the pages that answers cite. In the app, page " + page + " of the real PDF renders here." }));
  }
  pg.append(el("div", { class: "pg-foot" }, [el("span", { text: "Page " + page + " of " + d.pages }), el("br"), el("span", { class: "pg-demo", text: "DEMO DOCUMENT" })]));
  return pg;
}

function renderPdf() {
  const { doc, page, mark } = pdfState;
  const d = DOCS[doc];
  $("#pdf-title").textContent = d.title;
  $("#pdf-sub").textContent = "DEMO · " + d.date;
  $("#pdf-pageno").textContent = "p. " + page + " / " + d.pages;
  $("#pdf-prev").disabled = page <= 1;
  $("#pdf-next").disabled = page >= d.pages;
  pdfBody.replaceChildren(pageNode(doc, page, mark));
  $("#pdf-foot-note").textContent = mark ? "Highlighted: the passage the answer cites." : "Browsing " + d.short + ".";
  const hit = $("#pdf-hit");
  pdfBody.scrollTop = 0;
  if (hit) {
    requestAnimationFrame(() => {
      pdfBody.scrollTop = Math.max(0, hit.offsetTop - pdfBody.clientHeight / 3);
      requestAnimationFrame(() => hit.classList.add("lit"));
    });
  }
}

function openPdf(doc, page, mark, opener) {
  pdfState = { doc, page, mark };
  renderPdf();
  $$(".cite[aria-expanded='true']").forEach((c) => c.setAttribute("aria-expanded", "false"));
  if (opener && opener.classList.contains("cite")) opener.setAttribute("aria-expanded", "true");
  if (!panelOpen) returnFocus = opener || document.activeElement;
  panelOpen = true;
  panel.classList.add("open");
  panel.setAttribute("aria-hidden", "false");
  scrim.classList.add("open");
  panelSpring.to(0);
  $("#pdf-close").focus({ preventScroll: true });
}
function closePdf() {
  if (!panelOpen) return;
  panelOpen = false;
  panel.setAttribute("aria-hidden", "true");
  scrim.classList.remove("open");
  panelSpring.to(1);
  $$(".cite[aria-expanded='true']").forEach((c) => c.setAttribute("aria-expanded", "false"));
  if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
}

function initPdf() {
  document.addEventListener("click", (e) => {
    const c = e.target.closest("[data-cite]");
    if (c) { const r = parseRef(c.dataset.cite); openPdf(r.doc, r.page, r.mark || "a", c); return; }
    const d = e.target.closest("[data-open-doc]");
    if (d) {
      const key = d.dataset.openDoc;
      openPdf(key, 1, null, d);
    }
  });
  $("#pdf-close").addEventListener("click", closePdf);
  scrim.addEventListener("click", closePdf);
  $("#pdf-prev").addEventListener("click", () => { pdfState.page--; pdfState.mark = null; renderPdf(); });
  $("#pdf-next").addEventListener("click", () => { pdfState.page++; pdfState.mark = null; renderPdf(); });
  document.addEventListener("keydown", (e) => {
    if (!panelOpen) return;
    if (e.key === "Escape") { e.preventDefault(); closePdf(); return; }
    if (e.key !== "Tab") return;
    const focusables = $$("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])", panel).filter((n) => n.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  });

  /* Bottom sheet: drag down to dismiss, flick to throw, springs back otherwise */
  let startY = 0, lastY = 0, lastT = 0, vy = 0, dragging = false, h = 1;
  const handles = [$("#sheet-handle"), $("#pdf-head")];
  handles.forEach((hd) => {
    hd.addEventListener("pointerdown", (e) => {
      if (!isSheet() || e.target.closest("button")) return;
      cancelAnimationFrame(panelSpring.raf); panelSpring.raf = 0;
      dragging = true; startY = lastY = e.clientY; lastT = performance.now(); vy = 0;
      h = panel.getBoundingClientRect().height;
      hd.setPointerCapture(e.pointerId);
    });
    hd.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const now = performance.now();
      vy = (e.clientY - lastY) / Math.max(1, now - lastT);
      lastY = e.clientY; lastT = now;
      const dy = e.clientY - startY;
      const p = dy >= 0 ? dy / h : (dy * 0.2) / h;
      panelSpring.value = p;
      panelSpring.onUpdate(p);
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      if (panelSpring.value > 0.3 || vy > 0.6) {
        panelSpring.velocity = (vy * 1000) / h;
        closePdf();
      } else panelSpring.to(0, (vy * 1000) / h);
    };
    hd.addEventListener("pointerup", end);
    hd.addEventListener("pointercancel", end);
  });
}

/* ---------------- Ingestion simulation ---------------- */
function initIngest() {
  const bar = $("#ingest-bar");
  const fill = $("i", bar);
  const status = $("#ingest-status");
  const ocr = $("#ocr-preview");
  const ready = $("#ingest-ready");
  const replay = $("#ingest-replay");
  const items = $$("#stages li");
  const STAGES = [
    { id: "upload", ms: 1400, weight: 15, val: (t) => Math.round(t * 14.2 * 10) / 10 + " / 14.2 MB", say: "Uploading the file." },
    { id: "read", ms: 3000, weight: 35, val: (t) => Math.max(1, Math.round(t * 86)) + " / 86 pages", say: "Reading pages and pulling out text." },
    { id: "ocr", ms: 2200, weight: 20, val: (t) => Math.max(1, Math.round(t * 8)) + " / 8 scanned", say: "Pages 31–38 are scanned images. Running OCR on them." },
    { id: "chunk", ms: 1200, weight: 15, val: (t) => Math.round(t * 612) + " clauses", say: "Splitting into clauses, keeping each one's page number." },
    { id: "embed", ms: 1600, weight: 15, val: (t) => Math.round(t * 612) + " / 612", say: "Indexing clauses for search." },
  ];
  let run = 0;
  function start() {
    const id = ++run;
    replay.disabled = true;
    ready.hidden = true;
    items.forEach((li) => { li.className = ""; $(".val", li).textContent = ""; });
    let stage = 0, stageStart = performance.now(), done = 0;
    const speed = reducedMotion.matches ? 0.4 : 1;
    const frame = (now) => {
      if (id !== run) return;
      const s = STAGES[stage];
      const li = items[stage];
      const t = clamp((now - stageStart) / (s.ms * speed), 0, 1);
      if (!li.classList.contains("active")) { li.classList.add("active"); status.textContent = s.say; ocr.hidden = s.id !== "ocr"; }
      $(".val", li).textContent = s.val(t);
      const pct = done + s.weight * t;
      fill.style.setProperty("--p", (pct / 100).toFixed(3));
      bar.setAttribute("aria-valuenow", String(Math.round(pct)));
      if (t >= 1) {
        li.classList.remove("active"); li.classList.add("done");
        done += s.weight; stage++; stageStart = now;
        if (stage >= STAGES.length) {
          ocr.hidden = true;
          status.textContent = "Done. Students can ask about this document now.";
          ready.hidden = false;
          popSticker($("[data-sticker]", ready));
          replay.disabled = false;
          return;
        }
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  replay.addEventListener("click", start);
  new IntersectionObserver(([en], obs) => { if (en.isIntersecting) { obs.disconnect(); start(); } }, { threshold: 0.4 }).observe(bar);
}

/* ---------------- Admin gaps ---------------- */
const GAPS = [
  { q: "Is attendance relaxed for students on NSS camp?", n: 14, last: "2 h ago", status: "unanswered", hint: "No document on the shelf mentions NSS. Probably the NSS / NCC attendance circular.", action: "Upload circular" },
  { q: "What's the fee for a duplicate ID card?", n: 9, last: "today", status: "unanswered", hint: "Looks like the fee schedule for 2025-26 hasn't been uploaded.", action: "Upload fee schedule" },
  { q: "Can I do an internship during semester 6?", n: 7, last: "yesterday", status: "down", reason: "Outdated rule", hint: "4 students said “outdated”. Regulations R22 p.58 may have been replaced by a newer circular.", action: "Review answer" },
  { q: "When is the last date for bus pass renewal?", n: 6, last: "3 days ago", status: "unanswered", hint: "Transport office notices aren't on the shelf.", action: "Upload notice" },
  { q: "How many backlogs are allowed for placements?", n: 41, last: "1 h ago", status: "down", reason: "Didn't answer my question", hint: "2 of 41 downvoted. They asked about branch-specific drives, which the policy doesn't cover.", action: "Review answer" },
  { q: "What's the minimum attendance for end-sem exams?", n: 63, last: "20 min ago", status: "ok", hint: "Answered with Circular 03/2025 overriding Handbook p.22. No downvotes.", action: "View answer" },
];
function initAdmin() {
  const list = $("#qrows");
  const labels = { unanswered: "Not in documents", down: "Downvoted", ok: "Answered" };
  const render = (filter) => {
    list.replaceChildren();
    GAPS.filter((g) => filter === "all" || g.status === filter).forEach((g) => {
      const statusText = labels[g.status] + (g.reason ? ": " + g.reason : "");
      list.append(el("li", { class: "qrow" }, [
        el("div", { class: "q" }, [g.q, el("small", { text: "Asked " + g.n + " times · last " + g.last })]),
        el("span", { class: "status status--" + g.status, text: statusText }),
        el("div", { class: "hint" }, [el("span", { class: "hand", text: g.status === "unanswered" ? "missing doc?" : g.status === "down" ? "check this" : "all good" }), el("span", { text: g.hint })]),
        el("div", {}, el("button", { type: "button", class: "btn btn-sm" + (g.status === "unanswered" ? " btn-primary" : ""), "data-spring": "", "data-toast": "Demo: " + g.action.toLowerCase() + " for “" + g.q + "”." }, g.action)),
      ]));
    });
  };
  $$("[data-filter]").forEach((b) => b.addEventListener("click", () => {
    $$("[data-filter]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    render(b.dataset.filter);
  }));
  render("all");
}

/* ---------------- Design system: swatches, live contrast, spacing ---------------- */
const PALETTE = {
  light: { paper: "#F5F1E8", surface: "#FBF9F4", sunken: "#ECE6D8", ink: "#1B1915", "ink-2": "#4B463D", "ink-3": "#6A6458", line: "#D9D1C0", accent: "#B83A0A", "on-accent": "#FFFFFF", "accent-wash": "#F9D9C6", "warn-bg": "#F6E6B4", "warn-ink": "#7A5200", "error-bg": "#F8DCD8", "error-ink": "#A3201A", "success-bg": "#DCEBD9", "success-ink": "#2D6A3E" },
  dark: { paper: "#14120F", surface: "#1D1A16", sunken: "#0F0D0B", ink: "#F2EDE3", "ink-2": "#C9C1B3", "ink-3": "#9C9486", line: "#34302A", accent: "#FF7B47", "on-accent": "#1B1915", "accent-wash": "#4A2414", "warn-bg": "#3A2F12", "warn-ink": "#F0C75E", "error-bg": "#3B1714", "error-ink": "#FF8A80", "success-bg": "#15301D", "success-ink": "#8FD19E" },
};
const ROLES = { paper: "Base", surface: "Cards", sunken: "Wells", ink: "Text", "ink-2": "Secondary", "ink-3": "Muted", line: "Hairlines", accent: "Accent", "on-accent": "On accent", "accent-wash": "Highlight", "warn-bg": "Conflict bg", "warn-ink": "Conflict", "error-bg": "Error bg", "error-ink": "Error", "success-bg": "Success bg", "success-ink": "Success" };

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function initSystem() {
  const box = $("#swatches");
  ["light", "dark"].forEach((mode) => {
    box.append(el("div", { class: "palette-label" }, [el("span", { text: mode === "light" ? "Light · default" : "Dark" })]));
    const grid = el("div", { class: "swatches" });
    Object.entries(PALETTE[mode]).forEach(([name, hex]) => {
      const sw = el("div", { class: "swatch" }, [el("div", { class: "chipc", style: "background:" + hex }), el("div", {}, [el("b", { text: ROLES[name] }), el("code", { text: "--" + name }), el("code", { text: hex })])]);
      grid.append(sw);
    });
    box.append(grid);
  });

  const pairs = [
    ["ink", "paper", "Body text", 4.5], ["ink-2", "paper", "Secondary text", 4.5], ["ink-3", "paper", "Muted text", 4.5],
    ["ink-3", "sunken", "Muted on wells", 4.5], ["accent", "paper", "Accent text", 4.5], ["accent", "surface", "Citation chip", 4.5],
    ["on-accent", "accent", "Primary button", 4.5], ["ink", "accent-wash", "Highlighted passage", 4.5],
    ["warn-ink", "warn-bg", "Conflict callout", 4.5], ["error-ink", "error-bg", "Error", 4.5], ["success-ink", "success-bg", "Success", 4.5],
  ];
  const tbody = $("#contrast tbody");
  pairs.forEach(([fg, bg, label, need]) => {
    const l = contrast(PALETTE.light[fg], PALETTE.light[bg]);
    const d = contrast(PALETTE.dark[fg], PALETTE.dark[bg]);
    const ok = l >= need && d >= need;
    tbody.append(el("tr", {}, [
      el("td", {}, [el("b", { text: label }), el("br"), el("code", { style: "font-size: var(--t-micro); color: var(--ink-3)", text: fg + " / " + bg })]),
      el("td", {}, el("span", { class: "sample", style: "color: var(--" + fg + "); background: var(--" + bg + ")", text: "Aa 75%" })),
      el("td", { text: l.toFixed(2) + ":1" }),
      el("td", { text: d.toFixed(2) + ":1" }),
      el("td", {}, el("span", { class: ok ? "pass" : "", text: (ok ? "AA pass" : "Check") + " (" + need + ")" })),
    ]));
  });

  const sp = $("#spacing");
  [["--s-1", 4], ["--s-2", 8], ["--s-3", 12], ["--s-4", 16], ["--s-5", 24], ["--s-6", 32], ["--s-7", 48], ["--s-8", 64], ["--s-9", 96], ["--s-10", 144]].forEach(([n, v]) => {
    sp.append(el("div", { class: "space-row" }, [el("code", { text: n + " · " + v }), el("i", { style: "width:" + v + "px" })]));
  });
}

/* ---------------- Boot ---------------- */
initReveals();
initShelf();
initTickers();
initAsk();
initPdf();
initIngest();
initAdmin();
initSystem();
syncThemeButtons();
watchStickers();
