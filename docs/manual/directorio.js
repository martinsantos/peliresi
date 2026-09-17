// ── v2026.15: Compartir Ayuda Directorio ──
function shareManual() {
  var shareData = {
    title: 'SITREP - Ayuda Directorio',
    text: 'Ayuda Directorio del Sistema de Trazabilidad de Residuos Peligrosos - Provincia de Mendoza',
    url: window.location.href
  };

  if (navigator.share) {
    navigator.share(shareData).catch(function() {});
  } else {
    navigator.clipboard.writeText(window.location.href).then(function() {
      showToast('Enlace copiado al portapapeles');
    }).catch(function() {
      var input = document.createElement('input');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      showToast('Enlace copiado al portapapeles');
    });
  }
}

function showToast(msg) {
  var existing = document.querySelector('.share-toast');
  if (existing) existing.remove();
  var toast = document.createElement('div');
  toast.className = 'share-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3000);
}

// ── v2026.6: Export PDF (print) ──
function exportPDF() {
  window.print();
}

// ── v2026.5: Theme toggle ──
function initTheme() {
  var saved = localStorage.getItem('sitrep-manual-theme');
  var resolved = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', resolved);
}
initTheme(); // Run immediately to avoid flash

function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme');
  var next = current === 'dark' ? 'light' : (current === 'light' ? 'dark' :
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark'));
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('sitrep-manual-theme', next);
  var btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = next === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';
}

// ── v2026.5: Reading progress bar ──
function updateProgress() {
  var bar = document.getElementById('progressBar');
  if (!bar) return;
  var scrollTop = window.scrollY;
  var docHeight = document.documentElement.scrollHeight - window.innerHeight;
  var pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  bar.style.width = pct + '%';
}

// v2026.4: accordion toggle for sidebar nav groups
function toggleNavGroup(title) {
  var items = title.nextElementSibling;
  if (!items || !items.classList.contains('nav-group-items')) return;
  var collapsed = items.classList.toggle('collapsed');
  title.classList.toggle('collapsed', collapsed);
}

// Collapsible toggle (global, for FAQ etc.)
function toggleCollapsible(el) {
  el.classList.toggle('open');
  var body = el.nextElementSibling;
  if (body && body.classList.contains('collapsible-body')) {
    body.classList.toggle('open');
  }
}

