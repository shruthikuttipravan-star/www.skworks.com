"use strict";

/* =====================================================
   PIXEL ART DEFINITIONS
   Each icon is a row-grid of characters mapped to a palette.
   Rendered as inline SVG <rect> pixels (crisp at any scale).
   ===================================================== */
const PIXEL_ART = {
  "logo-cloud": {
    rows: [
      "................",
      "................",
      "...KKKKKKKK.....",
      "...KFFFFFFKKK...",
      "..KFFFFFFFFFFK..",
      ".KFFFFFFFFFFFFK.",
      "KFFFFFFFFFFFFFFK",
      "................",
    ],
    pal: { K: "#2b2140", F: "#ff9fc0" },
  },
  share: {
    rows: [
      "............",
      ".......KKK..",
      ".......KKK..",
      "......LKKK..",
      ".....L......",
      ".KKKL.......",
      ".KKK........",
      ".KKKL.......",
      ".....L......",
      "......LKKK..",
      ".......KKK..",
      ".......KKK..",
    ],
    pal: { K: "currentColor", L: "currentColor" },
  },
  speaker: {
    rows: [
      "............",
      "......K.....",
      ".....KK.....",
      "....KKK...S.",
      ".KKKKKK.S.S.",
      ".KKKKKK.S.S.",
      ".KK.KKK...S.",
      ".KK..KK.....",
      "......K.....",
      "............",
      "............",
      "............",
    ],
    pal: { K: "currentColor", S: "currentColor" },
  },
  "boot-cloud": {
    rows: [
      "................",
      "......CCCC......",
      "....CCCCCCCC....",
      "..CCCCCCCCCCCC..",
      ".CCCCCCCCCCCCCC.",
      "CCCCCCCCCCCCCCCC",
      "CCCCCKCCCCKCCCCC",
      "CCCBCCCKKKCCCBCC",
      ".CCCCCCCCCCCCCC.",
      "..CCCCCCCCCCCC..",
      "................",
      "................",
    ],
    pal: { C: "#ffffff", K: "#2b2140", B: "#ffb6c1" },
  },
  cloud: {
    rows: [
      "........................",
      "........................",
      "........CCC..CCCC.......",
      "......CCCCCC.CCCC.......",
      "......CCCCCCCCCCCC......",
      "..CCCCCCCCCCCCCCCCCCCC..",
      "....CCCCCCCCCCCCCCCC....",
      "..CCCCCCCCCCCCCCCCCCCC..",
      "........................",
      "........................",
    ],
    pal: { C: "#ffffff" },
  },
};

function pixelSvgFragment(rows, pal) {
  const h = rows.length;
  const w = rows[0].length;
  let out = "";
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === "." || !pal[ch]) continue;
      out += `<rect x="${x}" y="${y}" width="1" height="1" fill="${pal[ch]}"/>`;
    }
  }
  return { svg: out, w, h };
}

