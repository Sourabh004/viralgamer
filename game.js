// Viral Gamer — Game Mode.
// An original 90s-style platformer that reads the site top to bottom: you
// descend the Viral Gamer HQ tower floor by floor, one site section per stage.
// Loaded on demand by ui.js; exposes window.VGGame.start().
(() => {
  const T = 16;            // tile size (px)
  const W = 20;            // tower width in tiles
  const FLOOR_H = 10;      // rows per floor (floor slab is the last row)
  const HOLE = 3;          // width of the drop hole at the end of each floor
  const GRAV = 0.36;
  const JUMP = -6.4;
  const RUN = 1.9;
  const STEP = 1000 / 60;

  const C = {
    k: "#14110a", g: "#ffc23d", G: "#b8862a", s: "#e3a57c", h: "#2b1d14", r: "#ff4d5e", R: "#b02a3a",
    m: "#33e0b8", M: "#1e9c80", d: "#1d2030", w: "#f1f2f6", p: "#7b4dff", P: "#4a2aa8", o: "#ff8a3d",
  };

  // ---- Pixel sprites (original designs) ------------------------------------
  // Hero: a gamer kid with a backwards gold cap, red headset and mint hoodie.
  const HERO_TOP = [
    "...kkkkkk...",
    "..kggggggk..",
    ".kggggggggkk",
    ".kGGGGGGGkGk",
    ".khssssssrk.",
    ".khskssksrrk",
    ".kssssssssrk",
    "..kssskssk..",
    "..kmmmmmmk..",
    ".kmmmwwmmmk.",
    ".ksmmmmmmsk.",
    ".ksmmmmmmsk.",
  ];
  const HERO_LEGS = [
    ["..kddkkddk..", "..kddk.kddk.", "..kddk.kddk.", ".kkkk..kkkk."],
    ["..kddkkddk..", ".kddk...kdk.", "kkdk....kddk", "kkk.....kkkk"],
    ["..kddkkddk..", "...kddkddk..", "...kdk.kdk..", "...kkk.kkk.."],
    ["..kddkkddk..", ".kddk..kddk.", ".kdk....kdk.", "kkk......kkk"],
  ];
  // Enemy: a "glitch bug".
  const BUG = [
    ["..k......k..", "...k....k...", "..kkkkkkkk..", ".kppppppppk.", "kppwkppwkppk", "kppkkppkkppk", "kppppppppppk", ".kpPpPpPpPk.", "..kk.kk.kk.."],
    [".k........k.", "..k......k..", "..kkkkkkkk..", ".kppppppppk.", "kppwkppwkppk", "kppkkppkkppk", "kppppppppppk", ".kPpPpPpPpk.", ".kk.kk.kk..."],
  ];
  const COIN = ["..kkkk..", ".kggggk.", "kggwwggk", "kggwGggk", "kggwGggk", "kggGGggk", ".kggggk.", "..kkkk.."];
  const HEART = [".rr.rr.", "rrrrrrr", "rrrrrrr", ".rrrrr.", "..rrr..", "...r..."];

  const spriteCache = new Map();
  function sprite(rows, flip = false) {
    const key = rows.join("|") + flip;
    if (spriteCache.has(key)) return spriteCache.get(key);
    const c = document.createElement("canvas");
    c.width = rows[0].length;
    c.height = rows.length;
    const x = c.getContext("2d");
    rows.forEach((row, y) =>
      [...row].forEach((ch, i) => {
        if (ch === ".") return;
        x.fillStyle = C[ch];
        x.fillRect(flip ? row.length - 1 - i : i, y, 1, 1);
      })
    );
    spriteCache.set(key, c);
    return c;
  }

  // ---- Helpers -------------------------------------------------------------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const $ = (sel, root = document) => root.querySelector(sel);
  const istDay = (s) => (s ? new Date(`${s}T00:00:00+05:30`) : null);
  function eventInfo(e) {
    const start = istDay(e.start);
    const end = e.end ? new Date(istDay(e.end).getTime() + 86399999) : start && new Date(start.getTime() + 86399999);
    const now = new Date();
    const status = !start ? "tba" : now < start ? "upcoming" : now <= end ? "live" : "covered";
    return { ...e, startDate: start, endDate: end, status };
  }
  function countdownText(date) {
    let s = Math.max(0, Math.floor((date - new Date()) / 1000));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    s %= 60;
    return `${String(d).padStart(2, "0")}D ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  const fmtDate = (d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  const lerpHex = (a, b, t) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  };

  // ---- Sound (tiny square-wave blips, off by default) -----------------------
  let audio = null;
  let soundOn = false;
  function blip(freq, dur = 0.08, type = "square", slide = 0) {
    if (!soundOn) return;
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, audio.currentTime);
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, audio.currentTime + dur);
    g.gain.setValueAtTime(0.06, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + dur);
  }
  const sfx = {
    jump: () => blip(320, 0.12, "square", 380),
    coin: () => { blip(988, 0.06); setTimeout(() => blip(1319, 0.12), 60); },
    block: () => blip(180, 0.1, "square", -60),
    stomp: () => blip(240, 0.12, "triangle", -160),
    hurt: () => blip(140, 0.25, "sawtooth", -80),
    drop: () => blip(600, 0.2, "triangle", -420),
    win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.16), i * 120)),
  };

  // ---- Content from the site ----------------------------------------------
  function siteContent() {
    const about = [...document.querySelectorAll("#about .about-grid .panel:not(.vision) p")].map((p) => p.textContent.trim());
    const vision = $("#about .vision blockquote")?.textContent.trim() || "";
    const services = [...document.querySelectorAll("#services .card")].map((c) => ({ title: c.querySelector("h3")?.textContent.trim(), text: c.querySelector("p")?.textContent.trim() }));
    const clients = [...document.querySelectorAll("#clients .logo-row img[alt]:not([aria-hidden])")].map((i) => ({ name: i.alt, src: i.getAttribute("src") }));
    const quote = $("#clients .quote blockquote")?.textContent.trim() || "";
    const quoteBy = [...document.querySelectorAll("#clients .quote figcaption b, #clients .quote figcaption span")].map((n) => n.textContent.trim()).join(", ");
    return {
      about, vision, services, clients, quote, quoteBy,
      reach: window.VG_REACH || { platforms: [] },
      events: (window.VG_EVENTS || []).map(eventInfo),
      interviews: window.VG_INTERVIEWS || [],
      promotions: window.VG_PROMOTIONS || [],
      cases: window.VG_CASES || [],
      team: window.VG_TEAM || [],
    };
  }

  // ---- Level: a tower of floors, read top to bottom -------------------------
  // Each stage is one or more floors. Floors are laid out as if you run left
  // to right with the drop hole on the right; odd floors are mirrored so the
  // path zig-zags down the tower. Tiles: 0 empty, 1 slab, 2 brick, 3 "!" block, 4 used block.
  function buildLevel(content) {
    const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
    const stages = [];
    const stage = (name, floors) => stages.push({ name, floors });

    stage("THE HUB FOR GAMERS", [[
      { t: "billboard", c: 1, w: 15, lines: ["THE HUB", "FOR GAMERS"], sub: "SCROLL DOWN TO DESCEND" },
      { t: "coins", c: 12, dy: 2, n: 4 },
    ]]);
    stage("WHO WE ARE", [[
      { t: "sign", c: 1, lines: ["WHO", "WE ARE"] },
      { t: "block", c: 7, dialog: "about" },
      { t: "block", c: 12, dialog: "vision" },
      { t: "enemy", c: 10, min: 5, max: 15 },
    ]]);
    const plats = (content.reach.platforms || []).slice(0, 3);
    stage("BY THE NUMBERS", [
      [
        { t: "sign", c: 1, lines: ["BY THE", "NUMBERS"] },
        ...plats.map((p, i) => ({ t: "tower", c: 6 + i * 3, h: i + 1, label: p.name.toUpperCase(), value: p.count, unit: (p.label || "").toUpperCase() })),
      ],
      [{ t: "block", c: 8, dialog: "reach" }, { t: "coins", c: 3, dy: 1, n: 4 }, { t: "coins", c: 11, dy: 1, n: 4 }],
    ]);
    stage("SERVICES", chunk(content.services.map((_, i) => i), 2).map((pair, fi) => [
      ...(fi === 0 ? [{ t: "sign", c: 1, lines: ["WHAT", "WE DO"] }] : []),
      ...pair.map((i, j) => ({ t: "block", c: 6 + j * 6, dialog: `service:${i}`, bricks: true })),
      { t: "enemy", c: 9, min: 4, max: 15 },
    ]));
    stage("UPCOMING EVENTS", chunk(content.events.map((e, i) => ({ e, i })), 2).map((pair, fi) => [
      ...(fi === 0 ? [{ t: "sign", c: 0, lines: ["UPCOMING", "EVENTS"] }] : []),
      ...pair.map(({ e, i }, j) => ({ t: "gate", c: (fi === 0 ? 5 : 2) + j * 6, event: e, idx: i, dialog: `event:${i}` })),
      { t: "coins", c: 13, dy: 2, n: 2 },
    ]));
    stage("MEDIA", [[
      { t: "tv", c: 0, label: "ON THE MIC" },
      { t: "block", c: 5, dialog: "interviews" },
      { t: "tv", c: 8, label: "CAMPAIGNS" },
      { t: "block", c: 13, dialog: "promotions" },
    ]]);
    stage("CASE STUDIES", [[
      { t: "sign", c: 1, lines: ["PROVEN", "WORK"] },
      { t: "block", c: 9, dialog: "cases" },
      { t: "coins", c: 5, dy: 1, n: 3 },
      { t: "enemy", c: 13, min: 6, max: 15 },
    ]]);
    stage("THE SQUAD", chunk(content.team.map((p, i) => ({ p, i })), 3).map((group, fi) => [
      ...(fi === 0 ? [{ t: "sign", c: 0, lines: ["MEET THE", "SQUAD"] }] : []),
      ...group.map(({ p, i }, j) => ({ t: "npc", c: (fi === 0 ? 5 : 2) + j * 4, person: p, dialog: `team:${i}` })),
    ]));
    stage("TRUSTED BY", [[
      { t: "logos", c: 1, clients: content.clients },
      { t: "block", c: 9, dialog: "clients" },
      { t: "enemy", c: 13, min: 3, max: 15 },
    ]]);
    stage("PLAYER 2 READY?", [[
      { t: "sign", c: 1, lines: ["PLAYER 2", "READY?"] },
      { t: "coins", c: 6, dy: 1, n: 4 },
      { t: "trophy", c: 13, dialog: "win" },
    ]]);

    const floorCount = stages.reduce((n, s) => n + s.floors.length, 0);
    const rows = floorCount * FLOOR_H;
    const tiles = new Uint8Array(W * rows);
    const set = (x, y, v) => { if (x >= 0 && x < W && y >= 0 && y < rows) tiles[y * W + x] = v; };
    const L = { W, rows, tiles, zones: [], floors: [], blocks: new Map(), coins: [], enemies: [], objects: [], checkpoints: [] };

    let fi = 0;
    stages.forEach((st, si) => {
      const y0 = fi * FLOOR_H;
      st.floors.forEach((items, k) => {
        const slab = fi * FLOOR_H + FLOOR_H - 1;      // floor slab row
        const last = si === stages.length - 1 && k === st.floors.length - 1;
        const mirror = fi % 2 === 1;                  // hole on the left
        const mx = (c, w = 1) => (mirror ? W - c - w : c);
        for (let x = 0; x < W; x++) set(x, slab, 1);
        let hole = null;
        if (!last) {
          hole = mirror ? [0, HOLE - 1] : [W - HOLE, W - 1];
          for (let x = hole[0]; x <= hole[1]; x++) set(x, slab, 0);
        }
        L.floors.push({ slab, hole, dir: mirror ? -1 : 1 });
        const gy = slab * T; // y of the walking surface
        if (k === 0) L.objects.push({ type: "flag", x: mx(0) * T + (mirror ? 2 : 2), y: gy, label: st.name });
        items.forEach((it) => {
          switch (it.t) {
            case "billboard": L.objects.push({ type: "billboard", x: mx(it.c, it.w) * T, y: gy, w: it.w * T, lines: it.lines, sub: it.sub }); break;
            case "sign": L.objects.push({ type: "sign", x: mx(it.c, 3) * T, y: gy, lines: it.lines }); break;
            case "block": {
              const bx = mx(it.c);
              set(bx, slab - 4, 3);
              L.blocks.set(`${bx},${slab - 4}`, it.dialog);
              if (it.bricks) { set(bx - 1, slab - 4, 2); set(bx + 1, slab - 4, 2); }
              break;
            }
            // Coins sit at walking height so scrolling (auto-run) collects them too.
            case "coins": for (let i = 0; i < it.n; i++) L.coins.push({ x: mx(it.c + i) * T + 4, y: (slab - 1) * T + 4, got: false }); break;
            case "enemy": L.enemies.push({ x: mx(it.c) * T, y: gy - 9, w: 12, h: 9, vx: mirror ? 0.45 : -0.45, min: Math.min(mx(it.min), mx(it.max)) * T, max: Math.max(mx(it.min), mx(it.max)) * T, alive: true, squash: 0 }); break;
            case "tower": {
              const tx = mx(it.c, 3);
              for (let yy = 1; yy <= it.h; yy++) for (let i = 0; i < 3; i++) set(tx + i, slab - yy, 2);
              L.objects.push({ type: "tower", x: tx * T, y: (slab - it.h) * T, w: 3 * T, label: it.label, value: it.value, unit: it.unit });
              break;
            }
            case "gate": L.objects.push({ type: "gate", x: mx(it.c, 3) * T, y: gy, w: 3 * T, event: it.event, idx: it.idx, dialog: it.dialog }); break;
            case "tv": L.objects.push({ type: "tv", x: mx(it.c, 4) * T, y: gy, label: it.label }); break;
            case "npc": L.objects.push({ type: "npc", x: mx(it.c, 2) * T, y: gy, person: it.person, dialog: it.dialog }); break;
            case "logos": L.objects.push({ type: "logos", x: mx(it.c, 15) * T, y: gy - 118, clients: it.clients }); break;
            case "trophy": L.objects.push({ type: "trophy", x: mx(it.c) * T, y: gy, dialog: it.dialog }); break;
          }
        });
        if (k === 0) L.checkpoints.push({ x: mx(1) * T + 3, y: (slab - 2) * T });
        fi++;
      });
      L.zones.push({ name: st.name, y0: y0 * T, y1: fi * FLOOR_H * T });
    });
    return L;
  }

  // ---- Dialog content ---------------------------------------------------------
  function dialogHTML(id, content) {
    const [kind, idxStr] = id.split(":");
    const idx = Number(idxStr);
    const link = (url, text) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`;
    switch (kind) {
      case "about":
        return { title: "WHO WE ARE", body: content.about.map((p) => `<p>${esc(p)}</p>`).join("") };
      case "vision":
        return { title: "OUR VISION", body: `<p class="g-big">${esc(content.vision)}</p>` };
      case "reach": {
        const rows = (content.reach.platforms || []).concat(content.reach.pages || [])
          .map((p) => `<li><span>${esc(p.name)}</span><b>${esc(p.count)}</b><small>${esc(p.label)}</small></li>`).join("");
        return { title: "BY THE NUMBERS", body: `<div class="g-stats"><div><b>1.3M+</b><small>FOLLOWERS ACROSS PLATFORMS</small></div><div><b>20M+</b><small>MONTHLY REACH</small></div></div><ul class="g-list">${rows}</ul>` };
      }
      case "service": {
        const s = content.services[idx] || {};
        return { title: `POWER-UP ${idx + 1}/${content.services.length}`, body: `<h3>${esc(s.title)}</h3><p>${esc(s.text)}</p>` };
      }
      case "event": {
        const e = content.events[idx];
        const when = e.startDate ? (e.end && e.end !== e.start ? `${fmtDate(e.startDate)} – ${fmtDate(e.endDate)}` : fmtDate(e.startDate)) : "Dates to be announced";
        const status = { upcoming: "UPCOMING", live: "LIVE NOW", covered: "COVERED", tba: "TBA" }[e.status];
        return {
          title: `WARP GATE: ${e.tag.toUpperCase()}`,
          body: `<p class="g-chip ${e.status}">${status}</p><h3>${esc(e.name || e.tag)}</h3><p>${esc(when)}${e.venue ? ` · ${esc(e.venue)}` : ""}</p>` +
            (e.status === "upcoming" ? `<p class="g-count" data-count-to="${e.startDate.getTime()}">${countdownText(e.startDate)}</p>` : "") +
            (e.note ? `<p class="g-small">${esc(e.note)}</p>` : ""),
        };
      }
      case "interviews":
      case "promotions": {
        const list = kind === "interviews" ? content.interviews : content.promotions;
        const items = list.map((r, i) => `<li>${link(r.url, `▶ ${r.guest || (kind === "interviews" ? "INTERVIEW" : "CAMPAIGN")} ${i + 1}`)}</li>`).join("");
        return { title: kind === "interviews" ? "EXCLUSIVE INTERVIEWS" : "EVENT & BRAND PROMOTIONS", body: `<ul class="g-links">${items}</ul><p class="g-small">Opens the reel on Instagram.</p>` };
      }
      case "cases":
        return {
          title: "CASE STUDIES",
          body: content.cases.map((c) => `<h3>${esc(c.client)}: ${esc(c.title)}</h3><p>${esc(c.summary)}</p>${c.quote ? `<p class="g-quote">“${esc(c.quote)}”<br><small>— ${esc(c.quoteBy)}</small></p>` : ""}`).join("<hr>"),
        };
      case "team": {
        const p = content.team[idx];
        const ovr = Math.round(p.stats.reduce((s, [, v]) => s + v, 0) / p.stats.length);
        const bars = p.stats.map(([l, v]) => `<li><span>${esc(l)}</span><i style="--v:${v}%"></i><b>${v}</b></li>`).join("");
        return {
          title: `PLAYER ${String(idx + 1).padStart(2, "0")}`,
          body: `<div class="g-player"><img src="assets/team/${esc(p.photo)}" alt="${esc(p.name)}"><div><p class="g-chip upcoming">${esc(p.class)}</p><h3>${esc(p.name)}</h3><p>${esc(p.role)}</p><p class="g-ovr">OVR ${ovr}</p></div></div><ul class="g-bars">${bars}</ul>`,
        };
      }
      case "clients":
        return {
          title: "TRUSTED BY",
          body: `<div class="g-logos">${content.clients.map((c) => `<img src="${esc(c.src)}" alt="${esc(c.name)}" title="${esc(c.name)}">`).join("")}</div>${content.quote ? `<p class="g-quote">“${esc(content.quote)}”<br><small>— ${esc(content.quoteBy)}</small></p>` : ""}`,
        };
      case "win":
        return { title: "STAGE CLEAR!", body: `<p class="g-big">YOU REACHED THE GROUND FLOOR OF THE HUB FOR GAMERS.</p><p>Ready to build your next campaign with Viral Gamer?</p>`, win: true };
      default:
        return { title: "", body: "" };
    }
  }

  // ---- Game ---------------------------------------------------------------------
  let G = null;

  function start() {
    if (G) return;
    const content = siteContent();
    const level = buildLevel(content);
    const worldW = level.W * T, worldH = level.rows * T;

    const root = document.createElement("div");
    root.className = "vg-game";
    root.innerHTML = `
      <canvas class="g-canvas" aria-label="Viral Gamer game mode"></canvas>
      <div class="g-top">
        <button class="g-btn" data-act="sound" aria-label="Toggle sound">♪ OFF</button>
        <button class="g-btn" data-act="exit" aria-label="Exit game mode">✕ EXIT</button>
      </div>
      <div class="g-touch" aria-hidden="true">
        <button data-k="left">◀</button><button data-k="right">▶</button><button data-k="jump" class="g-a">A</button>
      </div>
      <div class="g-start">
        <p class="g-logo">VIRAL GAMER</p>
        <p class="g-sub">THE HUB FOR GAMERS · THE GAME</p>
        <p class="g-press">PRESS START</p>
        <ul class="g-help">
          <li><b>SCROLL DOWN</b> TO DESCEND THE TOWER</li>
          <li><b>← →</b> / <b>A D</b> RUN · <b>SPACE</b> / <b>↑</b> JUMP</li>
          <li>HIT <b>!</b> BLOCKS · ENTER GATES · TALK TO THE SQUAD</li>
        </ul>
      </div>
      <div class="g-dialog" hidden role="dialog" aria-modal="true">
        <div class="g-box"><p class="g-title"></p><div class="g-body"></div><div class="g-actions"></div></div>
      </div>`;
    document.body.appendChild(root);
    document.documentElement.classList.add("vg-game-on");
    window.dispatchEvent(new CustomEvent("vg-game", { detail: true }));

    const canvas = $(".g-canvas", root);
    const ctx = canvas.getContext("2d");
    const dlg = $(".g-dialog", root);

    // Team photos and client logos, pixelated once.
    const pixelate = (src, w, h, bg) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const img = new Image();
      img.onload = () => {
        const x = c.getContext("2d");
        if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); x.drawImage(img, 1, 1, w - 2, h - 2); }
        else x.drawImage(img, 0, 0, w, h);
      };
      img.src = src;
      return c;
    };
    const teamPix = content.team.map((p) => pixelate(`assets/team/${p.photo}`, 18, 22));
    const logoPix = content.clients.map((cl) => pixelate(cl.src, 22, 16, "#f4f4f6"));

    const cp0 = level.checkpoints[0];
    const state = {
      started: false, paused: false, done: false,
      p: { x: cp0.x, y: cp0.y, w: 10, h: 16, vx: 0, vy: 0, onGround: false, face: 1, anim: 0, inv: 0, coyote: 0, autoHold: 0 },
      camX: 0, camY: 0, xp: 0, coins: 0, hearts: 3, checkpoint: 0, zone: -1, banner: 0, bannerText: "",
      bumps: [], pops: [], particles: [], keys: new Set(), intent: 0, t: 0, wasAir: false,
    };
    let scale = 2, vw = 320, vh = 240;

    function resize() {
      scale = Math.max(2, Math.floor(Math.min(window.innerHeight / 220, window.innerWidth / 200)));
      vw = Math.ceil(window.innerWidth / scale);
      vh = Math.ceil(window.innerHeight / scale);
      canvas.width = vw;
      canvas.height = vh;
      ctx.imageSmoothingEnabled = false;
    }
    resize();
    window.addEventListener("resize", resize);

    // ---- Physics helpers
    const tileAt = (tx, ty) => (tx < 0 || tx >= level.W ? 1 : ty < 0 ? 0 : ty >= level.rows ? 1 : level.tiles[ty * level.W + tx]);
    const solid = (tx, ty) => tileAt(tx, ty) > 0;
    function moveX(e) {
      e.x += e.vx;
      const top = Math.floor(e.y / T), bot = Math.floor((e.y + e.h - 1) / T);
      e.hitWall = false;
      if (e.vx > 0) {
        const tx = Math.floor((e.x + e.w - 1) / T);
        for (let ty = top; ty <= bot; ty++) if (solid(tx, ty)) { e.x = tx * T - e.w; e.vx = 0; e.hitWall = true; break; }
      } else if (e.vx < 0) {
        const tx = Math.floor(e.x / T);
        for (let ty = top; ty <= bot; ty++) if (solid(tx, ty)) { e.x = (tx + 1) * T; e.vx = 0; e.hitWall = true; break; }
      }
    }
    function moveY(e, onHead) {
      e.y += e.vy;
      const l = Math.floor(e.x / T), r = Math.floor((e.x + e.w - 1) / T);
      e.onGround = false;
      if (e.vy > 0) {
        const ty = Math.floor((e.y + e.h - 1) / T);
        for (let tx = l; tx <= r; tx++) if (solid(tx, ty)) { e.y = ty * T - e.h; e.vy = 0; e.onGround = true; break; }
      } else if (e.vy < 0) {
        const ty = Math.floor(e.y / T);
        const cxT = Math.floor((e.x + e.w / 2) / T);
        const order = [cxT, l, r].filter((v, i, a) => a.indexOf(v) === i);
        for (const tx of order) if (solid(tx, ty)) { e.y = (ty + 1) * T; e.vy = 0; onHead && onHead(tx, ty); break; }
      }
    }
    // The floor whose slab is the next one at or below the player's feet.
    const floorBelow = (p) => level.floors.find((f) => f.slab * T >= p.y + p.h - 2) || level.floors[level.floors.length - 1];

    // ---- Dialogs
    let dialogId = null;
    const queue = []; // dialogs triggered while another is open show next, in order
    function openDialog(id) {
      if (dialogId) {
        if (!queue.includes(id) && id !== dialogId) queue.push(id);
        return;
      }
      const d = dialogHTML(id, content);
      dialogId = id;
      state.paused = true;
      state.intent = 0;
      state.keys.clear();
      $(".g-title", dlg).textContent = d.title;
      $(".g-body", dlg).innerHTML = d.body;
      $(".g-actions", dlg).innerHTML = d.win
        ? `<button class="g-btn g-primary" data-act="brief">SEND A BRIEF</button><button class="g-btn" data-act="again">PLAY AGAIN</button><button class="g-btn" data-act="exit">EXIT</button>`
        : `<button class="g-btn g-primary" data-act="close">CONTINUE ▼</button>`;
      dlg.hidden = false;
      $(".g-primary", dlg)?.focus();
    }
    function closeDialog() {
      dlg.hidden = true;
      dialogId = null;
      state.paused = false;
      if (queue.length) openDialog(queue.shift());
    }

    function hitBlock(tx, ty) {
      sfx.block();
      state.bumps.push({ tx, ty, t: 0 });
      const id = level.blocks.get(`${tx},${ty}`);
      if (tileAt(tx, ty) === 3 && id) {
        level.tiles[ty * level.W + tx] = 4;
        state.xp += 500;
        state.pops.push({ x: tx * T + 4, y: ty * T - 8, vy: -3, t: 0 });
        sfx.coin();
        setTimeout(() => openDialog(id), 260);
      }
    }

    function hurt() {
      if (state.p.inv > 0) return;
      state.hearts -= 1;
      state.p.inv = 90;
      state.p.vy = -4;
      state.p.vx = -2 * state.p.face;
      sfx.hurt();
      if (state.hearts <= 0) respawn(true);
    }
    function respawn(full) {
      const cp = level.checkpoints[state.checkpoint] || cp0;
      Object.assign(state.p, { x: cp.x, y: cp.y, vx: 0, vy: 0, inv: 60 });
      if (full) {
        state.hearts = 3;
        state.banner = 120;
        state.bannerText = "CONTINUE!";
      }
    }

    // ---- Update
    function update() {
      const s = state;
      s.t++;
      const p = s.p;
      const k = s.keys;
      let dir = k.has("right") ? 1 : k.has("left") ? -1 : 0;
      let autoJump = false;

      // Scroll intent: down = head for this floor's hole and drop through it;
      // up = stroll back the other way. Hops walls, bugs and unopened blocks.
      if (!dir && Math.abs(s.intent) > 0.5) {
        const f = floorBelow(p);
        const cx = p.x + p.w / 2;
        // On each floor: open any unopened "!" block first, then make for the hole.
        const pending = [...level.blocks.keys()]
          .map((key) => key.split(",").map(Number))
          .filter(([bx, by]) => by === f.slab - 4 && tileAt(bx, by) === 3)
          .map(([bx]) => bx * T + 8)
          .sort((a, b) => Math.abs(a - cx) - Math.abs(b - cx));
        let target = f.hole ? (f.hole[0] + HOLE / 2) * T : level.objects.find((o) => o.type === "trophy").x + 8;
        let underBlock = false;
        if (pending.length && s.intent > 0) {
          target = pending[0];
          underBlock = Math.abs(target - cx) < 2.5;
        }
        const toward = Math.sign(target - cx) || f.dir;
        dir = s.intent > 0 ? (p.onGround ? (underBlock ? 0 : toward) : p.face) : -(f.dir);
        s.intent -= Math.sign(s.intent) * 2.2;
        if (Math.abs(s.intent) < 2.2) s.intent = 0;
        if (p.onGround && underBlock) {
          // Centred under the block: hop straight up so the head meets it squarely.
          p.vx = 0;
          p.blockHop = 24;
          autoJump = true;
        } else if (dir && p.onGround) {
          const ahead = dir > 0 ? p.x + p.w + 6 : p.x - 6;
          const tx = Math.floor(ahead / T);
          const feet = Math.floor((p.y + p.h - 1) / T);
          const wall = solid(tx, feet) || solid(tx, feet - 1);
          const enemyNear = level.enemies.some((e) => e.alive && Math.abs(e.y + e.h - (p.y + p.h)) < 6 && (e.x - p.x) * dir > 0 && Math.abs(e.x - p.x) < 34);
          autoJump = wall || enemyNear;
        }
      }

      if (dir) {
        p.vx += dir * 0.28;
        p.face = dir;
      } else {
        p.vx *= p.onGround ? 0.72 : 0.92;
        if (Math.abs(p.vx) < 0.05) p.vx = 0;
      }
      p.vx = Math.max(-RUN, Math.min(RUN, p.vx));
      if (p.blockHop > 0) {
        p.blockHop--;
        if (!k.has("left") && !k.has("right")) p.vx = Math.max(-0.5, Math.min(0.5, p.vx));
      }

      p.coyote = p.onGround ? 6 : Math.max(0, p.coyote - 1);
      if (k.has("jumpPressed") || autoJump) {
        k.delete("jumpPressed");
        if (p.coyote > 0) {
          p.vy = JUMP;
          p.coyote = 0;
          if (autoJump) p.autoHold = 16; // auto-runner holds the jump for a full arc
          sfx.jump();
        }
      }
      if (p.autoHold > 0) p.autoHold--;
      if (!k.has("jump") && !(p.autoHold > 0) && p.vy < -2.4) p.vy += 0.5; // short hop on early release
      p.vy = Math.min(p.vy + GRAV, 7);

      moveX(p);
      moveY(p, hitBlock);
      if (p.inv > 0) p.inv--;
      p.anim = p.onGround && Math.abs(p.vx) > 0.2 ? p.anim + Math.abs(p.vx) * 0.12 : 0;
      if (!p.onGround && p.vy > 3 && !s.wasAir) { s.wasAir = true; sfx.drop(); }
      if (p.onGround) s.wasAir = false;
      if (p.y > worldH + 40) respawn(false);

      // Stages
      const zi = level.zones.findIndex((z) => p.y + p.h / 2 >= z.y0 && p.y + p.h / 2 < z.y1);
      if (zi !== -1 && zi !== s.zone) {
        s.zone = zi;
        if (zi > s.checkpoint) s.checkpoint = zi;
        s.banner = 110;
        s.bannerText = `STAGE ${zi + 1} · ${level.zones[zi].name}`;
      }
      if (s.banner > 0) s.banner--;

      // Coins
      level.coins.forEach((c) => {
        if (!c.got && p.x < c.x + 8 && p.x + p.w > c.x && p.y < c.y + 8 && p.y + p.h > c.y) {
          c.got = true;
          s.coins++;
          s.xp += 100;
          sfx.coin();
          for (let i = 0; i < 5; i++) s.particles.push({ x: c.x + 4, y: c.y + 4, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2, t: 20, c: C.g });
        }
      });

      // Enemies
      level.enemies.forEach((e) => {
        if (!e.alive) { if (e.squash > 0) e.squash--; return; }
        e.vy = (e.vy || 0) + GRAV;
        const before = e.vx;
        moveX(e);
        moveY(e);
        if (e.hitWall) e.vx = -before;
        const aheadX = e.vx > 0 ? e.x + e.w + 1 : e.x - 1;
        if (e.onGround && !solid(Math.floor(aheadX / T), Math.floor((e.y + e.h) / T))) e.vx = -e.vx;
        if (e.x < e.min) e.vx = Math.abs(e.vx);
        if (e.x > e.max) e.vx = -Math.abs(e.vx);
        if (p.x < e.x + e.w && p.x + p.w > e.x && p.y < e.y + e.h && p.y + p.h > e.y) {
          if (p.vy > 0 && p.y + p.h - e.y < 8) {
            e.alive = false;
            e.squash = 30;
            p.vy = -4.5;
            s.xp += 200;
            sfx.stomp();
            for (let i = 0; i < 8; i++) s.particles.push({ x: e.x + 6, y: e.y + 4, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3, t: 24, c: C.p });
          } else hurt();
        }
      });

      // Interactables: gates, squad, trophy (fire once per visit)
      level.objects.forEach((o) => {
        if (!o.dialog) return;
        const w = o.type === "gate" ? o.w : o.type === "npc" ? 20 : 18;
        const near = p.x + p.w > o.x + 2 && p.x < o.x + w - 2 && p.y + p.h > o.y - 48 && p.y + p.h <= o.y + 2;
        if (near && !o.inside) {
          o.inside = true;
          if (o.dialog === "win") {
            if (!s.done) {
              s.done = true;
              sfx.win();
              for (let i = 0; i < 60; i++) s.particles.push({ x: o.x + 8, y: o.y - 30, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 5, t: 60, c: [C.g, C.r, C.m, C.w][i % 4] });
            }
            setTimeout(() => openDialog("win"), 400);
          } else {
            sfx.coin();
            openDialog(o.dialog);
          }
        } else if (!near) o.inside = false;
      });

      s.bumps = s.bumps.filter((b) => ++b.t < 10);
      s.pops = s.pops.filter((c) => { c.y += c.vy; c.vy += 0.3; return ++c.t < 22; });
      s.particles = s.particles.filter((q) => { q.x += q.vx; q.y += q.vy; q.vy += 0.15; return --q.t > 0; });

      followCamera(0.12);
    }

    function followCamera(ease) {
      const p = state.p;
      const tx = vw >= worldW ? -(vw - worldW) / 2 : Math.max(0, Math.min(worldW - vw, p.x + p.w / 2 - vw / 2));
      const ty = Math.max(-40, Math.min(worldH - vh, p.y + p.h / 2 - vh * 0.42));
      state.camX += (tx - state.camX) * ease;
      state.camY += (ty - state.camY) * ease;
    }

    // ---- Render
    const DUSK = ["#170d2e", "#24124a", "#3b1b5f", "#5a2468", "#8a2f6a", "#c2455f", "#e8735a", "#f5a85c"];
    const NIGHT = ["#05060c", "#080a16", "#0b0e1e", "#0f1226", "#13162e", "#161a36", "#1a1e3e", "#1d2244"];
    const stars = Array.from({ length: 70 }, (_, i) => ({ x: (i * 97) % 997, y: (i * 61) % 541, tw: i % 7 }));
    const city = Array.from({ length: 40 }, (_, i) => ({ w: 14 + ((i * 37) % 18), h: 40 + ((i * 53) % 90) }));
    const clouds = Array.from({ length: 10 }, (_, i) => ({ x: i * 120 + ((i * 71) % 60), y: 30 + ((i * 29) % 70) }));

    function text(str, x, y, color = C.w, size = 8, align = "left") {
      ctx.font = `${size}px "Press Start 2P", monospace`;
      ctx.textAlign = align;
      ctx.textBaseline = "top";
      ctx.fillStyle = C.k;
      ctx.fillText(str, Math.round(x) + 1, Math.round(y) + 1);
      ctx.fillStyle = color;
      ctx.fillText(str, Math.round(x), Math.round(y));
    }

    function drawBackground() {
      const depth = Math.max(0, Math.min(1, state.camY / Math.max(1, worldH - vh)));
      // Sky darkens from dusk to night as you descend.
      const bandH = Math.ceil(vh / DUSK.length) + 1;
      DUSK.forEach((c, i) => {
        ctx.fillStyle = lerpHex(c, NIGHT[i], Math.min(1, depth * 1.6));
        ctx.fillRect(0, i * bandH, vw, bandH + 1);
      });
      // Stars fade in with depth.
      ctx.fillStyle = "#ffffff";
      stars.forEach((st) => {
        ctx.globalAlpha = Math.min(1, depth * 2) * (0.4 + ((state.t / 20 + st.tw) % 7) / 12);
        ctx.fillRect(st.x % vw, (st.y - state.camY * 0.05) % vh < 0 ? ((st.y - state.camY * 0.05) % vh) + vh : (st.y - state.camY * 0.05) % vh, 1, 1);
      });
      ctx.globalAlpha = 1;
      // Sun sets out of view as you go down.
      const sunY = vh * 0.32 - state.camY * 0.35, sunX = vw * 0.72;
      if (sunY > -50) {
        for (let yy = -40; yy <= 40; yy++) {
          const half = Math.floor(Math.sqrt(1600 - yy * yy));
          if (yy > 6 && (yy >> 2) % 2 === 0) continue;
          ctx.fillStyle = yy < 0 ? "#ffd36b" : "#ff8a5c";
          ctx.fillRect(Math.round(sunX - half), Math.round(sunY + yy), half * 2, 1);
        }
      }
      // Clouds drift up past you.
      ctx.fillStyle = "rgba(255,220,240,.4)";
      clouds.forEach((c) => {
        const y = c.y - state.camY * 0.2;
        if (y < -20 || y > vh) return;
        const x = ((c.x + state.t * 0.1) % (vw + 120)) - 60;
        ctx.fillRect(x, y, 34, 6); ctx.fillRect(x + 6, y - 4, 20, 4); ctx.fillRect(x + 4, y + 6, 26, 3);
      });
      // City skyline rises as you descend into it.
      const base = vh * 0.95 + 40 - state.camY * 0.18;
      let x = -10, i = 0;
      while (x < vw) {
        const b = city[i % city.length];
        const top = base - b.h;
        ctx.fillStyle = "#1b1030";
        ctx.fillRect(Math.round(x), Math.round(top), b.w, vh);
        ctx.fillStyle = "rgba(255,194,61,.5)";
        for (let wy = top + 4; wy < Math.min(vh, top + b.h + vh); wy += 7)
          for (let wx = 3; wx < b.w - 3; wx += 5) if (((wx * 7 + Math.round(wy - top) * 3 + i) % 5) === 0 && wy > 0) ctx.fillRect(Math.round(x) + wx, Math.round(wy), 2, 3);
        x += b.w + 6;
        i++;
      }
    }

    // The tower: interior wall behind the play column, side walls, floor numbers.
    function drawTower() {
      const cx = Math.round(-state.camX), cy = Math.round(-state.camY);
      ctx.fillStyle = "rgba(13,15,20,.62)";
      ctx.fillRect(cx, Math.max(0, cy), worldW, Math.min(vh, worldH + cy));
      // Window bays
      level.floors.forEach((f, i) => {
        const fy = f.slab * T + cy;
        if (fy < -FLOOR_H * T || fy > vh + T) return;
        for (let b = 0; b < 4; b++) {
          const bx = cx + 16 + b * 76;
          ctx.fillStyle = "rgba(123,77,255,.08)";
          ctx.fillRect(bx, fy - 120, 44, 70);
          ctx.fillStyle = "rgba(255,255,255,.05)";
          ctx.fillRect(bx, fy - 120, 44, 2);
        }
        text(`FLOOR ${String(level.floors.length - i).padStart(2, "0")}`, cx + worldW / 2, fy - 150, "rgba(255,255,255,.12)", 8, "center");
      });
      // Side walls (bricks) when the screen is wider than the tower.
      [cx - T, cx + worldW].forEach((wx) => {
        if (wx + T < 0 || wx > vw) return;
        for (let y = Math.max(cy, ((cy % T) + T) % T - T); y < vh; y += T) {
          if (y + T < cy) continue;
          drawTile(2, wx, y, 0, Math.floor((y - cy) / T));
        }
      });
    }

    function drawTile(t, px, py, tx, ty) {
      if (t === 1) {
        ctx.fillStyle = "#5a2e1a"; ctx.fillRect(px, py, T, T);
        ctx.fillStyle = "#3a1c10";
        ctx.fillRect(px, py + 15, T, 1); ctx.fillRect(px + ((tx % 2) ? 4 : 11), py + 4, 1, 11);
        ctx.fillStyle = C.M; ctx.fillRect(px, py, T, 4);
        ctx.fillStyle = C.m; ctx.fillRect(px, py, T, 2);
        ctx.fillRect(px + 2, py + 4, 2, 1); ctx.fillRect(px + 9, py + 4, 2, 1);
      } else if (t === 2) {
        ctx.fillStyle = "#b8662c"; ctx.fillRect(px, py, T, T);
        ctx.fillStyle = "#5a2e1a";
        ctx.fillRect(px, py + 7, T, 1); ctx.fillRect(px, py + 15, T, 1); ctx.fillRect(px + 15, py, 1, T);
        ctx.fillRect(px + 7, py, 1, 7); ctx.fillRect(px + 3, py + 8, 1, 7); ctx.fillRect(px + 11, py + 8, 1, 7);
        ctx.fillStyle = "#e08a45"; ctx.fillRect(px, py, T - 1, 1);
      } else if (t === 3 || t === 4) {
        const used = t === 4;
        ctx.fillStyle = C.k; ctx.fillRect(px, py, T, T);
        const shimmer = !used && Math.floor(state.t / 10) % 6 === 0;
        ctx.fillStyle = used ? "#6b4a2a" : shimmer ? "#ffe08a" : C.g; ctx.fillRect(px + 1, py + 1, T - 2, T - 2);
        ctx.fillStyle = used ? "#4a311b" : C.G;
        ctx.fillRect(px + 1, py + T - 3, T - 2, 2); ctx.fillRect(px + T - 3, py + 1, 2, T - 2);
        ctx.fillStyle = used ? "#8a6a48" : "#fff2c4";
        [[2, 2], [T - 4, 2], [2, T - 5], [T - 5, T - 5]].forEach(([a, b]) => ctx.fillRect(px + a, py + b, 2, 2));
        if (!used) { ctx.fillStyle = C.k; ctx.fillRect(px + 7, py + 3, 2, 6); ctx.fillRect(px + 7, py + 11, 2, 2); }
      }
    }

    function drawObjects() {
      const camX = Math.round(state.camX), camY = Math.round(state.camY);
      level.objects.forEach((o) => {
        const x = Math.round(o.x - camX), y = Math.round(o.y - camY);
        if (y < -40 || y > vh + 200 || x < -260 || x > vw + 60) return;
        switch (o.type) {
          case "flag":
            ctx.fillStyle = "#c9ccd8"; ctx.fillRect(x, y - 48, 2, 48);
            ctx.fillStyle = C.r; ctx.fillRect(x + 2, y - 48, 14, 9);
            text("VG", x + 3, y - 47, C.w, 6);
            break;
          case "billboard":
            ctx.fillStyle = "#3a2a1a"; ctx.fillRect(x + 20, y - 40, 4, 40); ctx.fillRect(x + o.w - 24, y - 40, 4, 40);
            ctx.fillStyle = C.k; ctx.fillRect(x, y - 116, o.w, 78);
            ctx.fillStyle = "#24124a"; ctx.fillRect(x + 2, y - 114, o.w - 4, 74);
            ctx.fillStyle = C.g; ctx.fillRect(x + 2, y - 114, o.w - 4, 2); ctx.fillRect(x + 2, y - 42, o.w - 4, 2);
            text(o.lines[0], x + o.w / 2, y - 104, C.w, 16, "center");
            text(o.lines[1], x + o.w / 2, y - 84, C.g, 16, "center");
            if (Math.floor(state.t / 30) % 2) text(o.sub, x + o.w / 2, y - 58, C.m, 6, "center");
            text("▼", x + o.w / 2, y - 50, C.m, 6, "center");
            break;
          case "sign":
            ctx.fillStyle = "#3a2a1a"; ctx.fillRect(x + 22, y - 22, 4, 22);
            ctx.fillStyle = C.k; ctx.fillRect(x, y - 46, 48, 26);
            ctx.fillStyle = "#c98a4a"; ctx.fillRect(x + 1, y - 45, 46, 24);
            ctx.fillStyle = "#a86a32"; ctx.fillRect(x + 1, y - 33, 46, 1);
            o.lines.forEach((l, i) => text(l, x + 24, y - 42 + i * 11, C.k, 6, "center"));
            break;
          case "tower":
            text(o.label, x + o.w / 2, y - 30, C.w, 6, "center");
            text(o.value, x + o.w / 2, y - 20, C.g, 8, "center");
            text(o.unit, x + o.w / 2, y - 9, C.m, 5, "center");
            break;
          case "gate": {
            const e = o.event;
            const col = { upcoming: C.g, live: C.r, covered: C.m, tba: "#9aa0b5" }[e.status];
            const pulse = 0.5 + 0.5 * Math.sin(state.t / 8 + o.idx);
            ctx.fillStyle = C.k; ctx.fillRect(x - 2, y - 52, o.w + 4, 52);
            ctx.fillStyle = col; ctx.fillRect(x, y - 50, o.w, 50);
            ctx.fillStyle = "#0d0f14"; ctx.fillRect(x + 6, y - 42, o.w - 12, 42);
            ctx.fillStyle = `rgba(123,77,255,${0.35 + pulse * 0.4})`;
            for (let r = 0; r < 4; r++) ctx.fillRect(x + 8 + r * 2, y - 40 + r * 4, o.w - 16 - r * 4, 40 - r * 4);
            text(e.tag.toUpperCase().slice(0, 12), x + o.w / 2, y - 76, col, 7, "center");
            const sub = e.status === "upcoming" ? countdownText(e.startDate) : e.status === "live" ? "LIVE NOW" : e.status === "covered" ? "COVERED" : "DATES TBA";
            if (!(e.status === "live" && Math.floor(state.t / 20) % 2)) text(sub, x + o.w / 2, y - 64, C.w, 5, "center");
            break;
          }
          case "tv":
            ctx.fillStyle = C.k; ctx.fillRect(x, y - 44, 56, 40);
            ctx.fillStyle = "#3a3f55"; ctx.fillRect(x + 2, y - 42, 52, 36);
            ctx.fillStyle = "#0d0f14"; ctx.fillRect(x + 6, y - 38, 36, 28);
            for (let yy = 0; yy < 28; yy += 2) { ctx.fillStyle = `rgba(51,224,184,${0.1 + ((yy + state.t) % 14) / 60})`; ctx.fillRect(x + 6, y - 38 + yy, 36, 1); }
            ctx.fillStyle = C.r; ctx.fillRect(x + 20, y - 28, 2, 8); ctx.fillRect(x + 22, y - 27, 2, 6); ctx.fillRect(x + 24, y - 26, 2, 4); ctx.fillRect(x + 26, y - 25, 2, 2);
            ctx.fillStyle = C.g; ctx.fillRect(x + 46, y - 36, 4, 4); ctx.fillRect(x + 46, y - 28, 4, 4);
            ctx.fillStyle = C.k; ctx.fillRect(x + 10, y - 4, 4, 4); ctx.fillRect(x + 42, y - 4, 4, 4);
            text(o.label, x + 28, y - 56, C.g, 6, "center");
            break;
          case "npc": {
            const i = o.dialog.split(":")[1] | 0;
            const bob = Math.round(Math.sin(state.t / 15 + i));
            ctx.fillStyle = C.k; ctx.fillRect(x - 3, y - 8, 26, 8);
            ctx.fillStyle = "#3a3f55"; ctx.fillRect(x - 2, y - 7, 24, 6);
            ctx.fillStyle = [C.g, C.r, C.m][i % 3]; ctx.fillRect(x - 2, y - 7, 24, 1);
            ctx.fillStyle = C.k; ctx.fillRect(x - 1, y - 33 + bob, 22, 26);
            ctx.drawImage(teamPix[i], x + 1, y - 31 + bob);
            text(o.person.name.split(" ")[0].toUpperCase(), x + 10, y - 46 + bob, C.w, 6, "center");
            break;
          }
          case "logos": {
            const per = Math.ceil(o.clients.length / 2);
            logoPix.forEach((c, i) => {
              const lx = x + (i % per) * 30, ly = y + Math.floor(i / per) * 24 + Math.round(Math.sin(state.t / 20 + i) * 1.5);
              ctx.fillStyle = C.k; ctx.fillRect(lx - 1, ly - 1, 24, 18);
              ctx.drawImage(c, lx, ly);
            });
            break;
          }
          case "trophy": {
            const b = Math.round(Math.sin(state.t / 12) * 2);
            ctx.fillStyle = "#3a3f55"; ctx.fillRect(x - 6, y - 10, 28, 10);
            ctx.fillStyle = C.k; ctx.fillRect(x - 7, y - 11, 30, 1);
            ctx.fillStyle = C.G; ctx.fillRect(x + 5, y - 18 + b, 6, 8);
            ctx.fillStyle = C.g; ctx.fillRect(x, y - 34 + b, 16, 14); ctx.fillRect(x + 2, y - 20 + b, 12, 2);
            ctx.fillRect(x - 4, y - 32 + b, 4, 2); ctx.fillRect(x - 4, y - 32 + b, 2, 8); ctx.fillRect(x + 16, y - 32 + b, 4, 2); ctx.fillRect(x + 18, y - 32 + b, 2, 8);
            ctx.fillStyle = "#fff2c4"; ctx.fillRect(x + 3, y - 32 + b, 2, 8);
            text("GOAL", x + 8, y - 48, C.g, 6, "center");
            break;
          }
        }
      });
    }

    function render() {
      const s = state;
      const camX = Math.round(s.camX), camY = Math.round(s.camY);
      ctx.clearRect(0, 0, vw, vh);
      drawBackground();
      drawTower();
      drawObjects();
      // Tiles
      const tx0 = Math.max(0, Math.floor(camX / T)), tx1 = Math.min(level.W - 1, Math.ceil((camX + vw) / T));
      const ty0 = Math.max(0, Math.floor(camY / T)), ty1 = Math.min(level.rows - 1, Math.ceil((camY + vh) / T));
      for (let ty = ty0; ty <= ty1; ty++)
        for (let tx = tx0; tx <= tx1; tx++) {
          const t = tileAt(tx, ty);
          if (!t) continue;
          const bump = s.bumps.find((b) => b.tx === tx && b.ty === ty);
          const by = bump ? -Math.round(Math.sin((bump.t / 10) * Math.PI) * 5) : 0;
          drawTile(t, tx * T - camX, ty * T - camY + by, tx, ty);
        }
      // Drop-hole arrows
      level.floors.forEach((f) => {
        if (!f.hole) return;
        const hx = (f.hole[0] + HOLE / 2) * T - camX, hy = f.slab * T - camY - 30 + (Math.floor(s.t / 15) % 2) * 3;
        if (hy > -20 && hy < vh) text("▼", hx, hy, C.g, 8, "center");
      });
      // Coins
      level.coins.forEach((c) => {
        if (c.got) return;
        const x = c.x - camX, y = c.y - camY;
        if (x < -10 || x > vw + 10 || y < -10 || y > vh + 10) return;
        const w = Math.max(1, Math.round(Math.abs(Math.cos(s.t / 10 + c.x)) * 8));
        ctx.drawImage(sprite(COIN), 0, 0, 8, 8, x + (8 - w) / 2, y + Math.round(Math.sin(s.t / 12 + c.x)), w, 8);
      });
      s.pops.forEach((c) => ctx.drawImage(sprite(COIN), c.x - camX, c.y - camY));
      // Enemies
      level.enemies.forEach((e) => {
        const x = Math.round(e.x - camX), y = Math.round(e.y - camY);
        if (x < -20 || x > vw + 20 || y < -20 || y > vh + 20) return;
        if (!e.alive) { if (e.squash > 0) ctx.drawImage(sprite(BUG[0]), 0, 0, 12, 9, x, y + 6, 12, 3); return; }
        ctx.drawImage(sprite(BUG[Math.floor(s.t / 10) % 2], e.vx > 0), x, y);
      });
      // Player
      const p = s.p;
      if (!(p.inv > 0 && Math.floor(s.t / 4) % 2)) {
        const legs = !p.onGround ? HERO_LEGS[2] : Math.abs(p.vx) > 0.2 ? HERO_LEGS[1 + (Math.floor(p.anim) % 2) * 2] : HERO_LEGS[0];
        ctx.drawImage(sprite(HERO_TOP.concat(legs), p.face < 0), Math.round(p.x - camX - 1), Math.round(p.y - camY));
      }
      s.particles.forEach((q) => { ctx.fillStyle = q.c; ctx.fillRect(Math.round(q.x - camX), Math.round(q.y - camY), 2, 2); });

      // HUD
      ctx.fillStyle = "rgba(13,15,20,.6)";
      ctx.fillRect(0, 0, vw, 22);
      const narrow = vw < 260;
      text(`XP ${String(s.xp).padStart(6, "0")}`, 6, 7, C.w, 8);
      ctx.drawImage(sprite(COIN), narrow ? 96 : 120, 7);
      text(`x${String(s.coins).padStart(2, "0")}`, narrow ? 106 : 130, 7, C.g, 8);
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = i < s.hearts ? 1 : 0.25;
        ctx.drawImage(sprite(HEART), (narrow ? 140 : 176) + i * 10, 8);
      }
      ctx.globalAlpha = 1;
      // Depth meter on the right edge (top to bottom, like the page scrollbar)
      const prog = Math.min(1, Math.max(0, (p.y + p.h) / worldH));
      ctx.fillStyle = "rgba(58,63,85,.8)"; ctx.fillRect(vw - 5, 26, 3, vh - 32);
      ctx.fillStyle = C.g; ctx.fillRect(vw - 5, 26, 3, Math.round((vh - 32) * prog));
      if (s.banner > 0 && s.bannerText) {
        ctx.globalAlpha = Math.min(1, s.banner / 20);
        ctx.fillStyle = "rgba(13,15,20,.78)";
        ctx.fillRect(0, 34, vw, 22);
        text(s.bannerText, vw / 2, 41, C.g, narrow ? 6 : 8, "center");
        ctx.globalAlpha = 1;
      }
    }

    // ---- Loop
    let raf = 0, last = performance.now(), acc = 0;
    followCamera(1);
    function frame(now) {
      raf = requestAnimationFrame(frame);
      acc += Math.min(100, now - last);
      last = now;
      while (acc >= STEP) {
        if (state.started && !state.paused) update();
        else state.t++;
        acc -= STEP;
      }
      render();
      const cd = !dlg.hidden && $(".g-count", dlg);
      if (cd) cd.textContent = countdownText(new Date(Number(cd.dataset.countTo)));
    }
    raf = requestAnimationFrame(frame);

    // ---- Input
    const keyMap = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "jump", KeyW: "jump", Space: "jump", KeyZ: "jump" };
    function beginPlay() {
      if (state.started) return;
      state.started = true;
      $(".g-start", root).hidden = true;
      state.banner = 110;
      state.bannerText = "STAGE 1 · THE HUB FOR GAMERS";
    }
    function onKeyDown(e) {
      if (!dlg.hidden) {
        if (["Escape", "Enter", "Space"].includes(e.code)) {
          e.preventDefault();
          if (dialogId === "win" && e.code !== "Escape") return;
          closeDialog();
        }
        return;
      }
      if (e.code === "Escape") return exit();
      if (!state.started) { e.preventDefault(); return beginPlay(); }
      if (e.code === "ArrowDown" || e.code === "KeyS" || e.code === "PageDown") { e.preventDefault(); state.intent = Math.min(600, state.intent + 160); return; }
      const k = keyMap[e.code];
      if (!k) return;
      e.preventDefault();
      if (k === "jump" && !state.keys.has("jump")) state.keys.add("jumpPressed");
      state.keys.add(k);
    }
    function onKeyUp(e) {
      const k = keyMap[e.code];
      if (k) state.keys.delete(k);
    }
    function onWheel(e) {
      if (!dlg.hidden) return;
      e.preventDefault();
      if (!state.started) beginPlay();
      state.intent = Math.max(-600, Math.min(600, state.intent + (e.deltaY || e.deltaX) * 1.4));
    }
    let touchY = null;
    function onTouchStart(e) {
      if (e.target.closest("button, a, .g-dialog")) return;
      if (!state.started) beginPlay();
      touchY = e.touches[0].clientY;
    }
    function onTouchMove(e) {
      if (touchY == null || e.target.closest(".g-dialog")) return;
      e.preventDefault();
      state.intent = Math.max(-600, Math.min(600, state.intent + (touchY - e.touches[0].clientY) * 2));
      touchY = e.touches[0].clientY;
    }
    const onTouchEnd = () => { touchY = null; };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    root.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    root.addEventListener("touchend", onTouchEnd);
    $(".g-start", root).addEventListener("click", beginPlay);

    root.querySelectorAll(".g-touch button").forEach((b) => {
      const k = b.dataset.k;
      const down = (e) => {
        e.preventDefault();
        if (!state.started) beginPlay();
        if (k === "jump") state.keys.add("jumpPressed");
        state.keys.add(k);
        b.classList.add("on");
      };
      const up = (e) => {
        e.preventDefault();
        state.keys.delete(k);
        b.classList.remove("on");
      };
      b.addEventListener("pointerdown", down);
      b.addEventListener("pointerup", up);
      b.addEventListener("pointerleave", up);
      b.addEventListener("pointercancel", up);
    });

    root.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (!act) return;
      if (act === "exit") exit();
      if (act === "close") closeDialog();
      if (act === "again") { exit(); start(); }
      if (act === "brief") { exit(); document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" }); }
      if (act === "sound") {
        soundOn = !soundOn;
        e.target.textContent = soundOn ? "♪ ON" : "♪ OFF";
        if (soundOn) sfx.coin();
      }
    });
    dlg.addEventListener("click", (e) => { if (e.target === dlg && dialogId !== "win") closeDialog(); });

    function exit() {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", resize);
      root.remove();
      document.documentElement.classList.remove("vg-game-on");
      window.dispatchEvent(new CustomEvent("vg-game", { detail: false }));
      G = null;
      document.querySelector("[data-game-launch]")?.focus();
    }

    // step(n): advance n fixed frames without rAF (used for automated playtests).
    const step = (n = 1) => {
      for (let i = 0; i < n; i++) if (state.started && !state.paused) update();
      render();
    };
    G = { exit, state, step, level };
  }

  window.VGGame = { start, get running() { return !!G; }, get state() { return G && G.state; }, get level() { return G && G.level; }, step: (n) => G && G.step(n) };
})();
