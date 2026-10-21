(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById("year").textContent = new Date().getFullYear();

  // Blur the 3D background while the page is scrolling, and keep it softly
  // blurred once you're past the hero so section text stays easy to read.
  const sceneStyle = document.getElementById("scene").style;
  let scrollTimer;
  const setSceneBlur = (moving) => {
    const pastHero = window.scrollY > window.innerHeight * 0.5;
    const blur = moving ? 10 : pastHero ? 6 : 0;
    sceneStyle.setProperty("--scene-blur", `${blur}px`);
    sceneStyle.setProperty("--scene-sat", moving || pastHero ? "0.85" : "1");
    sceneStyle.setProperty("--scene-opacity", moving ? "0.7" : pastHero ? "0.8" : "1");
  };
  window.addEventListener(
    "scroll",
    () => {
      setSceneBlur(true);
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => setSceneBlur(false), 180);
    },
    { passive: true }
  );
  setSceneBlur(false);

  // Reel rows (Interviews, Promotions): one card per entry in the section's
  // data file, played through Instagram's official embed. The embed script
  // loads once, only when a reel row comes near the viewport.
  let embedScript = false;
  const loadEmbeds = () => {
    if (window.instgrm) return window.instgrm.Embeds.process();
    if (embedScript) return; // still loading; it processes every embed on load
    embedScript = true;
    const s = document.createElement("script");
    s.src = "https://www.instagram.com/embed.js";
    s.async = true;
    document.body.appendChild(s);
  };

  const setupReels = (sectionId, list) => {
    const section = document.getElementById(sectionId);
    const reels = (list || []).filter((r) => r && r.url);
    const reelsEl = section.querySelector(".reels");
    const reelsWrap = section.querySelector(".reels-wrap");
    if (!reels.length) {
      reelsWrap.hidden = true;
      section.querySelector(".reels-empty").hidden = false;
      section.querySelector(".reels-more").hidden = true;
      return;
    }
    reels.forEach((r) => {
      const url = r.url.split("?")[0].replace(/\/?$/, "/");
      const card = document.createElement("article");
      card.className = "reel-card";
      const head = document.createElement("header");
      if (r.guest) {
        const h = document.createElement("h3");
        h.textContent = r.guest;
        head.appendChild(h);
      }
      if (r.title) {
        const p = document.createElement("p");
        p.textContent = r.title;
        head.appendChild(p);
      }
      const embed = document.createElement("blockquote");
      embed.className = "instagram-media";
      embed.dataset.instgrmPermalink = url + "?utm_source=ig_embed";
      embed.dataset.instgrmVersion = "14";
      const fallback = document.createElement("a");
      fallback.href = url;
      fallback.target = "_blank";
      fallback.rel = "noopener";
      fallback.className = "reel-fallback";
      fallback.textContent = "▶ Play on Instagram";
      embed.appendChild(fallback);
      if (head.childNodes.length) card.appendChild(head);
      card.appendChild(embed);
      reelsEl.appendChild(card);
    });

    const rio = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          loadEmbeds();
          rio.disconnect();
        }
      },
      { rootMargin: "600px 0px" }
    );
    rio.observe(reelsEl);

    const step = () => (reelsEl.firstElementChild?.offsetWidth || 340) + 20;
    reelsWrap.querySelector(".prev").addEventListener("click", () => reelsEl.scrollBy({ left: -step(), behavior: "smooth" }));
    reelsWrap.querySelector(".next").addEventListener("click", () => reelsEl.scrollBy({ left: step(), behavior: "smooth" }));
    const syncNav = () => {
      const max = reelsEl.scrollWidth - reelsEl.clientWidth;
      reelsWrap.classList.toggle("at-start", reelsEl.scrollLeft <= 4);
      reelsWrap.classList.toggle("at-end", reelsEl.scrollLeft >= max - 4);
    };
    reelsEl.addEventListener("scroll", syncNav, { passive: true });
    window.addEventListener("resize", syncNav);
    syncNav();
  };
  setupReels("interviews", window.VG_INTERVIEWS);
  setupReels("promotions", window.VG_PROMOTIONS);

  // Team player cards from team.js. OVR is the average of the three stats.
  const teamGrid = document.getElementById("team-grid");
  const el = (tag, className, text) => {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  };
  (window.VG_TEAM || []).forEach((p, i) => {
    const stats = p.stats || [];
    const ovr = stats.length ? Math.round(stats.reduce((s, [, v]) => s + v, 0) / stats.length) : null;
    const card = el("article", `member tilt reveal c-${p.color || "gold"}`);

    const photo = el("div", "photo");
    const img = el("img");
    img.src = `assets/team/${p.photo}`;
    img.alt = p.name;
    img.loading = "lazy";
    img.width = 480;
    img.height = 600;
    photo.appendChild(img);

    const top = el("div", "card-top");
    if (ovr != null) {
      const rating = el("div", "ovr");
      rating.append(el("strong", null, ovr), el("span", null, "OVR"));
      top.appendChild(rating);
    }
    top.appendChild(el("span", "player-no", `#${String(i + 1).padStart(2, "0")}`));

    const info = el("div", "member-info");
    if (p.class) info.appendChild(el("span", "player-class", p.class));
    info.append(el("h3", null, p.name), el("p", "player-role", p.role));
    if (stats.length) {
      const list = el("ul", "player-stats");
      stats.forEach(([label, value]) => {
        const li = el("li");
        const bar = el("span", "bar");
        const fill = el("i");
        fill.style.setProperty("--v", `${value}%`);
        bar.appendChild(fill);
        li.append(el("span", "stat-label", label), bar, el("b", null, value));
        list.appendChild(li);
      });
      info.appendChild(list);
    }

    card.append(el("span", "foil"), photo, top, info, el("span", "card-frame"));
    teamGrid.appendChild(card);
  });

  // Reach: platform cards from reach.js.
  const ICONS = {
    instagram: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    discord: '<svg viewBox="0 0 24 24"><path d="M7 7c3-1.3 7-1.3 10 0l1.5 9c-1.6 1.3-3.3 2-5 2l-1-1.6M7 7L5.5 16c1.6 1.3 3.3 2 5 2l1-1.6"/><circle cx="9.5" cy="12" r="1.2" fill="currentColor"/><circle cx="14.5" cy="12" r="1.2" fill="currentColor"/></svg>',
    youtube: '<svg viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="4"/><path d="M10 9l5 3-5 3z" fill="currentColor"/></svg>',
    page: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.6.8 2.6 2.5 3 5.2"/></svg>',
  };
  const reach = window.VG_REACH || {};
  const platformsEl = document.getElementById("platforms");
  [...(reach.platforms || []), ...(reach.pages || [])].forEach((p) => {
    const a = el("a", `platform reveal ${ICONS[p.key] ? p.key : "page"}`);
    a.href = p.url || "#";
    if (p.url) {
      a.target = "_blank";
      a.rel = "noopener";
    }
    const head = el("div", "platform-head");
    head.innerHTML = ICONS[p.key] || ICONS.page; // static markup from the map above
    head.append(el("b", null, p.name), el("small", null, p.handle || ""));
    a.append(head, el("strong", null, p.count), el("span", null, p.label || ""));
    platformsEl.appendChild(a);
  });
  if (reach.updated) document.getElementById("reach-note").textContent = `Platform numbers as of ${reach.updated}.`;

  // Events: status from dates (Upcoming / Live now / Covered) and a countdown
  // to the next upcoming event.
  const day = (s) => (s ? new Date(`${s}T00:00:00+05:30`) : null);
  const fmtDate = (d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  const now = new Date();
  const events = (window.VG_EVENTS || []).map((e) => {
    const start = day(e.start);
    const end = e.end ? new Date(day(e.end).getTime() + 86400000 - 1) : start && new Date(start.getTime() + 86400000 - 1);
    const status = !start ? null : now < start ? "upcoming" : now <= end ? "live" : "covered";
    return { ...e, startDate: start, endDate: end, status };
  });
  // One shared ticker drives every countdown on the page.
  const countdowns = [];
  const tickCountdowns = () => {
    const t = new Date();
    countdowns.forEach(({ target, parts }) => {
      const s = Math.max(0, Math.floor((target - t) / 1000));
      [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60].forEach(
        (v, i) => parts[i] && (parts[i].textContent = String(v).padStart(2, "0"))
      );
    });
  };
  const makeCountdown = (target, units, className) => {
    const cd = el("div", className);
    const parts = units.map((u) => {
      const d = el("div");
      const b = el("b", null, "00");
      d.append(b, el("span", null, u));
      cd.appendChild(d);
      return b;
    });
    countdowns.push({ target, parts });
    return cd;
  };

  // Line-art landmarks drawn for this site (simple original silhouettes).
  const LANDMARKS = {
    mumbai: // a Gateway-style arch monument by the sea
      '<path d="M10 94h180"/><path d="M44 94V46h112v48"/><path d="M84 94V66q16-22 32 0v28"/><path d="M54 94V74q6-8 12 0v20M134 94V74q6-8 12 0v20"/><path d="M40 46h120M44 40h112"/><path d="M44 40V26h12v14M144 40V26h12v14M78 40V30h10v10M112 40V30h10v10"/><path d="M44 26q6-10 12 0M144 26q6-10 12 0M78 30q5-8 10 0M112 30q5-8 10 0M92 40q8-14 16 0"/><path d="M0 99q8-3 16 0t16 0t16 0t16 0t16 0t16 0t16 0t16 0t16 0t16 0t16 0t16 0t16 0"/>',
    bengaluru: // a long domed legislature-style building
      '<path d="M6 94h188"/><path d="M14 94V62h172v32"/><path d="M14 62h172"/><path d="M30 66v24M44 66v24M58 66v24M72 66v24M128 66v24M142 66v24M156 66v24M170 66v24"/><path d="M80 94V54h40v40"/><path d="M76 54l24-10 24 10"/><path d="M88 44V34h24v10"/><path d="M86 34q14-26 28 0"/><path d="M100 12V6"/><path d="M70 94h60M74 90h52"/><path d="M24 62q6-10 12 0M164 62q6-10 12 0"/>',
    arena: // generic esports arena with a stage screen and light rigs
      '<path d="M10 94h180"/><path d="M20 94q80-40 160 0"/><path d="M38 94q62-28 124 0"/><rect x="78" y="52" width="44" height="26" rx="2"/><path d="M92 65l6 4-6 4zM104 62h10M104 68h10M104 74h6"/><path d="M24 94V36M176 94V36"/><path d="M16 36h16M168 36h16"/><path d="M24 38l44 34M176 38l-44 34" stroke-dasharray="3 4"/>',
  };
  const landmark = (city) => {
    const art = el("div", "event-art");
    art.setAttribute("aria-hidden", "true");
    art.innerHTML = `<svg viewBox="0 0 200 100" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${LANDMARKS[city] || LANDMARKS.arena}</svg>`;
    return art;
  };
  const eventLogo = (e) => {
    if (!e.logo) return null;
    const img = el("img", "event-logo");
    img.src = `assets/clients/${e.logo}`;
    img.alt = "";
    img.loading = "lazy";
    return img;
  };

  // Feature the soonest upcoming event (countdown); fall back to one that's live.
  // The featured event gets the big box and is left out of the card grid.
  const byStart = (a, b) => a.startDate - b.startDate;
  const next = events.filter((e) => e.status === "upcoming").sort(byStart)[0] || events.filter((e) => e.status === "live").sort(byStart)[0];

  const eventsGrid = document.getElementById("events-grid");
  const dateRange = (e) =>
    !e.startDate ? null : e.end && e.end !== e.start ? `${fmtDate(e.startDate).replace(/ \d{4}$/, "")} – ${fmtDate(e.endDate)}` : fmtDate(e.startDate);

  // Card: illustration header (landmark + logo) · title · footer (status, date, countdown).
  events.filter((e) => e !== next).forEach((e) => {
    const card = el("article", `event reveal ${e.status || "tba"}`);
    const media = el("div", "event-media");
    media.appendChild(landmark(e.city));
    const logo = eventLogo(e);
    if (logo) media.appendChild(logo);

    const body = el("div", "event-body");
    body.appendChild(el("h3", null, e.tag));
    if (e.name) body.appendChild(el("p", null, e.name));

    const foot = el("div", "event-foot");
    const row = el("div", "event-row");
    const label = { upcoming: "Upcoming", live: "Live now", covered: "Covered" }[e.status] || "Dates TBA";
    row.appendChild(el("span", `chip ${e.status || ""}`, label));
    if (e.startDate) row.appendChild(el("span", "event-date", dateRange(e)));
    foot.appendChild(row);
    if (e.status === "upcoming") foot.appendChild(makeCountdown(e.startDate, ["d", "h", "m", "s"], "mini-countdown"));
    if (e.venue) foot.appendChild(el("span", "event-venue", e.venue));
    if (e.note) foot.appendChild(el("small", "event-note", e.note));

    card.append(media, body, foot);
    eventsGrid.appendChild(card);
  });
  if (next) {
    const box = document.getElementById("next-event");
    box.appendChild(landmark(next.city));
    const info = el("div", "next-info");
    const head = el("div", "next-head");
    const logo = eventLogo(next);
    if (logo) head.appendChild(logo);
    head.appendChild(el("span", "next-label", next.status === "live" ? "● Live now" : "Next up"));
    info.append(
      head,
      el("h3", null, next.tag),
      el("p", null, next.name || ""),
      el("p", "next-meta", [dateRange(next), next.venue].filter(Boolean).join("  ·  "))
    );
    box.appendChild(info);
    if (next.status === "upcoming") box.appendChild(makeCountdown(next.startDate, ["Days", "Hrs", "Min", "Sec"], "countdown"));
    box.hidden = false;
  }
  if (countdowns.length) {
    tickCountdowns();
    setInterval(tickCountdowns, 1000);
  }

  // Case studies from cases.js.
  const casesGrid = document.getElementById("cases-grid");
  (window.VG_CASES || []).forEach((c) => {
    const card = el("article", "case panel reveal");
    const main = el("div");
    const client = el("div", "case-client");
    if (c.logo) {
      const img = el("img");
      img.src = `assets/clients/${c.logo}`;
      img.alt = c.client;
      client.appendChild(img);
    }
    client.appendChild(el("span", null, c.client));
    main.append(client, el("h3", null, c.title));
    if (c.summary) main.appendChild(el("p", "case-summary", c.summary));
    if (c.services && c.services.length) {
      const tags = el("div", "case-tags");
      c.services.forEach((s) => tags.appendChild(el("span", "chip", s)));
      main.appendChild(tags);
    }
    const side = el("div", "case-side");
    if (c.results && c.results.length) {
      const res = el("div", "case-results");
      c.results.forEach(([v, l]) => {
        const d = el("div");
        d.append(el("b", null, v), el("span", null, l));
        res.appendChild(d);
      });
      side.appendChild(res);
    }
    if (c.quote) {
      const q = el("blockquote", "case-quote");
      q.appendChild(el("p", null, `“${c.quote}”`));
      if (c.quoteBy) q.appendChild(el("cite", null, `— ${c.quoteBy}`));
      side.appendChild(q);
    }
    if (c.link) {
      const a = el("a", "case-link", "See the work →");
      a.href = c.link;
      a.target = "_blank";
      a.rel = "noopener";
      side.appendChild(a);
    }
    card.append(main, side);
    casesGrid.appendChild(card);
  });

  // Brand brief form. Sends to data-endpoint (e.g. Formspree) when set,
  // otherwise opens a pre-filled email to data-email, otherwise copies the
  // brief and opens Instagram DMs.
  const form = document.getElementById("brief");
  const status = document.getElementById("brief-status");
  const setStatus = (msg, kind) => {
    status.textContent = msg;
    status.className = `brief-status ${kind || ""}`;
  };
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    let ok = true;
    form.querySelectorAll("[required]").forEach((input) => {
      const valid = input.value.trim() && (input.type !== "email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim()));
      input.closest(".field").classList.toggle("invalid", !valid);
      if (!valid) ok = false;
    });
    if (!ok) return setStatus("Please fill in your name, a valid email and a short message.", "err");

    const data = new FormData(form);
    const needs = data.getAll("needs").join(", ") || "Not specified";
    const brief = [
      `Name: ${data.get("name")}`,
      `Email: ${data.get("email")}`,
      `Brand: ${data.get("company") || "-"}`,
      `Budget: ${data.get("budget") || "Prefer not to say"}`,
      `Needs: ${needs}`,
      "",
      data.get("message"),
    ].join("\n");
    const { endpoint, email } = form.dataset;
    const button = form.querySelector("button[type=submit]");

    if (endpoint) {
      button.disabled = true;
      setStatus("Sending…");
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ name: data.get("name"), email: data.get("email"), company: data.get("company"), budget: data.get("budget"), needs, message: data.get("message") }),
        });
        if (!res.ok) throw new Error(res.status);
        form.reset();
        setStatus("Brief sent! We'll get back to you soon.", "ok");
      } catch {
        setStatus("Couldn't send right now. Please message us on Instagram or Discord.", "err");
      } finally {
        button.disabled = false;
      }
      return;
    }
    if (email) {
      const subject = `Campaign brief from ${data.get("company") || data.get("name")}`;
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(brief)}`;
      setStatus("Your mail app should open with the brief ready to send.", "ok");
      return;
    }
    try {
      await navigator.clipboard.writeText(brief);
      setStatus("Brief copied! Paste it in our Instagram DM, which is opening now.", "ok");
    } catch {
      setStatus("Opening Instagram — please paste your brief in a DM to @viral.gamer.", "ok");
    }
    window.open("https://ig.me/m/viral.gamer", "_blank", "noopener");
  });
  form.addEventListener("input", (ev) => ev.target.closest(".field")?.classList.remove("invalid"));

  // Game Mode: load the pixel font, game.css and game.js on first use.
  let gameLoad = null;
  const loadAsset = (tag, attrs) =>
    new Promise((resolve, reject) => {
      const n = document.createElement(tag);
      Object.assign(n, attrs);
      n.onload = resolve;
      n.onerror = reject;
      document.head.appendChild(n);
    });
  const launchGame = async () => {
    if (window.VGGame?.running) return;
    document.documentElement.classList.add("game-loading");
    try {
      gameLoad =
        gameLoad ||
        Promise.all([
          loadAsset("link", { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" }),
          loadAsset("link", { rel: "stylesheet", href: "game.css" }),
          loadAsset("script", { src: "game.js" }),
        ]).then(() => document.fonts.load('10px "Press Start 2P"').catch(() => {}));
      await gameLoad;
      window.VGGame.start();
    } catch {
      gameLoad = null;
      alert("Game mode couldn't load. Please check your connection and try again.");
    } finally {
      document.documentElement.classList.remove("game-loading");
    }
  };
  document.querySelectorAll("[data-game-launch]").forEach((b) => b.addEventListener("click", launchGame));

  // Scroll reveal
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  document.querySelectorAll(".reveal").forEach((el, i) => {
    el.style.transitionDelay = `${(i % 4) * 80}ms`;
    io.observe(el);
  });

  // Stat counters
  const counters = document.querySelectorAll("[data-count]");
  const runCounter = (el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const suffix = el.dataset.suffix || "";
    if (reduceMotion) {
      el.textContent = target.toFixed(decimals) + suffix;
      return;
    }
    const start = performance.now();
    const dur = 1600;
    const step = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const cio = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        runCounter(e.target);
        cio.unobserve(e.target);
      }
    });
  });
  counters.forEach((c) => cio.observe(c));

  // 3D tilt + spotlight on cards (pointer devices only)
  if (!reduceMotion && window.matchMedia("(hover: hover)").matches) {
    document.querySelectorAll(".tilt").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.style.transform = `rotateX(${(0.5 - y) * 14}deg) rotateY(${(x - 0.5) * 14}deg) translateZ(10px)`;
        el.style.setProperty("--mx", `${x * 100}%`);
        el.style.setProperty("--my", `${y * 100}%`);
      });
      el.addEventListener("pointerleave", () => {
        el.style.transform = "";
      });
    });
  }
})();