function buildIconSvg(name) {
  const def = PIXEL_ART[name];
  if (!def) return "";
  const { svg, w, h } = pixelSvgFragment(def.rows, def.pal);
  return `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
}

function mountAllIcons() {
  document.querySelectorAll("[data-icon]").forEach((el) => {
    el.innerHTML = buildIconSvg(el.dataset.icon);
  });
}

function mountGroupSvg(groupId, rows, pal) {
  const g = document.getElementById(groupId);
  if (!g) return;
  const { svg } = pixelSvgFragment(rows, pal);
  g.innerHTML = svg;
}

/* =====================================================
   SOUND ENGINE — synthesized 8-bit blips via Web Audio API
   ===================================================== */
const SoundEngine = (() => {
  let ctx = null;
  let muted = false;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function blip({ freq = 440, dur = 0.09, type = "square", gain = 0.06, slide = 0 }) {
    if (muted) return;
    const c = ensureCtx();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, c.currentTime + dur);
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    osc.connect(g).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + dur + 0.02);
  }

  return {
    unlock() { ensureCtx(); },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
    click() { blip({ freq: 520, dur: 0.05, type: "square", gain: 0.05 }); },
    open() { blip({ freq: 300, dur: 0.12, type: "square", gain: 0.07, slide: 260 }); },
    close() { blip({ freq: 420, dur: 0.12, type: "square", gain: 0.06, slide: -220 }); },
    boot() {
      if (muted) return;
      const c = ensureCtx();
      [261.6, 329.6, 392.0, 523.2].forEach((f, i) => {
        setTimeout(() => blip({ freq: f, dur: 0.16, type: "triangle", gain: 0.08 }), i * 130);
      });
    },
  };
})();

/* =====================================================
   BOOT SEQUENCE
   ===================================================== */
function initBoot() {
  mountGroupSvg("boot-logo-pixels", PIXEL_ART["boot-cloud"].rows, PIXEL_ART["boot-cloud"].pal);

  const bootScreen = document.getElementById("boot-screen");
  const desktop = document.getElementById("desktop");
  const powerBtn = document.getElementById("power-btn");
  const progressWrap = document.getElementById("boot-progress-wrap");
  const blocksEl = document.getElementById("boot-blocks");
  const status = document.getElementById("boot-status");
  const percentEl = document.getElementById("boot-percent");

  const messages = [
    "LOADING SHRUTHI OS v1.0 …",
    "MOUNTING /pastel/clouds …",
    "WAKING UP THE PIXEL GIRL …",
    "HANGING THE STICKY NOTE …",
    "POLISHING THE DOCK …",
    "DESKTOP READY — PRESS ANY VIBE",
  ];

  const BLOCK_COUNT = 20;
  const blockPalette = ["#ffb6c1", "#ffdab9", "#e6e6fa"];
  const blockEls = [];
  for (let i = 0; i < BLOCK_COUNT; i++) {
    const span = document.createElement("span");
    blocksEl.appendChild(span);
    blockEls.push(span);
  }

  function renderBlocks(pct) {
    const filled = Math.floor((pct / 100) * blockEls.length);
    blockEls.forEach((el, i) => {
      el.style.background = i < filled ? blockPalette[i % blockPalette.length] : "transparent";
    });
  }

  function runBoot() {
    SoundEngine.unlock();
    SoundEngine.boot();
    powerBtn.classList.add("hidden");
    progressWrap.classList.remove("hidden");

    const duration = 3200;
    const start = Date.now();
    let msgIndex = -1;
    status.textContent = messages[0];

    const timer = setInterval(() => {
      const pct = Math.min(100, Math.round(((Date.now() - start) / duration) * 100));
      renderBlocks(pct);
      percentEl.textContent = pct + "%";

      const nextMsgIndex = Math.min(messages.length - 1, Math.floor((pct / 100) * messages.length));
      if (nextMsgIndex !== msgIndex) {
        msgIndex = nextMsgIndex;
        status.textContent = messages[msgIndex];
      }

      if (pct >= 100) {
        clearInterval(timer);
        setTimeout(finishBoot, 450);
      }
    }, 60);
  }

  function finishBoot() {
    bootScreen.classList.add("fade-out");
    desktop.classList.remove("hidden");
    setTimeout(() => bootScreen.classList.add("hidden"), 650);
  }

  powerBtn.addEventListener("click", runBoot);
}

/* =====================================================
   CLOCK
   ===================================================== */
function initClock() {
  const clockEl = document.getElementById("clock");
  const dateEl = document.getElementById("menu-date");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function tick() {
    const now = new Date();
    let h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    clockEl.textContent = `${h}:${m}:${s} ${ampm}`;
    dateEl.textContent = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
  }
  tick();
  setInterval(tick, 1000);
}

/* =====================================================
   FLOATING CLOUDS
   ===================================================== */
function initClouds() {
  const layer = document.getElementById("clouds-layer");
  const cloudSvg = buildIconSvg("cloud");
  const configs = [
    { top: "8%", scale: 1.4, duration: 55, delay: 0, opacity: 0.9 },
    { top: "18%", scale: 0.9, duration: 40, delay: -12, opacity: 0.75 },
    { top: "30%", scale: 1.1, duration: 65, delay: -30, opacity: 0.8 },
    { top: "50%", scale: 0.7, duration: 48, delay: -5, opacity: 0.6 },
    { top: "12%", scale: 0.6, duration: 35, delay: -20, opacity: 0.55 },
  ];
  configs.forEach((cfg) => {
    const div = document.createElement("div");
    div.className = "cloud";
    div.innerHTML = cloudSvg;
    div.style.top = cfg.top;
    div.style.width = 24 * 6 * cfg.scale + "px";
    div.style.height = 10 * 6 * cfg.scale + "px";
    div.style.opacity = cfg.opacity;
    div.style.animationDuration = cfg.duration + "s";
    div.style.animationDelay = cfg.delay + "s";
    layer.appendChild(div);
  });
}

/* =====================================================
   DRAGGABLE (pointer events — sticky note + windows)
   ===================================================== */
function makeDraggable(handle, target, onStart) {
  let dragging = false;
  let offX = 0, offY = 0;

  handle.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".win-dot")) return;
    dragging = true;
    if (onStart) onStart();
    const rect = target.getBoundingClientRect();
    offX = e.clientX - rect.left;
    offY = e.clientY - rect.top;
    handle.setPointerCapture(e.pointerId);
    target.style.right = "auto";
  });
  handle.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const menubarH = 36;
    const maxX = window.innerWidth - 40;
    const maxY = window.innerHeight - 40;
    let x = e.clientX - offX;
    let y = e.clientY - offY;
    x = Math.max(-target.offsetWidth + 60, Math.min(x, maxX));
    y = Math.max(menubarH, Math.min(y, maxY));
    target.style.left = x + "px";
    target.style.top = y + "px";
  });
  handle.addEventListener("pointerup", (e) => {
    dragging = false;
    try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
  });
}

/* =====================================================
   WINDOW MANAGER
   ===================================================== */
const WindowManager = (() => {
  let zTop = 100;
  const openWindows = new Map();
  let cascadeCount = 0;

  const titles = {
    about: "About_Me.app",
    resume: "Resume.pdf — Preview",
    sheraton: "Sheraton_Maldives.proj",
    lapita: "Lapita_DubaiParks.proj",
    hdubai: "TheHDubai.proj",
    victor: "VictorMagazine.proj",
    projects: "Projects — Finder",
    contact: "Mail — New Message",
    trash: "Rejected_Concepts — Trash",
    guestbook: "guestbook.txt — Notes",
  };

  function focus(win) {
    zTop += 1;
    win.style.zIndex = zTop;
  }

  function open(id) {
    if (openWindows.has(id)) {
      const existing = openWindows.get(id);
      existing.classList.remove("hidden");
      focus(existing);
      return;
    }
    const tpl = document.getElementById(`tpl-${id}`);
    if (!tpl) return;

    const win = document.createElement("div");
    win.className = "win pixel-corners";
    win.dataset.winId = id;

    if (window.innerWidth <= 720) {
      win.style.left = "4vw";
      win.style.top = "44px";
      win.style.width = "92vw";
      win.style.height = "calc(100vh - 132px)";
    } else {
      const offset = (cascadeCount % 6) * 26;
      cascadeCount++;
      const baseW = Math.min(560, window.innerWidth - 60);
      win.style.width = baseW + "px";
      win.style.left = Math.min(window.innerWidth - baseW - 20, 140 + offset) + "px";
      win.style.top = 60 + offset + "px";
      win.style.height = Math.min(520, window.innerHeight - 150) + "px";
    }

    win.innerHTML = `
      <div class="win-titlebar">
        <button class="win-dot close" title="Close" aria-label="Close"></button>
        <button class="win-dot min" title="Minimize" aria-label="Minimize"></button>
        <button class="win-dot max" title="Maximize" aria-label="Maximize"></button>
        <span class="win-title">${titles[id] || id}</span>
      </div>
      <div class="win-body"></div>
    `;
    win.querySelector(".win-body").appendChild(tpl.content.cloneNode(true));

    document.getElementById("windows-layer").appendChild(win);
    openWindows.set(id, win);
    focus(win);
    SoundEngine.open();

    mountAllIcons();
    wireGalleryLightbox(win);
    wireHubButtons(win);
    wireGuestbook(win);

    const titlebar = win.querySelector(".win-titlebar");
    makeDraggable(titlebar, win, () => focus(win));

    win.addEventListener("pointerdown", () => focus(win));

    win.querySelector(".win-dot.close").addEventListener("click", (e) => {
      e.stopPropagation();
      close(id);
    });
    win.querySelector(".win-dot.min").addEventListener("click", (e) => {
      e.stopPropagation();
      SoundEngine.close();
      animateOut(win, () => {
        win.classList.add("hidden");
        win.classList.remove("closing");
      });
    });
    win.querySelector(".win-dot.max").addEventListener("click", (e) => {
      e.stopPropagation();
      win.classList.toggle("maximized");
    });
    titlebar.addEventListener("dblclick", () => win.classList.toggle("maximized"));
  }

  function animateOut(win, done) {
    win.classList.add("closing");
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      done();
    };
    win.addEventListener("animationend", finish, { once: true });
    setTimeout(finish, 220);
  }

  function close(id) {
    const win = openWindows.get(id);
    if (!win) return;
    SoundEngine.close();
    animateOut(win, () => {
      win.remove();
      openWindows.delete(id);
    });
  }

  return { open, close };
})();

function wireHubButtons(scope) {
  scope.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      SoundEngine.click();
      WindowManager.open(btn.dataset.open);
    });
  });
}

function wireGalleryLightbox(scope) {
  const lightbox = document.getElementById("lightbox");
  const img = document.getElementById("lightbox-img");
  scope.querySelectorAll(".gallery-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      img.src = btn.dataset.full;
      img.alt = btn.querySelector("img")?.alt || "";
      lightbox.classList.remove("hidden");
      SoundEngine.click();
    });
  });
}

/* =====================================================
   GUESTBOOK.TXT — visitor notes (persisted via /api/guestbook)
   ===================================================== */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatGuestbookTime(ts) {
  const d = new Date(ts);
  if (isNaN(d)) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " +
         d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function renderGuestbookEntries(listEl, entries) {
  if (!entries || !entries.length) {
    listEl.innerHTML = `<p class="guestbook-empty">No notes yet — be the first to sign!</p>`;
    return;
  }
  listEl.innerHTML = entries.map((entry) => `
    <div class="guestbook-entry pixel-corners">
      <div class="guestbook-entry-head">
        <span class="guestbook-entry-name">${escapeHtml(entry.name || "Anonymous")}</span>
        <span class="guestbook-entry-time">${formatGuestbookTime(entry.ts)}</span>
      </div>
      <p class="guestbook-entry-msg">${escapeHtml(entry.message || "")}</p>
    </div>
  `).join("");
}

function wireGuestbook(scope) {
  const form = scope.querySelector("#guestbook-form");
  if (!form) return;

  const listEl = scope.querySelector("#guestbook-list");
  const nameInput = scope.querySelector("#guestbook-name");
  const msgInput = scope.querySelector("#guestbook-message");
  const websiteInput = scope.querySelector("#guestbook-website");
  const countEl = scope.querySelector("#guestbook-count");
  const errorEl = scope.querySelector("#guestbook-error");
  const submitBtn = form.querySelector(".guestbook-submit");
  const MAX_LEN = 200;

  function updateCount() {
    countEl.textContent = `${Math.max(0, MAX_LEN - msgInput.value.length)} left`;
  }
  msgInput.addEventListener("input", updateCount);
  updateCount();

  async function loadEntries() {
    try {
      const res = await fetch("/api/guestbook");
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      renderGuestbookEntries(listEl, data.entries);
    } catch (_) {
      listEl.innerHTML = `<p class="guestbook-empty">Couldn't load notes right now — try reopening this window.</p>`;
    }
  }
  loadEntries();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.add("hidden");
    const message = msgInput.value.trim();
    if (!message) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "Signing…";

    try {
      const res = await fetch("/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameInput.value.trim(),
          message,
          website: websiteInput.value,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save your note.");

      SoundEngine.click();
      msgInput.value = "";
      updateCount();
      await loadEntries();
    } catch (err) {
      errorEl.textContent = err.message || "Something went wrong — try again.";
      errorEl.classList.remove("hidden");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Sign Guestbook >>";
    }
  });
}