document.addEventListener('DOMContentLoaded', function() {
  var sections = document.querySelectorAll('section[id]');
  var navLinks = document.querySelectorAll('.nav-link');
  var searchInput = document.getElementById('searchInput');
  var roleTabs = document.querySelectorAll('.role-tab');
  var backToTop = document.getElementById('backToTop');
  var hamburger = document.getElementById('hamburgerBtn');
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('overlay');
  var currentRole = 'all';
  var navItems = Array.prototype.map.call(navLinks, function(link) {
    var hash = link.getAttribute('href');
    return { link: link, target: hash && hash.charAt(0) === '#' ? document.getElementById(hash.slice(1)) : null };
  }).filter(function(item) { return item.target; });
  var anchorTimers = [];
  var anchorAlignmentUntil = 0;
  var anchorAlignmentFrame = 0;

  function anchorOffset() {
    var styles = getComputedStyle(document.documentElement);
    var header = parseInt(styles.getPropertyValue('--header-height'), 10) || 64;
    var breadcrumb = parseInt(styles.getPropertyValue('--breadcrumb-height'), 10) || 32;
    return header + breadcrumb + 12;
  }

  function anchorTarget(hash) {
    if (!hash || hash === '#') return null;
    try { return document.getElementById(decodeURIComponent(hash.slice(1))); }
    catch (_error) { return null; }
  }

  function scrollToAnchor(hash, behavior) {
    var target = anchorTarget(hash);
    if (!target || target.offsetParent === null) return false;
    var top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - anchorOffset());
    window.scrollTo({ top: top, behavior: behavior || 'auto' });
    return true;
  }

  function alignAnchor(hash, behavior) {
    anchorAlignmentUntil = Date.now() + 8000;
    anchorTimers.forEach(window.clearTimeout);
    anchorTimers = [];
    [0, 120, 420, 1000, 2200, 4500, 7800].forEach(function(delay, index) {
      anchorTimers.push(window.setTimeout(function() {
        scrollToAnchor(hash, index === 0 ? behavior : 'auto');
      }, delay));
    });
  }

  if ('ResizeObserver' in window) {
    new ResizeObserver(function() {
      if (!window.location.hash || Date.now() > anchorAlignmentUntil) return;
      window.cancelAnimationFrame(anchorAlignmentFrame);
      anchorAlignmentFrame = window.requestAnimationFrame(function() {
        scrollToAnchor(window.location.hash, 'auto');
      });
    }).observe(document.getElementById('mainContent'));
  }

  function keepSidebarLinkVisible(link) {
    if (!sidebar || !link) return;
    var margin = 28;
    var top = link.offsetTop;
    var bottom = top + link.offsetHeight;
    if (top < sidebar.scrollTop + margin) {
      sidebar.scrollTop = Math.max(0, top - margin);
    } else if (bottom > sidebar.scrollTop + sidebar.clientHeight - margin) {
      sidebar.scrollTop = bottom - sidebar.clientHeight + margin;
    }
  }

  // Abrir todos los collapsibles (FAQ) por defecto
  document.querySelectorAll('.collapsible-header').forEach(function(h) {
    h.classList.add('open');
    var body = h.nextElementSibling;
    if (body && body.classList.contains('collapsible-body')) {
      body.classList.add('open');
    }
  });

  // Scroll-spy único para todas las anclas enlazadas desde el índice.
  function updateActiveNav() {
    var scrollTop = window.scrollY + anchorOffset() + 20;
    var current = '';
    var currentTop = -1;

    navItems.forEach(function(item) {
      if (item.target.offsetParent === null) return;
      var targetTop = item.target.getBoundingClientRect().top + window.scrollY;
      if (targetTop <= scrollTop && targetTop >= currentTop) {
        current = item.target.id;
        currentTop = targetTop;
      }
    });

    // Limpiar active-parent
    document.querySelectorAll('.nav-section-title').forEach(function(t) {
      t.classList.remove('active-parent');
    });

    navLinks.forEach(function(link) {
      var isActive = link.getAttribute('href') === '#' + current;
      link.classList.toggle('active', isActive);
      if (isActive) {
        keepSidebarLinkVisible(link);
        // Auto-expandir grupo padre si esta colapsado
        var group = link.closest('.nav-group-items');
        if (group && group.classList.contains('collapsed')) {
          group.classList.remove('collapsed');
          var title = group.previousElementSibling;
          if (title) title.classList.remove('collapsed');
        }
        // Marcar section-title padre como active-parent
        var parentGroup = link.closest('.nav-group-items');
        if (parentGroup) {
          var parentTitle = parentGroup.previousElementSibling;
          if (parentTitle && parentTitle.classList.contains('nav-section-title')) {
            parentTitle.classList.add('active-parent');
          }
        }
      }
    });
  }
  var navUpdateScheduled = false;
  window.addEventListener('scroll', function() {
    if (navUpdateScheduled) return;
    navUpdateScheduled = true;
    window.requestAnimationFrame(function() {
      updateActiveNav();
      updateProgress();
      navUpdateScheduled = false;
    });
  }, { passive: true });
  updateActiveNav();
  updateProgress();

  // Las anclas deben permanecer exactas aunque fuentes e imágenes terminen de cargar.
  document.querySelectorAll('a[href^="#"]').forEach(function(link) {
    link.addEventListener('click', function(event) {
      var hash = link.getAttribute('href');
      if (!anchorTarget(hash)) return;
      event.preventDefault();
      if (window.location.hash !== hash) window.history.pushState(null, '', hash);
      alignAnchor(hash, 'smooth');
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });
  });

  window.addEventListener('hashchange', function() {
    alignAnchor(window.location.hash, 'auto');
  });

  if (window.location.hash) {
    alignAnchor(window.location.hash, 'auto');
    window.addEventListener('load', function() { alignAnchor(window.location.hash, 'auto'); }, { once: true });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function() { alignAnchor(window.location.hash, 'auto'); });
    }
  }

  // Search — v2026.4: busca dentro de nav-group-items
  searchInput.addEventListener('input', function() {
    var q = this.value.toLowerCase();
    navLinks.forEach(function(link) {
      var text = link.textContent.toLowerCase();
      link.style.display = text.includes(q) || q === '' ? '' : 'none';
    });
    document.querySelectorAll('.nav-section-title').forEach(function(t) {
      var items = t.nextElementSibling;
      var hasVisible = false;
      if (items && items.classList.contains('nav-group-items')) {
        items.querySelectorAll('.nav-link').forEach(function(link) {
          if (link.style.display !== 'none') hasVisible = true;
        });
        // Auto-expand when searching
        if (q !== '' && hasVisible) {
          items.classList.remove('collapsed');
          t.classList.remove('collapsed');
        }
      }
      t.style.display = hasVisible || q === '' ? '' : 'none';
    });
  });

  // Role filter tabs — v2026.4: SOLO filtra contenido, NUNCA oculta nav links
  roleTabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      roleTabs.forEach(function(t) { t.classList.remove('active'); });
      this.classList.add('active');
      currentRole = this.getAttribute('data-role');

      // Mostrar/ocultar secciones segun rol
      var firstVisible = null;
      sections.forEach(function(sec) {
        var r = sec.getAttribute('data-role');
        var visible = (currentRole === 'all' || r === 'all' || r === currentRole);
        sec.style.display = visible ? '' : 'none';
        if (visible && !firstVisible && r === currentRole) firstVisible = sec;
      });

      // Restaurar TODOS los nav links (nunca ocultar sidebar)
      navLinks.forEach(function(link) { link.style.display = ''; });

      // Scroll a la primera seccion del rol seleccionado
      if (firstVisible && currentRole !== 'all') {
        setTimeout(function() {
          firstVisible.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }

      setTimeout(updateActiveNav, 300);
    });
  });

  // Back to top
  window.addEventListener('scroll', function() {
    backToTop.classList.toggle('visible', window.scrollY > 400);
  });
  backToTop.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Hamburger (mobile)
  hamburger.addEventListener('click', function() {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });
  overlay.addEventListener('click', function() {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });
  navLinks.forEach(function(link) {
    link.addEventListener('click', function() {
      if (window.innerWidth <= 900) {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
      }
    });
  });

  // ── v2026.6: Hero carousel ──
  (function initHeroCarousel() {
    var slides = document.querySelectorAll('.hero-slide');
    var mobileSlides = document.querySelectorAll('.hero-slide-mobile');
    if (!slides.length) return;

    var current = 0, mCurrent = 0;

    setInterval(function() {
      slides[current].classList.remove('active');
      current = (current + 1) % slides.length;
      slides[current].classList.add('active');
    }, 4000);

    if (mobileSlides.length) {
      setInterval(function() {
        mobileSlides[mCurrent].classList.remove('active');
        mCurrent = (mCurrent + 1) % mobileSlides.length;
        mobileSlides[mCurrent].classList.add('active');
      }, 8000);
    }
  })();

  // ── v2026.6: Hero parallax on mouse move (desktop only) ──
  (function initHeroParallax() {
    var hero = document.getElementById('hero');
    var desktop = document.querySelector('.device-desktop');
    var mobile = document.querySelector('.device-mobile');
    if (!hero || !desktop || window.innerWidth <= 900) return;

    hero.addEventListener('mousemove', function(e) {
      var rect = hero.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width - 0.5;
      var y = (e.clientY - rect.top) / rect.height - 0.5;
      desktop.style.transform = 'rotateY(' + (x * -8 - 5) + 'deg) rotateX(' + (y * 5 + 2) + 'deg)';
      if (mobile) mobile.style.transform = 'rotateY(' + (x * 5 + 5) + 'deg) rotateX(' + (y * -3) + 'deg)';
    });

    hero.addEventListener('mouseleave', function() {
      desktop.style.transform = '';
      if (mobile) mobile.style.transform = '';
    });
  })();

  // ── v2026.6: Sticky section breadcrumb ──
  (function stickyBreadcrumb() {
    var bar = document.createElement('div');
    bar.className = 'section-breadcrumb';

    var sbSection = document.createElement('span');
    sbSection.className = 'sb-section';
    var sbSep = document.createElement('span');
    sbSep.className = 'sb-sep';
    sbSep.textContent = '\u203A'; // ›
    var sbSub = document.createElement('span');
    sbSub.className = 'sb-sub';
    var sbSep2 = document.createElement('span');
    sbSep2.className = 'sb-sep';
    sbSep2.textContent = '\u203A';
    var sbCU = document.createElement('span');
    sbCU.className = 'sb-cu';

    bar.appendChild(sbSection);
    bar.appendChild(sbSep);
    bar.appendChild(sbSub);
    bar.appendChild(sbSep2);
    bar.appendChild(sbCU);
    document.body.appendChild(bar);

    var headings = document.querySelectorAll('section h2, section h3');
    var collapsibles = document.querySelectorAll('.collapsible-header');
    var currentH2 = '';
    var currentH3 = '';
    var currentCU = '';
    var currentH2El = null;
    var currentH3El = null;
    var currentCUEl = null;
    var heroEl = document.getElementById('hero');
    var heroBottom = heroEl ? heroEl.offsetTop + heroEl.offsetHeight : 0;
    var headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 64;
    var breadcrumbHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--breadcrumb-height')) || 32;

    // Click handlers — scroll to the heading's section
    sbSection.addEventListener('click', function() {
      if (currentH2El) currentH2El.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    sbSub.addEventListener('click', function() {
      if (currentH3El) currentH3El.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    sbCU.addEventListener('click', function() {
      if (currentCUEl) currentCUEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    var ticking = false;
    window.addEventListener('scroll', function() {
      if (!ticking) {
        requestAnimationFrame(function() {
          updateBreadcrumb();
          ticking = false;
        });
        ticking = true;
      }
    });

    function updateBreadcrumb() {
      var scrollY = window.scrollY;
      var threshold = headerHeight + breadcrumbHeight + 20;

      if (scrollY < heroBottom - headerHeight) {
        bar.classList.remove('visible');
        return;
      }

      var newH2 = '';
      var newH3 = '';
      var newCU = '';
      var newH2El = null;
      var newH3El = null;
      var newCUEl = null;

      for (var i = 0; i < headings.length; i++) {
        var h = headings[i];
        var top = h.getBoundingClientRect().top;
        if (top <= threshold) {
          if (h.tagName === 'H2') {
            newH2 = h.textContent.trim();
            newH2El = h;
            newH3 = '';
            newH3El = null;
          } else {
            newH3 = h.textContent.trim();
            newH3El = h;
          }
        }
      }

      // Find current open collapsible header above threshold — scoped to current section only
      var currentSection = newH3El ? newH3El.closest('section') : (newH2El ? newH2El.closest('section') : null);
      if (currentSection) {
        var sectionCollapsibles = currentSection.querySelectorAll('.collapsible-header');
        for (var j = 0; j < sectionCollapsibles.length; j++) {
          var c = sectionCollapsibles[j];
          if (!c.classList.contains('open')) continue;
          var cTop = c.getBoundingClientRect().top;
          if (cTop <= threshold) {
            newCU = c.textContent.trim();
            newCUEl = c;
          }
        }
      }

      if (!newH2 && !newH3) {
        bar.classList.remove('visible');
        return;
      }

      if (newH2 !== currentH2 || newH3 !== currentH3 || newCU !== currentCU) {
        currentH2 = newH2;
        currentH3 = newH3;
        currentCU = newCU;
        currentH2El = newH2El;
        currentH3El = newH3El;
        currentCUEl = newCUEl;
        sbSection.textContent = currentH2;
        if (currentH3) {
          sbSep.style.display = '';
          sbSub.textContent = currentH3;
        } else {
          sbSep.style.display = 'none';
          sbSub.textContent = '';
        }
        if (currentCU) {
          sbSep2.style.display = '';
          sbCU.textContent = currentCU;
        } else {
          sbSep2.style.display = 'none';
          sbCU.textContent = '';
        }
      }

      bar.classList.add('visible');
    }
  })();
});
