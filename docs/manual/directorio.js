// ── v2026.6: Auth guard — solo usuarios autenticados ──
(function checkAuth() {
  var token = localStorage.getItem('sitrep_access_token');
  if (token) return;

  var wall = document.createElement('div');
  wall.className = 'auth-wall';

  var logo = document.createElement('div');
  logo.className = 'auth-logo';
  logo.textContent = 'SITREP ';
  var logoSpan = document.createElement('span');
  logoSpan.textContent = 'Mendoza';
  logo.appendChild(logoSpan);

  var p1 = document.createElement('p');
  p1.textContent = 'El directorio completo requiere iniciar sesión en SITREP.';

  var p2 = document.createElement('p');
  p2.textContent = 'La guía por roles sigue disponible sin iniciar sesión.';

  var btn = document.createElement('button');
  btn.className = 'auth-btn';
  btn.textContent = 'Iniciar sesión';
  btn.addEventListener('click', function() {
    window.location.href = '/app/';
  });

  wall.appendChild(logo);
  wall.appendChild(p1);
  wall.appendChild(p2);
  wall.appendChild(btn);
  var back = document.createElement('a');
  back.className = 'auth-back';
  back.href = './';
  back.textContent = 'Volver a la guía por roles';
  wall.appendChild(back);
  document.body.appendChild(wall);
  document.body.style.overflow = 'hidden';

  window.addEventListener('storage', function(e) {
    if (e.key === 'sitrep_access_token' && e.newValue) {
      wall.remove();
      document.body.style.overflow = '';
    }
  });
})();

