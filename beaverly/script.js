(() => {
  "use strict";

  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const desktopNav = window.matchMedia("(min-width: 901px)");

  const header = document.querySelector("[data-header]");
  const menu = document.querySelector("[data-menu]");
  const menuToggle = document.querySelector("[data-menu-toggle]");
  const menuLinks = [...document.querySelectorAll("[data-menu-link]")];
  const productStage = document.querySelector("[data-product-stage]");
  const phoneWrap = document.querySelector("[data-phone-wrap]");
  const tiltCard = document.querySelector("[data-tilt-card]");
  const revealItems = [...document.querySelectorAll(".reveal")];
  const faqItems = [...document.querySelectorAll(".faq-item")];
  const year = document.querySelector("[data-year]");

  let revealObserver = null;
  let productCleanup = () => {};
  let tiltCleanup = () => {};
  let menuOpen = false;
  let lastFocused = null;

  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  const setHeaderState = () => {
    if (header) {
      header.classList.toggle("is-scrolled", window.scrollY > 20);
    }
  };

  let headerFrame = 0;
  const requestHeaderState = () => {
    if (headerFrame) return;
    headerFrame = window.requestAnimationFrame(() => {
      headerFrame = 0;
      setHeaderState();
    });
  };

  setHeaderState();
  window.addEventListener("scroll", requestHeaderState, { passive: true });

  const setMenuState = (open, restoreFocus = false) => {
    if (!menu || !menuToggle) return;

    menuOpen = open && !desktopNav.matches;
    menu.classList.toggle("is-open", menuOpen);
    menuToggle.setAttribute("aria-expanded", String(menuOpen));
    menuToggle.setAttribute("aria-label", menuOpen ? "Close navigation" : "Open navigation");

    if (desktopNav.matches) {
      menu.removeAttribute("aria-hidden");
      menu.inert = false;
    } else {
      menu.setAttribute("aria-hidden", String(!menuOpen));
      menu.inert = !menuOpen;
    }

    if (menuOpen) {
      lastFocused = document.activeElement;
    } else if (restoreFocus && lastFocused instanceof HTMLElement) {
      lastFocused.focus();
    }
  };

  menuToggle?.addEventListener("click", () => {
    setMenuState(!menuOpen, menuOpen);
  });

  menuLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (menuOpen) setMenuState(false, true);
    });
  });

  document.addEventListener("pointerdown", (event) => {
    if (!menuOpen || !header) return;
    if (!header.contains(event.target)) {
      setMenuState(false, true);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!menuOpen || !menuToggle || !menu) return;

    if (event.key === "Escape") {
      event.preventDefault();
      setMenuState(false, true);
    }
  });

  const syncNavigation = () => setMenuState(false, false);
  desktopNav.addEventListener("change", syncNavigation);
  syncNavigation();

  const setupReveals = () => {
    revealObserver?.disconnect();
    revealObserver = null;

    if (reduceMotion.matches || !("IntersectionObserver" in window)) {
      revealItems.forEach((item) => item.classList.add("is-visible"));
      root.classList.add("motion-ready");
      return;
    }

    revealItems.forEach((item) => {
      if (item.getBoundingClientRect().top < window.innerHeight * 0.94) {
        item.classList.add("is-visible");
      }
    });

    root.classList.add("motion-ready");

    revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -8% 0px",
      }
    );

    revealItems.forEach((item) => {
      if (!item.classList.contains("is-visible")) {
        revealObserver.observe(item);
      }
    });
  };

  const setupProductMotion = () => {
    productCleanup();
    productCleanup = () => {};

    if (!productStage || !phoneWrap || reduceMotion.matches || !finePointer.matches) {
      productStage?.style.removeProperty("--stage-x");
      productStage?.style.removeProperty("--stage-y");
      phoneWrap?.style.removeProperty("--phone-rx");
      phoneWrap?.style.removeProperty("--phone-ry");
      return;
    }

    let bounds = null;
    let latestEvent = null;
    let frame = 0;

    const render = () => {
      frame = 0;
      if (!bounds || !latestEvent) return;

      const x = Math.max(-1, Math.min(1, (latestEvent.clientX - bounds.left) / bounds.width * 2 - 1));
      const y = Math.max(-1, Math.min(1, (latestEvent.clientY - bounds.top) / bounds.height * 2 - 1));

      productStage.style.setProperty("--stage-x", `${(x * 7).toFixed(2)}px`);
      productStage.style.setProperty("--stage-y", `${(y * 4).toFixed(2)}px`);
      phoneWrap.style.setProperty("--phone-rx", `${(-y * 1.15).toFixed(2)}deg`);
      phoneWrap.style.setProperty("--phone-ry", `${(x * 1.15).toFixed(2)}deg`);
    };

    const onEnter = () => {
      bounds = productStage.getBoundingClientRect();
    };

    const onMove = (event) => {
      latestEvent = event;
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    const onLeave = () => {
      bounds = null;
      latestEvent = null;
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      productStage.style.setProperty("--stage-x", "0px");
      productStage.style.setProperty("--stage-y", "0px");
      phoneWrap.style.setProperty("--phone-rx", "0deg");
      phoneWrap.style.setProperty("--phone-ry", "0deg");
    };

    productStage.addEventListener("pointerenter", onEnter);
    productStage.addEventListener("pointermove", onMove, { passive: true });
    productStage.addEventListener("pointerleave", onLeave);

    productCleanup = () => {
      if (frame) window.cancelAnimationFrame(frame);
      productStage.removeEventListener("pointerenter", onEnter);
      productStage.removeEventListener("pointermove", onMove);
      productStage.removeEventListener("pointerleave", onLeave);
      onLeave();
    };
  };

  const setupTiltMotion = () => {
    tiltCleanup();
    tiltCleanup = () => {};

    if (!tiltCard || reduceMotion.matches || !finePointer.matches) {
      tiltCard?.style.removeProperty("--tilt-x");
      tiltCard?.style.removeProperty("--tilt-y");
      return;
    }

    let bounds = null;
    let latestEvent = null;
    let frame = 0;

    const render = () => {
      frame = 0;
      if (!bounds || !latestEvent) return;

      const x = Math.max(-1, Math.min(1, (latestEvent.clientX - bounds.left) / bounds.width * 2 - 1));
      const y = Math.max(-1, Math.min(1, (latestEvent.clientY - bounds.top) / bounds.height * 2 - 1));
      tiltCard.style.setProperty("--tilt-x", `${(-y * 1.1).toFixed(2)}deg`);
      tiltCard.style.setProperty("--tilt-y", `${(x * 1.1).toFixed(2)}deg`);
    };

    const onEnter = () => {
      bounds = tiltCard.getBoundingClientRect();
    };

    const onMove = (event) => {
      latestEvent = event;
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    const onLeave = () => {
      bounds = null;
      latestEvent = null;
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      tiltCard.style.setProperty("--tilt-x", "0deg");
      tiltCard.style.setProperty("--tilt-y", "0deg");
    };

    tiltCard.addEventListener("pointerenter", onEnter);
    tiltCard.addEventListener("pointermove", onMove, { passive: true });
    tiltCard.addEventListener("pointerleave", onLeave);

    tiltCleanup = () => {
      if (frame) window.cancelAnimationFrame(frame);
      tiltCard.removeEventListener("pointerenter", onEnter);
      tiltCard.removeEventListener("pointermove", onMove);
      tiltCard.removeEventListener("pointerleave", onLeave);
      onLeave();
    };
  };

  const setupMotion = () => {
    setupProductMotion();
    setupTiltMotion();
  };

  reduceMotion.addEventListener("change", () => {
    setupReveals();
    setupMotion();
  });

  finePointer.addEventListener("change", setupMotion);

  faqItems.forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) return;
      faqItems.forEach((otherItem) => {
        if (otherItem !== item) otherItem.open = false;
      });
    });
  });

  setupReveals();
  setupMotion();
})();
