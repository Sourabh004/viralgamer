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

  // Interview reels: one card per entry in interviews.js, played through
  // Instagram's official embed. The embed script loads only when the section
  // comes near the viewport so it doesn't slow the first paint.
  const reels = (window.VG_INTERVIEWS || []).filter((r) => r && r.url);
  const reelsEl = document.getElementById("reels");
  const reelsWrap = reelsEl.parentElement;
  if (!reels.length) {
    reelsWrap.hidden = true;
    document.getElementById("reels-empty").hidden = false;
    document.querySelector(".reels-more").hidden = true;
  } else {
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

    const loadEmbeds = () => {
      if (window.instgrm) return window.instgrm.Embeds.process();
      const s = document.createElement("script");
      s.src = "https://www.instagram.com/embed.js";
      s.async = true;
      document.body.appendChild(s);
    };
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
  }

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