// ── v2026.6: Share manual ──
function shareManual() {
  var shareData = {
    title: 'SITREP Mendoza - Directorio completo',
    text: 'Manual y guia de capacitacion de Trazabilidad de Residuos Peligrosos - Provincia de Mendoza',
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
  // El directorio comparte la apariencia clara y consistente del Centro de Ayuda.
  document.documentElement.setAttribute('data-theme', 'light');
}
initTheme();

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

// Mantener la visibilidad y el estado accesible sincronizados en cada apertura.
function setNavGroupExpanded(title, expanded) {
  var items = title.nextElementSibling;
  if (!items || !items.classList.contains('nav-group-items')) return;
  items.hidden = !expanded;
  title.classList.toggle('collapsed', !expanded);
  title.setAttribute('aria-expanded', String(expanded));
}
function toggleNavGroup(title) {
  setNavGroupExpanded(title, title.getAttribute('aria-expanded') !== 'true');
}

// Collapsible toggle (global, for FAQ etc.)
function toggleCollapsible(el) {
  var open = el.classList.toggle('open');
  el.setAttribute('aria-expanded', String(open));
  var body = el.nextElementSibling;
  if (body && body.classList.contains('collapsible-body')) {
    body.classList.toggle('open', open);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  var sections = document.querySelectorAll('section[id]');
  var navLinks = document.querySelectorAll('.nav-link');
  var searchInput = document.getElementById('searchInput');
  var searchEmpty = document.getElementById('sidebarSearchEmpty');
  var roleTabs = document.querySelectorAll('.role-tab');
  var backToTop = document.getElementById('backToTop');
  var hamburger = document.getElementById('hamburgerBtn');
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('overlay');
  var currentRole = 'all';

  // En un documento extenso con capturas lazy, el salto nativo puede quedar
  // desplazado cuando cargan imágenes y fuentes. Reanclar tras la carga.
  function alignHashTarget() {
    var id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    var target = document.getElementById(id);
    if (!target) return;
    var offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--scroll-offset'), 10);
    if (!Number.isFinite(offset)) offset = 122;
    window.scrollTo({ top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset), behavior: 'instant' });
  }
  function settleHashTarget() {
    alignHashTarget();
    setTimeout(alignHashTarget, 180);
    setTimeout(alignHashTarget, 750);
  }
  window.addEventListener('hashchange', settleHashTarget);
  window.addEventListener('load', settleHashTarget, { once: true });
  if (window.location.hash) requestAnimationFrame(settleHashTarget);

  // Abrir todos los collapsibles (FAQ) por defecto
  document.querySelectorAll('.collapsible-header').forEach(function(h, index) {
    h.classList.add('open');
    var body = h.nextElementSibling;
    if (body && body.classList.contains('collapsible-body')) {
      if (!body.id) {
        var id = 'manual-accordion-' + (index + 1);
        while (document.getElementById(id)) id += '-';
        body.id = id;
      }
      h.setAttribute('aria-controls', body.id);
      h.setAttribute('aria-expanded', 'true');
      body.classList.add('open');
    }
  });

  // v2026.4: Scroll-spy — detecta seccion activa incluyendo anclas en-pagina (proc-*, gal-*, flujo-*)
  function updateActiveNav() {
    var scrollTop = window.scrollY + 144;
    var current = '';
    var currentSection = null;

    // Considerar secciones
    sections.forEach(function(s) {
      if (s.offsetTop > 0 && s.style.display !== 'none' && s.offsetTop <= scrollTop) {
        current = s.id;
        currentSection = s;
      }
    });

    // Sólo el subtema de la sección visible puede reemplazar su indicador.
    // Antes, un ancla de un capítulo anterior sobrescribía Inspecciones.
    if (currentSection) {
      currentSection.querySelectorAll('h3[id], h4[id], [id^="proc-"], [id^="gal-"], [id^="flujo-"], [id^="fa-"], [id^="fg-"], [id^="ft-"], [id^="fo-"]').forEach(function(el) {
        if (el.getBoundingClientRect().top <= 144) current = el.id;
      });
    }

    // Limpiar active-parent
    document.querySelectorAll('.nav-section-title').forEach(function(t) {
      t.classList.remove('active-parent');
    });

    navLinks.forEach(function(link) {
      var isActive = link.getAttribute('href') === '#' + current;
      link.classList.toggle('active', isActive);
      if (isActive) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
      if (isActive) {
        // Auto-expandir grupo padre si esta colapsado
        var group = link.closest('.nav-group-items');
        if (group && group.hidden) {
          var title = group.previousElementSibling;
          if (title) setNavGroupExpanded(title, true);
        }
        link.scrollIntoView({ block: 'nearest' });
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
  window.addEventListener('scroll', function() {
    updateActiveNav();
    updateProgress();
  }, { passive: true });
  updateActiveNav();
  updateProgress();

  // Search — v2026.4: busca dentro de nav-group-items
  function searchableText(value) {
    return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }
  function filterNavigation() {
    var q = searchableText(this.value);
    var matches = 0;
    navLinks.forEach(function(link) {
      if (!link.closest('.nav-group-items')) return;
      var text = searchableText(link.textContent);
      var visible = text.includes(q) || q === '';
      link.style.display = visible ? '' : 'none';
      if (visible) matches++;
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
          setNavGroupExpanded(t, true);
        }
      }
      t.style.display = hasVisible || q === '' ? '' : 'none';
    });
    searchEmpty.hidden = q === '' || matches > 0;
  }
  searchInput.addEventListener('input', filterNavigation);

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

      // Mantener coherente la búsqueda al cambiar el filtro de rol.
      filterNavigation.call(searchInput);

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

  function syncSidebar() {
    var mobile = window.matchMedia('(max-width: 900px)').matches;
    if (!mobile) {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    }
    hamburger.setAttribute('aria-label', sidebar.classList.contains('open') ? 'Cerrar índice del manual' : 'Abrir índice del manual');
    sidebar.toggleAttribute('inert', mobile && !sidebar.classList.contains('open'));
  }
  function closeSidebar(restoreFocus) {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    syncSidebar();
    if (restoreFocus) hamburger.focus({ preventScroll: true });
  }

  // Hamburger (mobile)
  hamburger.addEventListener('click', function() {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', sidebar.classList.contains('open') ? 'true' : 'false');
    syncSidebar();
  });
  overlay.addEventListener('click', function() {
    closeSidebar(false);
  });
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && window.matchMedia('(max-width: 900px)').matches && sidebar.classList.contains('open')) {
      closeSidebar(true);
    }
  });
  window.addEventListener('resize', syncSidebar);
  syncSidebar();
  navLinks.forEach(function(link) {
    link.addEventListener('click', function() {
      if (window.innerWidth <= 900) {
        closeSidebar(false);
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
    var bar = document.createElement('nav');
    bar.className = 'section-breadcrumb';
    bar.setAttribute('aria-label', 'Ruta del directorio');
    bar.setAttribute('aria-hidden', 'true');

    var sbSection = document.createElement('button');
    sbSection.type = 'button';
    sbSection.tabIndex = -1;
    sbSection.className = 'sb-section';
    var sbSep = document.createElement('span');
    sbSep.className = 'sb-sep';
    sbSep.setAttribute('aria-hidden', 'true');
    sbSep.textContent = '\u203A'; // ›
    var sbSub = document.createElement('button');
    sbSub.type = 'button';
    sbSub.tabIndex = -1;
    sbSub.className = 'sb-sub';
    var sbSep2 = document.createElement('span');
    sbSep2.className = 'sb-sep';
    sbSep2.setAttribute('aria-hidden', 'true');
    sbSep2.textContent = '\u203A';
    var sbCU = document.createElement('button');
    sbCU.type = 'button';
    sbCU.tabIndex = -1;
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
    var headingLabels = new WeakMap();

    function setBreadcrumbVisible(visible) {
      bar.classList.toggle('visible', visible);
      bar.setAttribute('aria-hidden', visible ? 'false' : 'true');
      [sbSection, sbSub, sbCU].forEach(function(button) { button.tabIndex = visible ? 0 : -1; });
    }

    function headingLabel(heading) {
      if (headingLabels.has(heading)) return headingLabels.get(heading);
      var copy = heading.cloneNode(true);
      copy.querySelectorAll('.cu-section-badge, .cu-section-count').forEach(function(badge) { badge.remove(); });
      var label = (copy.textContent || '').replace(/\s+/g, ' ').trim();
      headingLabels.set(heading, label);
      return label;
    }

    function scrollToHeading(heading) {
      if (!heading) return;
      var top = Math.max(0, window.scrollY + heading.getBoundingClientRect().top - headerHeight - breadcrumbHeight - 12);
      var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: top, behavior: reduced ? 'auto' : 'smooth' });
    }

    // Native buttons keep the route available to mouse, touch and keyboard.
    sbSection.addEventListener('click', function() {
      scrollToHeading(currentH2El);
    });
    sbSub.addEventListener('click', function() {
      scrollToHeading(currentH3El);
    });
    sbCU.addEventListener('click', function() {
      scrollToHeading(currentCUEl);
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
    // Do not hide a focused keyboard control while the reader scrolls away.
    // Re-evaluate after focus actually leaves the breadcrumb.
    bar.addEventListener('focusout', function() { requestAnimationFrame(updateBreadcrumb); });

    function updateBreadcrumb() {
      var scrollY = window.scrollY;
      var threshold = headerHeight + breadcrumbHeight + 20;

      if (scrollY < heroBottom - headerHeight) {
        if (bar.contains(document.activeElement)) return;
        setBreadcrumbVisible(false);
        return;
      }

      var newH2 = '';
      var newH3 = '';
      var newCU = '';
      var newH2El = null;
      var newH3El = null;
      var newCUEl = null;
      var chapter = null;
      var chapterIndex = -1;

      for (var i = 0; i < headings.length; i++) {
        var h = headings[i];
        // A chapter heading can live in a role-filtered section. Keep its
        // semantic place in the document even if that section is hidden.
        if (h.tagName === 'H2') { chapter = h; chapterIndex = i; }
        if (!h.getClientRects().length) continue;
        var top = h.getBoundingClientRect().top;
        if (top <= threshold) {
          if (h.tagName === 'H2') {
            newH2 = headingLabel(h);
            newH2El = h;
            newH3 = '';
            newH3El = null;
          } else {
            if (chapter) {
              newH2 = headingLabel(chapter);
              newH2El = chapter.getClientRects().length ? chapter : null;
              if (!newH2El) {
                for (var k = chapterIndex + 1; k <= i; k++) {
                  if (headings[k].getClientRects().length) { newH2El = headings[k]; break; }
                }
              }
            }
            newH3 = headingLabel(h);
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
          if (!c.classList.contains('open') || !c.getClientRects().length) continue;
          var cTop = c.getBoundingClientRect().top;
          if (cTop <= threshold) {
            newCU = c.textContent.trim();
            newCUEl = c;
          }
        }
      }

      if (!newH2 && !newH3) {
        if (bar.contains(document.activeElement)) return;
        setBreadcrumbVisible(false);
        return;
      }

      if (newH2 !== currentH2 || newH3 !== currentH3 || newCU !== currentCU
        || newH2El !== currentH2El || newH3El !== currentH3El || newCUEl !== currentCUEl) {
        currentH2 = newH2;
        currentH3 = newH3;
        currentCU = newCU;
        currentH2El = newH2El;
        currentH3El = newH3El;
        currentCUEl = newCUEl;
        sbSection.textContent = currentH2;
        sbSection.hidden = !currentH2;
        sbSection.setAttribute('aria-label', 'Ir a ' + currentH2);
        sbSection.title = currentH2;
        if (currentH3) {
          sbSep.hidden = !currentH2;
          sbSub.hidden = false;
          sbSub.textContent = currentH3;
          sbSub.setAttribute('aria-label', 'Ir a ' + currentH3);
          sbSub.title = currentH3;
        } else {
          sbSep.hidden = true;
          sbSub.hidden = true;
          sbSub.textContent = '';
        }
        if (currentCU) {
          sbSep2.hidden = false;
          sbCU.hidden = false;
          sbCU.textContent = currentCU;
          sbCU.setAttribute('aria-label', 'Ir a ' + currentCU);
          sbCU.title = currentCU;
        } else {
          sbSep2.hidden = true;
          sbCU.hidden = true;
          sbCU.textContent = '';
        }
        [sbSection, sbSub, sbCU].forEach(function(button) { button.removeAttribute('aria-current'); });
        (currentCU ? sbCU : currentH3 ? sbSub : sbSection).setAttribute('aria-current', 'location');
      }

      setBreadcrumbVisible(true);
    }
  })();
});
