(() => {
  "use strict";

  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduceMotion = motionPreference.matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  let syncMotionMode = null;
  let setThemeMotionPaused = null;

  const handleMotionPreference = (event) => {
    reduceMotion = event.matches;
    if (syncMotionMode) syncMotionMode();
  };

  if (typeof motionPreference.addEventListener === "function") {
    motionPreference.addEventListener("change", handleMotionPreference);
  } else if (typeof motionPreference.addListener === "function") {
    motionPreference.addListener(handleMotionPreference);
  }

  const year = qs("#year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* Persistent page theme, initialized in <head> to avoid a first-paint flash. */
  const themeKey = "solivance-theme";
  const themeToggle = qs("#themeToggle");
  const themeColorMeta = qs('meta[name="theme-color"]');
  let themeTransitionTimer = 0;
  let activeThemeTransition = null;
  let requestedTheme = document.documentElement.dataset.theme === "light" ? "light" : "dark";

  function writeStoredTheme(theme) {
    try {
      window.localStorage.setItem(themeKey, theme);
    } catch {
      /* Storage can be unavailable under strict privacy settings. */
    }
  }

  function setTheme(theme, persist = false) {
    const next = theme === "dark" ? "dark" : "light";
    requestedTheme = next;
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    if (themeColorMeta) {
      themeColorMeta.setAttribute("content", next === "dark" ? "#0D0B08" : "#F6F2EB");
    }
    if (themeToggle) {
      const isDark = next === "dark";
      themeToggle.setAttribute("aria-checked", String(isDark));
      themeToggle.dataset.themeTooltip = isDark ? "Switch to light mode" : "Switch to dark mode";
      themeToggle.title = isDark ? "Switch to light mode" : "Switch to dark mode";
    }
    if (persist) writeStoredTheme(next);
  }

  function transitionTheme(theme, persist = false) {
    const next = theme === "dark" ? "dark" : "light";
    requestedTheme = next;
    if (persist) writeStoredTheme(next);
    const update = () => setTheme(next);

    if (!reduceMotion && typeof document.startViewTransition === "function") {
      if (activeThemeTransition && typeof activeThemeTransition.skipTransition === "function") {
        activeThemeTransition.skipTransition();
      }
      if (setThemeMotionPaused) setThemeMotionPaused(true);
      let transition;
      try {
        transition = document.startViewTransition(update);
      } catch {
        update();
        if (setThemeMotionPaused) setThemeMotionPaused(false);
        return;
      }
      activeThemeTransition = transition;
      transition.finished
        .catch(() => {})
        .finally(() => {
          if (activeThemeTransition === transition) {
            activeThemeTransition = null;
            if (setThemeMotionPaused) setThemeMotionPaused(false);
          }
        });
      return;
    }

    window.clearTimeout(themeTransitionTimer);
    document.documentElement.classList.add("theme-transitioning");
    requestAnimationFrame(() => {
      update();
      themeTransitionTimer = window.setTimeout(() => {
        document.documentElement.classList.remove("theme-transitioning");
      }, 320);
    });
  }

  setTheme(document.documentElement.dataset.theme);

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      transitionTheme(
        requestedTheme === "dark" ? "light" : "dark",
        true
      );
    });

    themeToggle.addEventListener("keydown", (event) => {
      if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      themeToggle.click();
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== themeKey) return;
    const stored = event.newValue === "light" || event.newValue === "dark"
      ? event.newValue
      : "dark";
    transitionTheme(stored);
  });

  /* Navigation and page progress */
  const siteNav = qs("#siteNav");
  const progress = qs("#scrollProgress");
  const horizon = qs(".horizon-section");
  const horizonFill = qs("#horizonFill");
  let scrollFrame = 0;
  let horizonActive = !("IntersectionObserver" in window);
  let navScrolled = null;
  let readHeroParallax = null;
  let applyHeroParallax = null;

  function updateScrollState() {
    scrollFrame = 0;
    const y = window.scrollY;
    const distance = document.documentElement.scrollHeight - window.innerHeight;
    const progressValue = distance > 0 ? clamp(y / distance, 0, 1) : 0;
    let horizonValue = null;

    if (horizonActive && horizon && horizonFill) {
      const rect = horizon.getBoundingClientRect();
      const start = window.innerHeight * 0.72;
      const travel = rect.height + window.innerHeight * 0.25;
      horizonValue = clamp((start - rect.top) / travel, 0, 1);
    }
    const heroParallaxValue = readHeroParallax ? readHeroParallax() : null;

    const isScrolled = y > 24;
    if (siteNav && navScrolled !== isScrolled) {
      siteNav.classList.toggle("is-scrolled", isScrolled);
      navScrolled = isScrolled;
    }

    if (progress) progress.style.transform = `scaleX(${progressValue.toFixed(4)})`;
    if (horizonValue !== null) horizonFill.style.transform = `scaleY(${horizonValue.toFixed(4)})`;
    if (heroParallaxValue !== null && applyHeroParallax) {
      applyHeroParallax(heroParallaxValue);
    }
  }

  function queueScrollUpdate() {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(updateScrollState);
  }

  window.addEventListener("scroll", queueScrollUpdate, { passive: true });
  window.addEventListener("resize", queueScrollUpdate, { passive: true });
  window.addEventListener("load", queueScrollUpdate, { once: true });

  if ("IntersectionObserver" in window && horizon && horizonFill) {
    const horizonObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        horizonActive = entry.isIntersecting;
        if (entry.isIntersecting) {
          queueScrollUpdate();
        } else {
          const completed = entry.boundingClientRect.bottom < 0;
          horizonFill.style.transform = `scaleY(${completed ? 1 : 0})`;
        }
      });
    }, { rootMargin: "70% 0px", threshold: 0 });
    horizonObserver.observe(horizon);
  }

  updateScrollState();

  /* Mobile navigation */
  const menuToggle = qs("#menuToggle");
  const navLinks = qs("#navLinks");
  const mainContent = qs("main");
  const siteFooter = qs(".site-footer");

  function setMenu(open) {
    if (!menuToggle || !navLinks) return;
    navLinks.classList.toggle("is-open", open);
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("menu-open", open);
    [mainContent, siteFooter].forEach((region) => {
      if (!region) return;
      if (open) region.setAttribute("inert", "");
      else region.removeAttribute("inert");
    });

    if (open) {
      requestAnimationFrame(() => {
        if (menuToggle.getAttribute("aria-expanded") !== "true") return;
        const firstLink = qs("a[href]", navLinks);
        if (firstLink) firstLink.focus();
      });
    }
  }

  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
      setMenu(menuToggle.getAttribute("aria-expanded") !== "true");
    });

    qsa('a[href^="#"]', siteNav || navLinks).forEach((link) => {
      link.addEventListener("click", () => setMenu(false));
    });

    window.addEventListener("keydown", (event) => {
      const menuOpen = menuToggle.getAttribute("aria-expanded") === "true";
      if (event.key === "Escape" && menuOpen) {
        setMenu(false);
        menuToggle.focus();
        return;
      }

      if (event.key === "Tab" && menuOpen && siteNav) {
        const focusable = qsa('a[href], button:not([disabled])', siteNav)
          .filter((element) => element.getAttribute("aria-hidden") !== "true");
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 860) setMenu(false);
    }, { passive: true });
  }

  /* Current-section navigation state */
  if ("IntersectionObserver" in window && navLinks) {
    const navAnchors = qsa("a", navLinks);
    const sectionLinks = new Map(
      qsa('a[href^="#"]', navLinks)
        .map((link) => [link.getAttribute("href").slice(1), link])
        .filter(([id]) => id)
    );
    const sectionStates = new Map();

    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        sectionStates.set(entry.target.id, {
          intersecting: entry.isIntersecting,
          top: entry.boundingClientRect.top,
        });
      });

      const active = [...sectionStates.entries()]
        .filter(([, state]) => state.intersecting)
        .sort((a, b) => Math.abs(a[1].top - window.innerHeight * 0.35)
          - Math.abs(b[1].top - window.innerHeight * 0.35))[0];
      if (!active) return;

      const activeLink = sectionLinks.get(active[0]);
      navAnchors.forEach((link) => {
        const isActive = link === activeLink;
        link.classList.toggle("is-active", isActive);
        if (isActive) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
    }, { rootMargin: "-35% 0px -58% 0px", threshold: 0 });

    qsa("section[id]").forEach((section) => sectionObserver.observe(section));
  }

  /* Scroll reveals are an enhancement: content stays visible if this code fails. */
  if (!reduceMotion && "IntersectionObserver" in window) {
    const revealItems = qsa("[data-reveal]");
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });

    const visibleItems = [];
    const observedItems = [];
    revealItems.forEach((item) => {
      const rect = item.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.96) visibleItems.push(item);
      else observedItems.push(item);
    });
    visibleItems.forEach((item) => item.classList.add("is-visible"));
    observedItems.forEach((item) => revealObserver.observe(item));

    requestAnimationFrame(() => {
      document.documentElement.classList.add("reveal-ready");
    });
  }

  /* Pause repeating decorative motion while its visual field is offscreen. */
  if ("IntersectionObserver" in window) {
    const motionScopes = qsa(".hero-stage, .system-section, .field-art");
    const motionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-motion-active", entry.isIntersecting);
      });
    }, { rootMargin: "18% 0px", threshold: 0 });

    motionScopes.forEach((scope) => {
      scope.classList.add("motion-scope");
      motionObserver.observe(scope);
    });
  }

  /* Subtle perspective response on application cards */
  if (finePointer) {
    qsa("[data-tilt]").forEach((card) => {
      let tiltFrame = 0;
      let cardBounds = null;
      let pointerX = 0;
      let pointerY = 0;

      const updateTilt = () => {
        tiltFrame = 0;
        if (reduceMotion) return;
        if (!cardBounds) cardBounds = card.getBoundingClientRect();
        const x = clamp((pointerX - cardBounds.left) / cardBounds.width, 0, 1);
        const y = clamp((pointerY - cardBounds.top) / cardBounds.height, 0, 1);
        card.style.setProperty("--tilt-x", `${((0.5 - y) * 1.2).toFixed(2)}deg`);
        card.style.setProperty("--tilt-y", `${((x - 0.5) * 1.2).toFixed(2)}deg`);
        card.style.setProperty("--pointer-x", `${(x * 100).toFixed(1)}%`);
        card.style.setProperty("--pointer-y", `${(y * 100).toFixed(1)}%`);
      };

      card.addEventListener("pointerenter", () => {
        cardBounds = card.getBoundingClientRect();
      }, { passive: true });

      card.addEventListener("pointermove", (event) => {
        if (reduceMotion) return;
        pointerX = event.clientX;
        pointerY = event.clientY;
        if (!tiltFrame) tiltFrame = requestAnimationFrame(updateTilt);
      }, { passive: true });

      card.addEventListener("pointerleave", () => {
        if (tiltFrame) cancelAnimationFrame(tiltFrame);
        tiltFrame = 0;
        cardBounds = null;
        card.style.setProperty("--tilt-x", "0deg");
        card.style.setProperty("--tilt-y", "0deg");
        card.style.setProperty("--pointer-x", "50%");
        card.style.setProperty("--pointer-y", "50%");
      }, { passive: true });
    });
  }

  /* Replayable rigid-to-adaptive comparison */
  const comparison = qs("[data-comparison]");
  const comparisonReplay = qs(".positioning-shift", comparison || document);
  let comparisonReplayFrame = 0;

  function replayComparison() {
    if (!comparison) return;
    if (comparisonReplayFrame) cancelAnimationFrame(comparisonReplayFrame);
    comparison.classList.remove("is-replaying");
    comparisonReplayFrame = requestAnimationFrame(() => {
      comparisonReplayFrame = requestAnimationFrame(() => {
        comparisonReplayFrame = 0;
        comparison.classList.add("is-replaying");
      });
    });
  }

  if (comparison && comparisonReplay) {
    comparisonReplay.addEventListener("click", replayComparison);

    if ("IntersectionObserver" in window && !reduceMotion) {
      const comparisonObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          replayComparison();
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.42 });
      comparisonObserver.observe(comparison);
    }
  }

  /* One connected intelligence loop: autoplay once, then leave control with the visitor. */
  const loopConsole = qs("[data-loop-console]");
  const loopSteps = loopConsole ? qsa("[data-loop-target]", loopConsole) : [];

  if (loopConsole && loopSteps.length) {
    const loopCopy = {
      sense: {
        status: "Signals captured in context",
        input: "Rhythm · workload · place",
        output: "Timestamped evidence",
      },
      understand: {
        status: "A revisable hypothesis forms",
        input: "Evidence from this moment",
        output: "Focus capacity at risk",
      },
      adapt: {
        status: "One reversible change applied",
        input: "Focus capacity at risk",
        output: "42 minutes protected",
      },
    };
    const loopStatus = qs("[data-loop-status]", loopConsole);
    const loopInput = qs("[data-loop-input]", loopConsole);
    const loopOutput = qs("[data-loop-output]", loopConsole);
    let activeLoopStep = 0;
    let loopAutoRunning = false;
    let loopAutoFinished = reduceMotion;
    let loopTimers = [];
    let loopReplayFrame = 0;

    function clearLoopTimers() {
      loopTimers.forEach((timer) => window.clearTimeout(timer));
      loopTimers = [];
      loopAutoRunning = false;
    }

    function setLoopStep(index, replay = false) {
      activeLoopStep = (index + loopSteps.length) % loopSteps.length;
      const step = loopSteps[activeLoopStep].dataset.loopTarget;
      const copy = loopCopy[step];
      if (loopReplayFrame) {
        cancelAnimationFrame(loopReplayFrame);
        loopReplayFrame = 0;
      }
      if (replay && loopConsole.dataset.activeStep === step) {
        loopConsole.dataset.activeStep = "";
        loopReplayFrame = requestAnimationFrame(() => {
          loopReplayFrame = requestAnimationFrame(() => {
            loopReplayFrame = 0;
            if (loopSteps[activeLoopStep].dataset.loopTarget === step) {
              loopConsole.dataset.activeStep = step;
            }
          });
        });
      } else {
        loopConsole.dataset.activeStep = step;
      }
      loopSteps.forEach((button, buttonIndex) => {
        const active = buttonIndex === activeLoopStep;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      if (loopStatus) loopStatus.textContent = copy.status;
      if (loopInput) loopInput.textContent = copy.input;
      if (loopOutput) loopOutput.textContent = copy.output;
    }

    function playLoopOnce() {
      if (loopAutoFinished || loopAutoRunning || reduceMotion) return;
      clearLoopTimers();
      loopAutoRunning = true;
      setLoopStep(0, true);
      loopTimers.push(window.setTimeout(() => setLoopStep(1, true), 2600));
      loopTimers.push(window.setTimeout(() => {
        setLoopStep(2, true);
        loopAutoRunning = false;
        loopAutoFinished = true;
        loopTimers = [];
      }, 5700));
    }

    loopSteps.forEach((button, index) => {
      button.addEventListener("click", () => {
        clearLoopTimers();
        loopAutoFinished = true;
        setLoopStep(index, true);
      });
      button.addEventListener("focus", () => {
        clearLoopTimers();
        loopAutoFinished = true;
        setLoopStep(index);
      });
    });

    loopConsole.addEventListener("pointerenter", () => {
      if (!loopAutoRunning) return;
      clearLoopTimers();
      loopAutoFinished = true;
    });

    if ("IntersectionObserver" in window) {
      const loopObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            playLoopOnce();
          } else if (loopAutoRunning) {
            clearLoopTimers();
          }
        });
      }, { threshold: 0.34 });
      loopObserver.observe(loopConsole);
    }

    setLoopStep(0);
  }

  /* Product demonstrations share one explicit, accessible state controller. */
  const demoConfigs = [
    {
      root: qs("[data-cog-demo]"),
      standardLabel: "Explore concept",
      adaptedLabel: "Reset concept",
      standardStatus: "Concept scenario: two flexible meetings fragment the window.",
      adaptedStatus: "Concept response: two meetings moved. Nothing was canceled.",
    },
    {
      root: qs("[data-care-demo]"),
      standardLabel: "Explore concept",
      adaptedLabel: "Reset concept",
      standardStatus: "Concept scenario: four workflows restart the patient's context.",
      adaptedStatus: "Concept response: relevant context carried forward across handoffs.",
    },
  ].filter((config) => config.root);

  function setDemoState(config, adapted) {
    const button = qs("[data-demo-toggle]", config.root);
    const status = qs("[data-demo-status]", config.root);
    config.root.dataset.mode = adapted ? "adapted" : "standard";
    if (button) {
      button.setAttribute("aria-pressed", String(adapted));
      button.textContent = adapted ? config.adaptedLabel : config.standardLabel;
    }
    if (status) status.textContent = adapted ? config.adaptedStatus : config.standardStatus;
    if (config.afterSet) config.afterSet(config.root, adapted);
  }

  demoConfigs.forEach((config) => {
    const button = qs("[data-demo-toggle]", config.root);
    setDemoState(config, false);
    if (!button) return;
    button.addEventListener("click", () => {
      config.root.dataset.userControlled = "true";
      setDemoState(config, config.root.dataset.mode !== "adapted");
    });
  });

  if (!reduceMotion && "IntersectionObserver" in window) {
    const demoObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const config = demoConfigs.find((item) => item.root === entry.target);
        observer.unobserve(entry.target);
        if (!config || entry.target.dataset.userControlled === "true") return;
        window.setTimeout(() => {
          if (entry.target.dataset.userControlled !== "true") setDemoState(config, true);
        }, 650);
      });
    }, { threshold: 0.48 });

    demoConfigs
      .filter((config) => config.autoPreview)
      .forEach((config) => demoObserver.observe(config.root));
  }

  /* Immediate, duplicate-safe feedback for the contact form handoff. */
  const contactForm = qs(".contact-form");
  if (contactForm) {
    const submitButton = qs('button[type="submit"]', contactForm);
    const submitLabel = qs(".button-label", submitButton || contactForm);
    const defaultSubmitLabel = submitLabel ? submitLabel.textContent : "";

    const resetSubmitState = () => {
      delete contactForm.dataset.submitting;
      contactForm.removeAttribute("aria-busy");
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.removeAttribute("aria-label");
      }
      if (submitLabel) submitLabel.textContent = defaultSubmitLabel;
    };

    contactForm.addEventListener("submit", (event) => {
      if (contactForm.dataset.submitting === "true") {
        event.preventDefault();
        return;
      }
      if (!contactForm.checkValidity()) return;
      contactForm.dataset.submitting = "true";
      contactForm.setAttribute("aria-busy", "true");
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.setAttribute("aria-label", "Sending message");
      }
      if (submitLabel) submitLabel.textContent = "Sending...";
    });

    window.addEventListener("pageshow", resetSubmitState);
  }

  /* Hero behavioral field */
  const stage = qs("#heroStage");
  const canvas = qs("#adaptiveField");

  if (stage && canvas) {
    const context = canvas.getContext("2d");
    const portrait = qs(".stage-portrait", stage);

    if (context) {
      const paper = "246,242,235";
      const red = "210,56,43";
      const state = {
        width: 0,
        height: 0,
        dpr: 1,
        nodes: [],
        pointerX: 0.5,
        pointerY: 0.5,
        targetX: 0.5,
        targetY: 0.5,
        time: Math.random() * 20,
        raf: 0,
        lastFrame: 0,
        visible: true,
        running: false,
      };

      const random = (min, max) => min + Math.random() * (max - min);

      function createNodes() {
        const total = clamp(Math.floor((state.width * state.height) / 24000), 16, 30);
        state.nodes = Array.from({ length: total }, (_, index) => ({
          angle: random(0, Math.PI * 2),
          radius: random(0.15, 0.49),
          squash: random(0.58, 1.05),
          speed: random(0.035, 0.12) * (Math.random() > 0.5 ? 1 : -1),
          phase: random(0, Math.PI * 2),
          size: random(0.8, 2.2),
          alpha: random(0.18, 0.55),
          accent: index % 9 === 0,
          x: 0,
          y: 0,
        }));
      }

      function resizeCanvas() {
        const rect = stage.getBoundingClientRect();
        const nextWidth = Math.max(1, rect.width);
        const nextHeight = Math.max(1, rect.height);
        const dprCap = finePointer ? 1.5 : 1.25;
        const pixelBudget = finePointer ? 1100000 : 650000;
        const budgetDpr = Math.sqrt(pixelBudget / (nextWidth * nextHeight));
        const nextDpr = Math.max(1, Math.min(window.devicePixelRatio || 1, dprCap, budgetDpr));
        const pixelWidth = Math.round(nextWidth * nextDpr);
        const pixelHeight = Math.round(nextHeight * nextDpr);

        if (
          Math.abs(state.width - nextWidth) < 0.5
          && Math.abs(state.height - nextHeight) < 0.5
          && canvas.width === pixelWidth
          && canvas.height === pixelHeight
        ) return;

        state.width = nextWidth;
        state.height = nextHeight;
        state.dpr = nextDpr;
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
        createNodes();
        drawField(0);
      }

      function drawEllipse(cx, cy, rx, ry, rotation, alpha) {
        context.save();
        context.translate(cx, cy);
        context.rotate(rotation);
        context.beginPath();
        context.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        context.strokeStyle = `rgba(${paper},${alpha})`;
        context.lineWidth = 0.75;
        context.stroke();
        context.restore();
      }

      function drawField(deltaMs = 0) {
        const width = state.width;
        const height = state.height;
        if (!width || !height) return;

        const frameRatio = deltaMs > 0 ? deltaMs / (1000 / 60) : 0;
        const pointerEase = 1 - Math.pow(0.965, frameRatio);
        state.pointerX += (state.targetX - state.pointerX) * pointerEase;
        state.pointerY += (state.targetY - state.pointerY) * pointerEase;
        if (deltaMs > 0) state.time += deltaMs * 0.00036;

        const cx = width * (0.5 + (state.pointerX - 0.5) * 0.055);
        const cy = height * (0.5 + (state.pointerY - 0.5) * 0.055);
        const unit = Math.min(width, height);

        context.clearRect(0, 0, width, height);

        context.save();
        context.globalCompositeOperation = "lighter";
        const glow = context.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.35);
        glow.addColorStop(0, "rgba(210,56,43,0.13)");
        glow.addColorStop(0.34, "rgba(210,56,43,0.035)");
        glow.addColorStop(1, "rgba(210,56,43,0)");
        context.fillStyle = glow;
        context.fillRect(0, 0, width, height);
        context.restore();

        for (let ring = 1; ring <= 7; ring += 1) {
          const radius = unit * (0.075 + ring * 0.06);
          const wobble = Math.sin(state.time * 1.7 + ring * 0.8) * unit * 0.005;
          drawEllipse(
            cx,
            cy,
            radius + wobble,
            radius * (0.72 + ring * 0.018),
            Math.sin(state.time + ring) * 0.04,
            0.035 + (7 - ring) * 0.008
          );
        }

        state.nodes.forEach((node, index) => {
          const angle = node.angle + state.time * node.speed * 9;
          const pulse = 1 + Math.sin(state.time * 2.3 + node.phase) * 0.06;
          const radius = unit * node.radius * pulse;
          node.x = cx + Math.cos(angle) * radius;
          node.y = cy + Math.sin(angle) * radius * node.squash;

          const dx = node.x - cx;
          const dy = node.y - cy;
          const distance = Math.hypot(dx, dy);
          const lineAlpha = clamp(0.14 - distance / (unit * 4.3), 0.018, 0.11);

          context.beginPath();
          context.moveTo(cx, cy);
          context.lineTo(node.x, node.y);
          context.strokeStyle = node.accent
            ? `rgba(${red},${lineAlpha * 1.8})`
            : `rgba(${paper},${lineAlpha})`;
          context.lineWidth = 0.55;
          context.stroke();

          if (index > 0) {
            const previous = state.nodes[index - 1];
            const between = Math.hypot(node.x - previous.x, node.y - previous.y);
            if (between < unit * 0.2) {
              context.beginPath();
              context.moveTo(previous.x, previous.y);
              context.lineTo(node.x, node.y);
              context.strokeStyle = `rgba(${paper},${clamp(0.08 - between / (unit * 5), 0.01, 0.06)})`;
              context.stroke();
            }
          }

          context.beginPath();
          context.arc(node.x, node.y, node.accent ? node.size * 1.7 : node.size, 0, Math.PI * 2);
          context.fillStyle = node.accent
            ? `rgba(${red},${node.alpha + 0.18})`
            : `rgba(${paper},${node.alpha})`;
          context.fill();
        });
      }

      function animateField(timestamp) {
        if (!state.running) return;
        const delta = state.lastFrame
          ? clamp(timestamp - state.lastFrame, 0, 40)
          : (1000 / 60);
        state.lastFrame = timestamp;
        drawField(delta);
        if (state.running) state.raf = requestAnimationFrame(animateField);
      }

      function startField() {
        if (reduceMotion || state.running || !state.visible || document.hidden) return;
        state.running = true;
        state.lastFrame = 0;
        state.raf = requestAnimationFrame(animateField);
      }

      function stopField() {
        state.running = false;
        cancelAnimationFrame(state.raf);
        state.raf = 0;
        state.lastFrame = 0;
      }

      if (finePointer) {
        let pointerFrame = 0;
        let pointerClientX = 0;
        let pointerClientY = 0;

        const updatePointer = () => {
          pointerFrame = 0;
          if (reduceMotion) return;
          const rect = stage.getBoundingClientRect();
          state.targetX = clamp((pointerClientX - rect.left) / rect.width, 0, 1);
          state.targetY = clamp((pointerClientY - rect.top) / rect.height, 0, 1);
          stage.style.setProperty("--pointer-x", `${state.targetX * 100}%`);
          stage.style.setProperty("--pointer-y", `${state.targetY * 100}%`);
          if (portrait) {
            portrait.style.setProperty("--image-x", `${((state.targetX - 0.5) * -12).toFixed(2)}px`);
            portrait.style.setProperty("--image-y", `${((state.targetY - 0.5) * -9).toFixed(2)}px`);
          }
        };

        stage.addEventListener("pointermove", (event) => {
          if (reduceMotion) return;
          pointerClientX = event.clientX;
          pointerClientY = event.clientY;
          if (!pointerFrame) pointerFrame = requestAnimationFrame(updatePointer);
        }, { passive: true });

        stage.addEventListener("pointerleave", () => {
          if (pointerFrame) cancelAnimationFrame(pointerFrame);
          pointerFrame = 0;
          state.targetX = 0.5;
          state.targetY = 0.5;
          stage.style.setProperty("--pointer-x", "50%");
          stage.style.setProperty("--pointer-y", "50%");
          if (portrait) {
            portrait.style.setProperty("--image-x", "0px");
            portrait.style.setProperty("--image-y", "0px");
          }
        }, { passive: true });
      }

      readHeroParallax = () => {
        if (!state.visible || !portrait) return null;
        const rect = stage.getBoundingClientRect();
        const centerOffset = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
        return `${clamp(centerOffset * -18, -14, 14).toFixed(2)}px`;
      };
      applyHeroParallax = (value) => {
        portrait.style.setProperty("--stage-scroll", value);
      };

      let canvasResizeFrame = 0;
      const queueCanvasResize = () => {
        if (canvasResizeFrame) return;
        canvasResizeFrame = requestAnimationFrame(() => {
          canvasResizeFrame = 0;
          resizeCanvas();
          queueScrollUpdate();
        });
      };

      if ("ResizeObserver" in window) {
        const resizeObserver = new ResizeObserver(queueCanvasResize);
        resizeObserver.observe(stage);
      } else {
        window.addEventListener("resize", queueCanvasResize, { passive: true });
      }

      if ("IntersectionObserver" in window) {
        const stageObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            state.visible = entry.isIntersecting;
            if (entry.isIntersecting) {
              queueScrollUpdate();
              startField();
            } else {
              stopField();
            }
          });
        }, { threshold: 0.02 });
        stageObserver.observe(stage);
      }

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) stopField();
        else startField();
      });

      syncMotionMode = () => {
        if (reduceMotion) {
          stopField();
          state.pointerX = 0.5;
          state.pointerY = 0.5;
          state.targetX = 0.5;
          state.targetY = 0.5;
          stage.style.setProperty("--pointer-x", "50%");
          stage.style.setProperty("--pointer-y", "50%");
          if (portrait) {
            portrait.style.setProperty("--image-x", "0px");
            portrait.style.setProperty("--image-y", "0px");
          }
          drawField(0);
        } else {
          startField();
        }
      };
      setThemeMotionPaused = (paused) => {
        if (paused) stopField();
        else startField();
      };

      resizeCanvas();
      queueScrollUpdate();
      if (!reduceMotion) startField();
    }
  }
})();
