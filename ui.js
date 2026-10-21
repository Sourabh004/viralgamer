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
