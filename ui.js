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
