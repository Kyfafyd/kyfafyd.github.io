/* Timo project page
   ------------------------------------------------------------------
   No framework and no build step: the page is a handful of lists
   rendered into the DOM, plus an IntersectionObserver that keeps only
   the visible videos decoding. There are ~40 clips here, and letting
   them all play at once is what makes a page like this stutter. */

(() => {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const V  = "assets/videos/";

  /* Bump when a clip is re-encoded. A plain static server sends no cache
     headers for mp4, so a browser that already holds the old file will keep
     playing it; changing the URL is the only reliable way to retire it. */
  const REV = "2";

  /* ── data ──────────────────────────────────────────────────────── */

  // Row order follows the paper's table, ours last.
  const MODELS = ["MotionMillion", "HY-Motion", "GENMO", "Kimodo", "Timo (ours)"];

  const PROMPTS = [
    { short: "Pick up",  text: "A person bends down to pick up an object from the ground" },
    { short: "Gesture",  text: "A person gestures to their left with an open palm" },
    { short: "Step",     text: "A person takes one step forward" },
    { short: "Wave",     text: "A person waves hello with their right hand" },
  ];

  // The two machines were filmed on different cameras, so the Luna clips are
  // portrait and the Oli clips landscape. Each card carries its own ratio and
  // the grid keeps a robot per row, rather than cropping one to match the
  // other.
  // All four were re-cropped to one 9:16 window with the robot at the same
  // fraction of frame height, so no per-clip ratio is needed here any more.
  const ROBOTS = [
    { file: "guiding-luna",   who: "LimX Luna", what: "A guiding gesture, \u201cthis way\u201d, to its own left" },
    { file: "hips-luna",      who: "LimX Luna", what: "Both hands to the hips" },
    { file: "walksquat-oli",  who: "LimX Oli",  what: "Walks forward, squats down, and stands back up" },
    { file: "run-oli",        who: "LimX Oli",  what: "Runs forward" },
  ];

  const GALLERY = [
    "A person runs forward",
    "A person lifts their left knee, balancing on the right leg",
    "A person takes one step to the right",
    "A person sits down",
    "A person does a shallow squat, then stands back up",
    "A person looks up, tilting their head back",
    "A person turns their head to their left, torso square",
    "A person raises both hands overhead",
    "A person claps their hands in applause",
    "A person opens their arms in a welcoming gesture",
    "A person puts both hands on their hips",
    "A person bows",
    "A person turns forty-five degrees left, pivoting in place",
    "A person points straight ahead, one arm extended",
  ];

  /* ── playback budget ───────────────────────────────────────────────
     Every <video> gets data-lazy. It is given a src only once it comes
     near the viewport, and it is paused again once it leaves, so a long
     scroll never has forty clips decoding behind it. */

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting) {
        if (!v.src && v.dataset.src) v.src = v.dataset.src;
        if (!v.dataset.hold) v.play().catch(() => {});
      } else {
        v.pause();
      }
    }
  }, { rootMargin: "220px 0px", threshold: 0.01 });

  const watch = (v) => io.observe(v);

  /* Every clip has a poster cut from 35% through it, so a card shows a real
     pose from the moment it is laid out. Without one a lazy <video> is a
     white rectangle until the first frame decodes, which reads as broken. */
  const posterFor = (src) =>
    encodeURI(src.replace("assets/videos/", "assets/posters/").replace(/\.mp4$/, ".jpg"));

  const mkVideo = (src, cls) => {
    const v = document.createElement("video");
    v.muted = true; v.loop = true; v.playsInline = true;
    v.preload = "none";
    v.setAttribute("muted", "");           // iOS wants the attribute too
    v.poster = posterFor(src);
    v.dataset.src = `${encodeURI(src)}?v=${REV}`;
    if (cls) v.className = cls;
    return v;
  };

  /* ── six-axis radar ────────────────────────────────────────────────
     Drawn as SVG rather than shipped as a PNG so a reader can pull one
     method out of five overlapping traces. Axis order matches the table's
     row order, ours last. */

  const AXES = [
    { key: "match", label: "Text-Motion Match" },
    { key: "nat",   label: "Naturalness" },
    { key: "phys",  label: "Plausibility" },
    { key: "speed", label: "Speed" },
    { key: "smth",  label: "Smoothness" },
    { key: "div",   label: "Diversity" },
  ];

  const SERIES = [
    { name: "MotionMillion", color: "#4a90d9", dash: "7 5",
      v: { nat: 42.3, match: 30.5, div: 51.7, smth: 49.5, speed: 45.5, phys: 72.1 } },
    { name: "HY-Motion",     color: "#e0952f", dash: "3 4",
      v: { nat: 38.0, match: 52.6, div: 67.3, smth: 54.3, speed: 31.4, phys: 71.4 } },
    { name: "GENMO",         color: "#8d93a1", dash: "5 5",
      v: { nat: 44.2, match: 28.0, div: 52.3, smth: 79.8, speed: 20.6, phys: 68.1 } },
    { name: "Kimodo",        color: "#2f9e6e", dash: "9 4 2 4",
      v: { nat: 36.8, match: 51.0, div: 59.1, smth: 79.0, speed: 49.5, phys: 93.4 } },
    { name: "Timo (ours)",   color: "#7c3aed", dash: "",
      v: { nat: 86.4, match: 86.8, div: 89.3, smth: 90.7, speed: 81.4, phys: 85.0 } },
  ];

  (function radar() {
    const svg = $("#radarSvg");
    if (!svg) return;
    const NS = "http://www.w3.org/2000/svg";
    const CX = 240, CY = 196, R = 132, MAX = 100;
    const RINGS = [20, 40, 60, 80, 100];

    const el = (n, a = {}) => {
      const e = document.createElementNS(NS, n);
      for (const k in a) e.setAttribute(k, a[k]);
      return e;
    };
    // -90deg is straight up; axes run clockwise from there, as in the paper.
    const ang = (i) => (-90 + i * 360 / AXES.length) * Math.PI / 180;
    const pt = (i, val) => {
      const r = R * Math.max(0, Math.min(MAX, val)) / MAX;
      return [CX + r * Math.cos(ang(i)), CY + r * Math.sin(ang(i))];
    };
    const ringPts = (val) =>
      AXES.map((_, i) => pt(i, val).map(n => n.toFixed(1)).join(",")).join(" ");

    const grid = el("g", { class: "radar-grid" });
    for (const v of RINGS)
      grid.appendChild(el("polygon", { points: ringPts(v),
        class: "ring" + (v === MAX ? " ring-out" : "") }));
    AXES.forEach((_, i) => {
      const [x, y] = pt(i, MAX);
      grid.appendChild(el("line", { x1: CX, y1: CY, x2: x.toFixed(1), y2: y.toFixed(1), class: "spoke" }));
    });
    // Two ticks are enough to read the scale; five would clutter the middle.
    for (const v of [40, 80]) {
      const [, y] = pt(0, v);
      const t = el("text", { x: CX + 10, y: (y + 5).toFixed(1), class: "radar-tick" });
      t.textContent = v;
      grid.appendChild(t);
    }
    svg.appendChild(grid);

    AXES.forEach((a, i) => {
      const [x, y] = pt(i, MAX + 14);
      const c = Math.cos(ang(i));
      const t = el("text", {
        x: x.toFixed(1), y: (y + (Math.abs(c) < 0.2 ? (y < CY ? -4 : 17) : 6)).toFixed(1),
        class: "radar-axis",
        "text-anchor": Math.abs(c) < 0.2 ? "middle" : (c > 0 ? "start" : "end"),
      });
      t.textContent = a.label;
      svg.appendChild(t);
    });

    const plot = el("g", { class: "radar-plot" });
    svg.appendChild(plot);

    SERIES.forEach((s, k) => {
      const g = el("g", { class: "trace" + (k === SERIES.length - 1 ? " is-ours" : ""),
                          "data-series": s.name });
      const points = AXES.map((a, i) => pt(i, s.v[a.key]));
      const str = points.map(p => p.map(n => n.toFixed(1)).join(",")).join(" ");
      g.appendChild(el("polygon", { points: str, class: "area", fill: s.color }));
      g.appendChild(el("polygon", { points: str, class: "line",
                                    stroke: s.color, "stroke-dasharray": s.dash }));
      points.forEach(([x, y], i) => {
        const d = el("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: 4.2,
                                 class: "node", fill: s.color });
        const title = el("title");
        title.textContent = `${s.name} · ${AXES[i].label}: ${s.v[AXES[i].key].toFixed(1)}`;
        d.appendChild(title);
        g.appendChild(d);
      });
      plot.appendChild(g);
    });

    /* ── selection ──────────────────────────────────────────────────
       Hover previews, a click locks; a second click on the same method
       releases it. Keeping the two separate means the highlight does not
       vanish the moment the pointer leaves the legend. */

    const legend = $("#radarLegend");
    const rows = $$('#results .tbl tbody tr[data-model]');
    const wrap = $("#radar");
    let locked = null;

    const keyOf = (n) => n.replace(" (ours)", "");

    SERIES.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "lg" + (s.name.startsWith("Timo") ? " is-ours" : "");
      b.dataset.series = s.name;
      b.style.setProperty("--c", s.color);
      b.innerHTML = `<i></i><span></span>`;
      $("span", b).textContent = s.name;
      b.addEventListener("click", () => pick(locked === s.name ? null : s.name));
      b.addEventListener("pointerenter", () => show(s.name));
      b.addEventListener("focus", () => show(s.name));
      b.addEventListener("pointerleave", () => show(locked));
      b.addEventListener("blur", () => show(locked));
      legend.appendChild(b);
    });

    $$(".trace", plot).forEach((g) => {
      const n = g.dataset.series;
      g.addEventListener("click", () => pick(locked === n ? null : n));
      g.addEventListener("pointerenter", () => show(n));
      g.addEventListener("pointerleave", () => show(locked));
    });

    // The table is the same five methods, so it drives the same highlight.
    rows.forEach((tr) => {
      const n = SERIES.find(s => keyOf(s.name) === tr.dataset.model)?.name;
      if (!n) return;
      tr.addEventListener("pointerenter", () => show(n));
      tr.addEventListener("pointerleave", () => show(locked));
      tr.addEventListener("click", (e) => {
        if (e.target.closest("a")) return;    // the paper link still wins
        pick(locked === n ? null : n);
      });
    });

    function pick(n) { locked = n; show(n); }

    function show(n) {
      wrap.classList.toggle("focused", !!n);
      $$(".trace", plot).forEach(g => {
        const on = g.dataset.series === n;
        g.classList.toggle("on", on);
        g.classList.toggle("off", !!n && !on);
        // A highlighted trace has to be drawn over the others.
        if (on) plot.appendChild(g);
      });
      $$(".lg", legend).forEach(b => {
        b.classList.toggle("on", b.dataset.series === n);
        b.setAttribute("aria-pressed", String(locked === b.dataset.series));
      });
      rows.forEach(tr => {
        tr.classList.toggle("hi", !!n && keyOf(n) === tr.dataset.model);
      });
      if (!n) SERIES.forEach(s => {           // restore the paint order
        plot.appendChild($(`.trace[data-series="${s.name}"]`, plot));
      });
    }
  })();

  /* ── comparison ────────────────────────────────────────────────── */

  const tabsEl = $("#cmpTabs");
  const gridEl = $("#cmpGrid");
  let current = 0;

  PROMPTS.forEach((p, i) => {
    const b = document.createElement("button");
    b.className = "tab";
    b.type = "button";
    b.role = "tab";
    b.textContent = p.short;
    b.setAttribute("aria-selected", String(i === 0));
    b.addEventListener("click", () => selectPrompt(i));
    tabsEl.appendChild(b);
  });

  function selectPrompt(i) {
    current = i;
    $$(".tab", tabsEl).forEach((t, k) => t.setAttribute("aria-selected", String(k === i)));
    renderCells();
  }

  function renderCells() {
    const p = PROMPTS[current];
    $("#cmpPrompt").textContent = p.text + ".";
    gridEl.replaceChildren();
    for (const m of MODELS) {
      const ours = m.startsWith("Timo");
      const cell = document.createElement("div");
      cell.className = "cell" + (ours ? " is-ours" : "");
      const v = mkVideo(`${V}comparison/${p.text}/${m}.mp4`);
      v.dataset.cmp = "1";
      // The tab the reader just clicked should not wait on the observer.
      v.preload = "auto";
      v.src = v.dataset.src;
      const name = document.createElement("div");
      name.className = "cell-name";
      name.textContent = ours ? "Timo (ours)" : m;
      cell.append(v, name);
      gridEl.appendChild(cell);
      watch(v);
    }
    syncCmp();
  }

  /* The five clips of a prompt are different lengths, because the
     released samplers stop at their own EOS or cap. Restarting them
     together is the honest sync: forcing a shared clock would either
     freeze the short ones or cut the long ones. */
  const cmpVids = () => $$("video[data-cmp]", gridEl);

  function syncCmp() {
    const vs = cmpVids();
    vs.forEach(v => { v.currentTime = 0; });
    if (!paused) vs.forEach(v => v.play().catch(() => {}));
  }

  let paused = false;
  const bar = $(".cmp-bar");
  const playBtn = $("#cmpPlay");
  const scrub = $("#cmpScrub");

  playBtn.addEventListener("click", () => {
    paused = !paused;
    bar.classList.toggle("paused", paused);
    $("span", playBtn).textContent = paused ? "Play" : "Pause";
    cmpVids().forEach(v => {
      v.dataset.hold = paused ? "1" : "";
      paused ? v.pause() : v.play().catch(() => {});
    });
  });

  $("#cmpRestart").addEventListener("click", syncCmp);

  // Progress of the longest clip in the row.
  setInterval(() => {
    const vs = cmpVids().filter(v => v.duration);
    if (!vs.length) return;
    const f = Math.max(...vs.map(v => v.currentTime / v.duration));
    scrub.style.width = `${f * 100}%`;
  }, 90);

  renderCells();

  /* ── robot ─────────────────────────────────────────────────────── */

  const robotEl = $("#robotGrid");
  for (const r of ROBOTS) {
    const card = document.createElement("div");
    card.className = "rcard";
    const v = mkVideo(`${V}real_robot/${r.file}.mp4`);
    const meta = document.createElement("div");
    meta.className = "rcard-meta";
    meta.innerHTML = `<div class="who"></div><div class="what"></div>`;
    $(".who", meta).textContent = r.who;
    $(".what", meta).textContent = r.what;
    card.append(v, meta);
    robotEl.appendChild(card);
    watch(v);
  }

  /* ── gallery ───────────────────────────────────────────────────── */

  const galEl = $("#galGrid");
  for (const g of GALLERY) {
    const card = document.createElement("div");
    card.className = "gcard";
    const v = mkVideo(`${V}additional/${g}.mp4`);
    const cap = document.createElement("div");
    cap.className = "gcard-cap";
    cap.textContent = g + ".";
    card.append(v, cap);
    // A drag that moved the rail is a scroll, not a click on a card.
    card.addEventListener("click", () => {
      if (rail.moved) return;
      openLb(`${V}additional/${g}.mp4`, g + ".");
    });
    galEl.appendChild(card);
    watch(v);
  }

  /* ── gallery rail: arrows, drag-to-scroll, progress ────────────── */

  const rail = { moved: false };
  const prev = $("#galPrev"), next = $("#galNext"), bar2 = $("#galBar");

  const page = () => Math.max(220, galEl.clientWidth * 0.8);

  // One card at a time, back to the start once the far end is reached.
  const card = () => {
    const first = galEl.firstElementChild;
    if (!first) return 190;
    const gap = parseFloat(getComputedStyle(galEl).columnGap) || 14;
    return first.getBoundingClientRect().width + gap;
  };
  const galAuto = autoAdvance($("#gal"), () => {
    const max = galEl.scrollWidth - galEl.clientWidth;
    if (galEl.scrollLeft >= max - 4) galEl.scrollTo({ left: 0, behavior: "smooth" });
    else galEl.scrollBy({ left: card(), behavior: "smooth" });
  }, 3200);

  prev.addEventListener("click", () => { galEl.scrollBy({ left: -page(), behavior: "smooth" }); galAuto.kick(); });
  next.addEventListener("click", () => { galEl.scrollBy({ left:  page(), behavior: "smooth" }); galAuto.kick(); });

  function railState() {
    const max = galEl.scrollWidth - galEl.clientWidth;
    const f = max > 0 ? galEl.scrollLeft / max : 0;
    const vis = Math.min(1, galEl.clientWidth / Math.max(1, galEl.scrollWidth));
    bar2.style.width = `${vis * 100}%`;
    bar2.style.marginLeft = `${f * (100 - vis * 100)}%`;
    prev.disabled = galEl.scrollLeft < 4;
    next.disabled = galEl.scrollLeft > max - 4;
  }
  galEl.addEventListener("scroll", railState, { passive: true });
  window.addEventListener("resize", railState);
  railState();

  let down = false, sx = 0, sl = 0;
  galEl.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") return;        // let native touch scrolling win
    down = true; rail.moved = false;
    sx = e.clientX; sl = galEl.scrollLeft;
    galEl.classList.add("dragging");
  });
  galEl.addEventListener("pointermove", (e) => {
    if (!down) return;
    const d = e.clientX - sx;
    if (Math.abs(d) > 4) rail.moved = true;
    galEl.scrollLeft = sl - d;
  });
  const endDrag = () => {
    if (!down) return;
    down = false; galEl.classList.remove("dragging");
    galAuto.kick();                       // don't yank the rail on release
    setTimeout(() => { rail.moved = false; }, 0);
  };
  galEl.addEventListener("pointerup", endDrag);
  galEl.addEventListener("pointerleave", endDrag);
  galEl.addEventListener("pointercancel", endDrag);

  /* ── auto-advance ──────────────────────────────────────────────────
     Shared by both sliders. It yields to the reader: hovering, focusing or
     touching the rail stops it, and any manual move restarts the clock
     rather than fighting it. Honoured only if the visitor has not asked for
     reduced motion, and only while the rail is actually on screen. */

  function autoAdvance(el, step, period) {
    // Read the preference here rather than in an outer const: the gallery
    // calls this before that line would have run, and a const in its
    // temporal dead zone throws and takes the rest of the script with it.
    if (matchMedia("(prefers-reduced-motion: reduce)").matches)
      return { kick: () => {} };
    let timer = null, held = false, visible = false;

    const tick = () => { if (!held && visible) step(); };
    const start = () => { if (!timer) timer = setInterval(tick, period); };
    const stop = () => { clearInterval(timer); timer = null; };

    // threshold 0, not a fraction: a slider taller than a short viewport can
    // never reach a fractional ratio, and would then never start at all.
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      visible ? start() : stop();
    }, { threshold: 0 }).observe(el);

    for (const ev of ["pointerenter", "focusin", "touchstart"])
      el.addEventListener(ev, () => { held = true; }, { passive: true });
    for (const ev of ["pointerleave", "focusout", "touchend", "touchcancel"])
      el.addEventListener(ev, () => { held = false; }, { passive: true });

    return { kick: () => { stop(); start(); } };
  }

  /* ── one-up slider (the long-sequence clips) ───────────────────── */

  (function seqSlider() {
    const track = $("#seqTrack");
    if (!track) return;
    const slides = [...track.children];
    const dots = $("#seqDots");

    // These two are deliberately outside the page-wide lazy watcher: the
    // slider decides which one decodes, so both must start with no src.
    slides.forEach((s) => {
      const v = $("video", s);
      if (v.src && !v.dataset.src) {
        v.dataset.src = v.src;
        v.removeAttribute("src");
        v.load();   // without this the element keeps the resource it already
                    // resolved, and both clips report a currentSrc
      }
    });

    slides.forEach((_, i) => {
      const b = document.createElement("button");
      b.className = "dot";
      b.type = "button";
      b.setAttribute("aria-label", `Clip ${i + 1}`);
      b.addEventListener("click", () => go(i));
      dots.appendChild(b);
    });

    const index = () => Math.round(track.scrollLeft / Math.max(1, track.clientWidth));

    // Scroll to the slide's own offset rather than i * clientWidth. The track
    // is a fractional width (437.6px, say) while clientWidth is rounded, so
    // multiplying lands a fraction short every time and leaves a sliver of
    // the neighbouring clip showing at the edge.
    const go = (i) => {
      const k = Math.max(0, Math.min(slides.length - 1, i));
      track.scrollTo({ left: slides[k].offsetLeft - slides[0].offsetLeft,
                       behavior: "smooth" });
    };

    function state() {
      const i = index();
      // Absent rather than "false": assistive tech reads the attribute's
      // presence, not its value.
      [...dots.children].forEach((d, k) =>
        k === i ? d.setAttribute("aria-current", "true") : d.removeAttribute("aria-current"));
      $("#seqPrev").disabled = i <= 0;
      $("#seqNext").disabled = i >= slides.length - 1;
      // Only the clip on screen should be decoding.
      slides.forEach((s, k) => {
        const v = $("video", s);
        if (k === i) { if (!v.src && v.dataset.src) v.src = v.dataset.src; v.play().catch(() => {}); }
        else v.pause();
      });
    }
    // Wrap around at the end, so the pair keeps cycling unattended.
    const auto = autoAdvance($("#seq"),
      () => go(index() >= slides.length - 1 ? 0 : index() + 1), 9000);

    $("#seqPrev").addEventListener("click", () => { go(index() - 1); auto.kick(); });
    $("#seqNext").addEventListener("click", () => { go(index() + 1); auto.kick(); });
    dots.addEventListener("click", () => auto.kick());

    track.addEventListener("scroll", () => {
      clearTimeout(track._t);
      track._t = setTimeout(state, 90);
    }, { passive: true });

    // The arrows should sit on the middle of the video, not of the whole
    // card: the captions differ in length, so a 50% offset lands low.
    function mediaHeight() {
      const v = $("video", slides[0]);
      const h = v.getBoundingClientRect().height
             || track.clientWidth * 3 / 4;        // 4:3 before metadata lands
      $("#seq").style.setProperty("--media-h", `${Math.round(h)}px`);
    }
    slides.forEach((s) => $("video", s)
      .addEventListener("loadedmetadata", mediaHeight, { once: true }));
    window.addEventListener("resize", () => { state(); mediaHeight(); });
    mediaHeight();
    state();
  })();

  /* ── lightbox ──────────────────────────────────────────────────── */

  const lb = $("#lb"), lbV = $("#lbVideo"), lbC = $("#lbCap");

  function openLb(src, cap) {
    lbV.src = encodeURI(src);
    lbC.textContent = cap;
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    lbV.play().catch(() => {});
  }
  function closeLb() {
    lb.hidden = true; lbV.pause(); lbV.removeAttribute("src"); lbV.load();
    document.body.style.overflow = "";
  }
  $("#lbClose").addEventListener("click", closeLb);
  lb.addEventListener("click", e => { if (e.target === lb) closeLb(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !lb.hidden) closeLb(); });

  /* ── hero video ────────────────────────────────────────────────── */

  const hero = $("#heroVideo");
  if (hero) { hero.dataset.src = hero.src; watch(hero); }
  // Slides are left alone here: they are driven by their own slider, they
  // already carry preload="none" so a src costs no bandwidth until played,
  // and stripping it after the slider has started one would stop it dead.
  $$("video[data-lazy]").forEach(v => {
    if (v.closest(".slider.one-up")) return;
    if (v.src && !v.dataset.src) { v.dataset.src = v.src; v.removeAttribute("src"); }
    watch(v);
  });

  /* ── nav: scrollspy, progress, mobile ──────────────────────────── */

  const nav = $("#nav");
  const prog = $("#navProgress");
  const links = $$(".nav-links a");
  const secs = links.map(a => $(a.getAttribute("href"))).filter(Boolean);

  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle("stuck", y > 8);
    const h = document.documentElement.scrollHeight - window.innerHeight;
    prog.style.width = `${h > 0 ? (y / h) * 100 : 0}%`;

    let active = -1;
    secs.forEach((s, i) => { if (s.getBoundingClientRect().top <= 120) active = i; });
    links.forEach((a, i) => a.classList.toggle("active", i === active));
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const toggle = $("#navToggle"), navLinks = $("#navLinks");
  toggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  links.forEach(a => a.addEventListener("click", () => {
    navLinks.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }));

  /* ── reveal + counters ─────────────────────────────────────────── */

  const rio = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { e.target.classList.add("in"); rio.unobserve(e.target); }
  }, { rootMargin: "0px 0px 6% 0px", threshold: 0 });
  $$(".reveal").forEach(el => rio.observe(el));

  const cio = new IntersectionObserver((es) => {
    for (const e of es) {
      if (!e.isIntersecting) continue;
      const el = e.target, target = +el.dataset.count;
      const t0 = performance.now(), dur = 1100;
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(target * eased).toLocaleString("en-US");
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      cio.unobserve(el);
    }
  }, { threshold: 1 / 4 });
  $$("[data-count]").forEach(el => cio.observe(el));

  /* ── bibtex ────────────────────────────────────────────────────── */

  const copyBtn = $("#copyBib");
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("#bibText").innerText);
    } catch {
      const r = document.createRange(); r.selectNode($("#bibText"));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      document.execCommand("copy"); s.removeAllRanges();
    }
    copyBtn.textContent = "Copied";
    copyBtn.classList.add("done");
    setTimeout(() => { copyBtn.textContent = "Copy"; copyBtn.classList.remove("done"); }, 1600);
  });

  /* Links that have no destination yet should not look live. */
  $$("[data-todo]").forEach(a => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const was = a.querySelector("svg").nextSibling;
      const old = a.textContent.trim();
      a.lastChild.textContent = " link pending";
      setTimeout(() => { a.lastChild.textContent = " " + old; }, 1400);
    });
  });
})();