function initLightboxClose() {
  const lightbox = document.getElementById("lightbox");
  document.getElementById("lightbox-close").addEventListener("click", () => lightbox.classList.add("hidden"));
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) lightbox.classList.add("hidden");
  });
}

/* =====================================================
   ICON / DOCK CLICK WIRING
   ===================================================== */
function initIconClicks() {
  document.querySelectorAll(".desktop-icon, .dock-icon").forEach((btn) => {
    btn.addEventListener("click", () => {
      SoundEngine.click();
      if (btn.classList.contains("dock-icon")) {
        btn.classList.remove("bounce");
        void btn.offsetWidth;
        btn.classList.add("bounce");
      }
      WindowManager.open(btn.dataset.window);
    });
  });
}

/* =====================================================
   MENU BAR DROPDOWN
   ===================================================== */
function initMenuDropdown() {
  const btn = document.getElementById("logo-menu-btn");
  const dropdown = document.getElementById("logo-dropdown");
  const soundToggle = document.getElementById("sound-toggle");

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willShow = dropdown.classList.contains("hidden");
    dropdown.classList.toggle("hidden");
    btn.setAttribute("aria-expanded", String(willShow));
  });
  document.addEventListener("click", () => dropdown.classList.add("hidden"));

  dropdown.querySelectorAll("[data-action]").forEach((item) => {
    item.addEventListener("click", () => {
      const action = item.dataset.action;
      if (action === "about") WindowManager.open("about");
      if (action === "sound") toggleSound();
      if (action === "reboot") location.reload();
    });
  });

  function toggleSound() {
    const muted = SoundEngine.toggleMute();
    soundToggle.classList.toggle("muted", muted);
  }
  soundToggle.addEventListener("click", toggleSound);
}

/* =====================================================
   SHARE BUTTON
   ===================================================== */
function initShareButton() {
  const btn = document.getElementById("share-btn");
  const toast = document.getElementById("toast");
  let toastTimer = null;

  async function copyLink() {
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch (_) {
      const temp = document.createElement("textarea");
      temp.value = url;
      temp.style.position = "fixed";
      temp.style.opacity = "0";
      document.body.appendChild(temp);
      temp.select();
      document.execCommand("copy");
      document.body.removeChild(temp);
    }
    SoundEngine.click();
    toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 1800);
  }

  btn.addEventListener("click", copyLink);
}

/* =====================================================
   STICKY NOTE DRAG
   ===================================================== */
function initStickyNote() {
  const note = document.getElementById("sticky-note");
  note.style.position = "absolute";
  makeDraggable(note, note);
}

/* =====================================================
   INIT
   ===================================================== */
document.addEventListener("DOMContentLoaded", () => {
  mountAllIcons();
  initBoot();
  initClock();
  initClouds();
  initIconClicks();
  initMenuDropdown();
  initShareButton();
  initStickyNote();
  initLightboxClose();
});
