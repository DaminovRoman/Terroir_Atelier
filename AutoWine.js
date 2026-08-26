(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  /* ------------------------------------------------------------
     0. PRELOADER — wine pours into the glass as the page loads
     ------------------------------------------------------------ */

  function initPreloader() {
    var preloader = document.getElementById('preloader');
    if (!preloader) {
      document.documentElement.classList.remove('is-loading');
      document.body.classList.remove('is-loading');
      return;
    }

    var fill = preloader.querySelector('.preloader-glass__fill');
    var counter = preloader.querySelector('[data-preloader-count]');
    var FILL_EMPTY = 233;  // translateY when 0% — liquid surface below the bowl's lowest point
    var FILL_FULL = 12;    // translateY when 100% — liquid surface near the rim (not overfilled)

    var progress = 0;
    var target = 0;
    var rafId = null;
    var settled = false;   // true once real load (or the safety net) says resources are done
    var finished = false;  // true once finish() has actually run — guards against double-firing

    function paint() {
      progress += (target - progress) * 0.09;
      if (Math.abs(target - progress) < 0.15) progress = target;

      var y = FILL_EMPTY - (progress / 100) * (FILL_EMPTY - FILL_FULL);
      if (fill) fill.style.transform = 'translateY(' + y.toFixed(2) + 'px)';
      if (counter) counter.textContent = Math.round(progress);

      if (progress < target) {
        rafId = requestAnimationFrame(paint);
      } else {
        rafId = null;
        if (settled && progress >= 99.5) finish();
      }
    }

    function nudge(value) {
      target = Math.min(Math.max(value, target), 96);
      if (!rafId) rafId = requestAnimationFrame(paint);
    }

    function finish(immediate) {
      if (finished) return;
      finished = true;
      target = 100;
      if (immediate) {
        // Jump straight to full instead of easing progress up frame by frame,
        // so an impatient click clears pointer-events right away rather than
        // waiting out the gentle catch-up animation.
        progress = 100;
        if (fill) fill.style.transform = 'translateY(' + FILL_FULL.toFixed(2) + 'px)';
        if (counter) counter.textContent = 100;
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      } else if (!rafId) {
        rafId = requestAnimationFrame(paint);
      }
      setTimeout(function () {
        preloader.classList.add('is-done');
        document.documentElement.classList.remove('is-loading');
        document.body.classList.remove('is-loading');
        setTimeout(function () {
          if (preloader.parentNode) preloader.parentNode.removeChild(preloader);
        }, immediate ? 350 : 1150);
      }, immediate ? 0 : 260);
    }

    if (prefersReducedMotion) {
      preloader.classList.add('is-done');
      document.documentElement.classList.remove('is-loading');
      document.body.classList.remove('is-loading');
      if (preloader.parentNode) preloader.parentNode.removeChild(preloader);
      return;
    }

    // Simulated progress so the pour feels alive even on instant loads,
    // but real network/resource timing still governs when it can finish.
    var simTimer = setInterval(function () {
      nudge(target + (2 + Math.random() * 6));
    }, 220);

    window.addEventListener('load', function () {
      clearInterval(simTimer);
      settled = true;
      target = 100;
      if (!rafId) rafId = requestAnimationFrame(paint);
    });

    // Safety net: never trap the user behind the preloader.
    setTimeout(function () {
      clearInterval(simTimer);
      settled = true;
      finish();
    }, 6000);

    // Impatience escape hatch: if the visitor clicks, taps, or presses a key
    // while the preloader is still up, skip straight to finishing — instantly,
    // not via the normal eased fill — so a click never leaves them tapping a
    // page that looks unresponsive. Guards on `finished`, not `settled`:
    // resources can already be marked settled (window 'load' fired) while
    // the gentle fill animation is still easing toward 100, so a click during
    // that window must still be able to force the instant finish.
    function skip() {
      clearInterval(simTimer);
      if (!finished) {
        preloader.classList.add('is-skipped');
        finish(true);
      }
    }
    preloader.addEventListener('click', skip);
    window.addEventListener('keydown', skip, { once: true });
  }

  /* ------------------------------------------------------------
     1. LUXURY REVEAL + EDITORIAL TEXT REVEAL (IntersectionObserver)
     ------------------------------------------------------------ */

  function prepareTextReveal() {
    var nodes = document.querySelectorAll('[data-text-reveal]');
    nodes.forEach(function (node) {
      var lines = node.querySelectorAll(':scope > span');
      lines.forEach(function (line, i) {
        var wrap = document.createElement('span');
        wrap.className = 'line-wrap';
        var inner = document.createElement('span');
        inner.innerHTML = line.innerHTML;
        wrap.appendChild(inner);
        wrap.style.transitionDelay = (i * 90) + 'ms';
        line.innerHTML = '';
        line.appendChild(wrap);
      });
    });
  }

  function initRevealObserver() {
    if (prefersReducedMotion) {
      document.querySelectorAll('[data-reveal], .line-wrap').forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }

    var revealTargets = document.querySelectorAll('[data-reveal]');
    var textTargets = document.querySelectorAll('.line-wrap');

    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var delay = entry.target.dataset.revealDelay || 0;
          setTimeout(function () {
            entry.target.classList.add('is-visible');
          }, Number(delay));
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

    revealTargets.forEach(function (el, i) {
      el.dataset.revealDelay = Math.min(i % 4, 3) * 90;
      revealObserver.observe(el);
    });

    var textObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          textObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });

    textTargets.forEach(function (el) { textObserver.observe(el); });
  }

  /* ------------------------------------------------------------
     2. HERO TITLE INITIAL REVEAL (loads on entry, not scroll)
     ------------------------------------------------------------ */

  function initHeroReveal() {
    var heroTitle = document.querySelector('.hero-title');
    if (!heroTitle) return;
    var spans = heroTitle.querySelectorAll(':scope > span');
    spans.forEach(function (span, i) {
      var inner = document.createElement('span');
      inner.innerHTML = span.innerHTML;
      inner.classList.add('split-line');
      inner.style.transitionDelay = (150 + i * 140) + 'ms';
      span.innerHTML = '';
      span.appendChild(inner);
    });

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        spans.forEach(function (span) {
          var inner = span.querySelector('.split-line');
          if (inner) inner.style.transform = 'translateY(0)';
        });
      });
    });

    if (prefersReducedMotion) {
      spans.forEach(function (span) {
        var inner = span.querySelector('.split-line');
        if (inner) inner.style.transform = 'none';
      });
    }
  }

  /* ------------------------------------------------------------
     3. IMAGE / GRADIENT PARALLAX (rAF driven)
     ------------------------------------------------------------ */

  function initParallax() {
    if (prefersReducedMotion) return;
    var targets = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
    if (!targets.length) return;

    var ticking = false;

    function update() {
      var vh = window.innerHeight;
      targets.forEach(function (el) {
        var strength = Number(el.dataset.parallax) || 5;
        var rect = el.getBoundingClientRect();
        var progress = (rect.top + rect.height / 2 - vh / 2) / vh;
        var offset = progress * strength * 4;
        el.style.transform = 'translate3d(0,' + offset.toFixed(2) + 'px,0)';
      });
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    update();
  }

  function initHeroFieldParallax() {
    if (prefersReducedMotion) return;
    var base = document.querySelector('.hero-gradient--base');
    var bottle = document.querySelector('.hero-bottle');
    if (!base) return;
    var ticking = false;

    function update() {
      var y = window.scrollY;
      var vh = window.innerHeight;
      var progress = Math.min(y / vh, 1);
      base.style.transform = 'translate3d(0,' + (progress * 30).toFixed(1) + 'px,0)';
      if (bottle) bottle.style.transform = 'translate3d(0,' + (progress * -18).toFixed(1) + 'px,0)';
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
  }

  /* ------------------------------------------------------------
     4. MAGNETIC BUTTONS
     ------------------------------------------------------------ */

  function initMagnetic() {
    if (prefersReducedMotion || isTouch) return;
    var buttons = document.querySelectorAll('[data-magnetic]');

    buttons.forEach(function (btn) {
      var raf = null;
      var targetX = 0, targetY = 0, curX = 0, curY = 0;

      function loop() {
        curX += (targetX - curX) * 0.18;
        curY += (targetY - curY) * 0.18;
        btn.style.transform = 'translate3d(' + curX.toFixed(2) + 'px,' + curY.toFixed(2) + 'px,0)';
        if (Math.abs(targetX - curX) > 0.1 || Math.abs(targetY - curY) > 0.1) {
          raf = requestAnimationFrame(loop);
        } else {
          raf = null;
        }
      }

      btn.addEventListener('mousemove', function (e) {
        var rect = btn.getBoundingClientRect();
        var relX = e.clientX - rect.left - rect.width / 2;
        var relY = e.clientY - rect.top - rect.height / 2;
        var max = 9;
        targetX = Math.max(Math.min(relX * 0.35, max), -max);
        targetY = Math.max(Math.min(relY * 0.35, max), -max);
        if (!raf) raf = requestAnimationFrame(loop);
      });

      btn.addEventListener('mouseleave', function () {
        targetX = 0; targetY = 0;
        if (!raf) raf = requestAnimationFrame(loop);
      });
    });
  }

  /* ------------------------------------------------------------
     5. CURSOR INTERACTION (desktop only)
     ------------------------------------------------------------ */

  function initCursor() {
    if (isTouch) return;
    var dot = document.querySelector('.cursor-dot');
    var ring = document.querySelector('.cursor-ring');
    if (!dot || !ring) return;

    var mouseX = 0, mouseY = 0, ringX = 0, ringY = 0;
    var active = false;

    window.addEventListener('mousemove', function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.transform = 'translate(' + mouseX + 'px,' + mouseY + 'px) translate(-50%,-50%)';
      if (!active) {
        document.body.classList.add('cursor-active');
        active = true;
      }
    }, { passive: true });

    function ringLoop() {
      ringX += (mouseX - ringX) * 0.16;
      ringY += (mouseY - ringY) * 0.16;
      ring.style.transform = 'translate(' + ringX + 'px,' + ringY + 'px) translate(-50%,-50%)';
      requestAnimationFrame(ringLoop);
    }
    requestAnimationFrame(ringLoop);

    var hoverables = document.querySelectorAll('a, button, [data-magnetic], input');
    hoverables.forEach(function (el) {
      el.addEventListener('mouseenter', function () { ring.classList.add('is-hover'); });
      el.addEventListener('mouseleave', function () { ring.classList.remove('is-hover'); });
    });

    document.addEventListener('mousedown', function () {
      ring.classList.add('is-clicking');
    });
    document.addEventListener('mouseup', function () {
      ring.classList.remove('is-clicking');
    });

    document.addEventListener('mouseleave', function () {
      document.body.classList.remove('cursor-active');
      active = false;
    });
  }

  /* ------------------------------------------------------------
     6. HEADER STATE (scrolled / on-dark section)
     ------------------------------------------------------------ */

  function initHeader() {
    var header = document.querySelector('.site-header');
    if (!header) return;
    var darkSections = document.querySelectorAll('.hero, .wine-art, .tasting, .final-cta');
    var ticking = false;

    function update() {
      header.classList.toggle('is-scrolled', window.scrollY > 40);

      var headerBottom = header.getBoundingClientRect().bottom;
      var onDark = false;
      darkSections.forEach(function (section) {
        var rect = section.getBoundingClientRect();
        if (rect.top <= headerBottom && rect.bottom >= headerBottom) onDark = true;
      });
      header.classList.toggle('is-on-dark', onDark);
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });

    update();
  }

  /* ------------------------------------------------------------
     7A. SCROLL PROGRESS BAR
     ------------------------------------------------------------ */

  function initScrollProgress() {
    var bar = document.querySelector('.scroll-progress__bar');
    if (!bar) return;
    var ticking = false;

    function update() {
      var doc = document.documentElement;
      var scrollTop = window.scrollY;
      var height = doc.scrollHeight - doc.clientHeight;
      var progress = height > 0 ? (scrollTop / height) * 100 : 0;
      bar.style.width = progress.toFixed(2) + '%';
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });

    update();
  }

  /* ------------------------------------------------------------
     7B. NUMBER / STAT COUNT-UP (on scroll into view)
     ------------------------------------------------------------ */

  function initCountUp() {
    var stats = document.querySelectorAll('.terroir-stat dd, .tasting-fact dd');
    if (!stats.length) return;

    if (prefersReducedMotion) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var text = el.textContent;
        var match = text.match(/\d+/);

        if (match) {
          var numStr = match[0];
          var num = parseInt(numStr, 10);
          var prefix = text.slice(0, match.index);
          var suffix = text.slice(match.index + numStr.length);
          var duration = 900;
          var startTime = null;

          function step(ts) {
            if (!startTime) startTime = ts;
            var elapsed = ts - startTime;
            var progress = Math.min(elapsed / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            var current = Math.round(num * eased);
            el.textContent = prefix + current + suffix;
            if (progress < 1) {
              requestAnimationFrame(step);
            } else {
              el.textContent = text;
            }
          }
          el.classList.add('is-counting');
          requestAnimationFrame(step);
        }

        observer.unobserve(el);
      });
    }, { threshold: 0.6 });

    stats.forEach(function (el) { observer.observe(el); });
  }

  /* ------------------------------------------------------------
     7C. TILT HOVER FOR CARDS (desktop only, subtle 3D)
     ------------------------------------------------------------ */

  function initTilt() {
    if (prefersReducedMotion || isTouch) return;
    var cards = document.querySelectorAll('.curated-tile, .journal-card__gradient, .makers-gradient');

    cards.forEach(function (card) {
      var raf = null;
      var targetRX = 0, targetRY = 0, curRX = 0, curRY = 0;

      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');

      function loop() {
        curRX += (targetRX - curRX) * 0.15;
        curRY += (targetRY - curRY) * 0.15;
        card.style.setProperty('--tilt-x', curRX.toFixed(2) + 'deg');
        card.style.setProperty('--tilt-y', curRY.toFixed(2) + 'deg');
        if (Math.abs(targetRX - curRX) > 0.05 || Math.abs(targetRY - curRY) > 0.05) {
          raf = requestAnimationFrame(loop);
        } else {
          raf = null;
        }
      }

      card.addEventListener('mousemove', function (e) {
        var rect = card.getBoundingClientRect();
        var relX = (e.clientX - rect.left) / rect.width - 0.5;
        var relY = (e.clientY - rect.top) / rect.height - 0.5;
        var max = 4;
        targetRY = relX * max * 2;
        targetRX = relY * -max * 2;
        if (!raf) raf = requestAnimationFrame(loop);
      });

      card.addEventListener('mouseleave', function () {
        targetRX = 0; targetRY = 0;
        if (!raf) raf = requestAnimationFrame(loop);
      });
    });
  }

  /* ------------------------------------------------------------
     7. MOBILE MENU
     ------------------------------------------------------------ */

  function initMobileMenu() {
    var toggle = document.querySelector('.menu-toggle');
    var menu = document.querySelector('.mobile-menu');
    if (!toggle || !menu) return;

    function close() {
      toggle.setAttribute('aria-expanded', 'false');
      menu.dataset.state = 'closed';
      document.body.style.overflow = '';
    }

    toggle.addEventListener('click', function () {
      var isOpen = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!isOpen));
      menu.dataset.state = isOpen ? 'closed' : 'open';
      document.body.style.overflow = isOpen ? '' : 'hidden';
    });

    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', close);
    });

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
  }

  /* ------------------------------------------------------------
     8. CONCIERGE FORM (demo submit, no backend)
     ------------------------------------------------------------ */

  function initConciergeForm() {
    var form = document.querySelector('.concierge-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var original = btn.textContent;
      btn.textContent = 'Заявка отправлена';
      btn.disabled = true;
      btn.classList.add('is-success');
      setTimeout(function () {
        btn.textContent = original;
        btn.disabled = false;
        btn.classList.remove('is-success');
        form.reset();
      }, 2600);
    });
  }

  /* ------------------------------------------------------------
     9. ATELIER PANELS — tap a panel to set it as the section photo
     ------------------------------------------------------------ */

  function initAtelierPanels() {
    var panels = document.querySelectorAll('.glass-panel[data-panel-image]');
    var bgPhoto = document.getElementById('atelierBgPhoto');
    var gradient = document.getElementById('atelierGradient');
    if (!panels.length || !bgPhoto || !gradient) return;

    panels.forEach(function (panel) {
      panel.addEventListener('click', function () {
        if (panel.classList.contains('is-active')) return;

        panels.forEach(function (p) { p.classList.remove('is-active'); });
        panel.classList.add('is-active');
        bgPhoto.style.backgroundImage = 'url(' + panel.dataset.panelImage + ')';
        bgPhoto.classList.add('is-active');
        gradient.classList.add('is-dimmed');
      });
    });
  }

  /* ------------------------------------------------------------
     INIT
     ------------------------------------------------------------ */

  initPreloader();

  document.addEventListener('DOMContentLoaded', function () {
    prepareTextReveal();
    initHeroReveal();
    initRevealObserver();
    initParallax();
    initHeroFieldParallax();
    initMagnetic();
    initCursor();
    initHeader();
    initScrollProgress();
    initCountUp();
    initTilt();
    initMobileMenu();
    initConciergeForm();
    initAtelierPanels();
  });
})();
