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
  p1.textContent = 'Este manual es exclusivo para usuarios registrados del sistema SITREP.';

  var p2 = document.createElement('p');
  p2.textContent = 'Inicia sesion para acceder a la documentacion completa.';

  var btn = document.createElement('button');
  btn.className = 'auth-btn';
  btn.textContent = 'Iniciar Sesion';
  btn.addEventListener('click', function() {
    window.location.href = '/app/';
  });

  wall.appendChild(logo);
  wall.appendChild(p1);
  wall.appendChild(p2);
  wall.appendChild(btn);
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
    title: 'SITREP - Manual del Sistema',
    text: 'Manual de Trazabilidad de Residuos Peligrosos - Provincia de Mendoza',
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
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
  }
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

  // Abrir todos los collapsibles (FAQ) por defecto
  document.querySelectorAll('.collapsible-header').forEach(function(h) {
    h.classList.add('open');
    var body = h.nextElementSibling;
    if (body && body.classList.contains('collapsible-body')) {
      body.classList.add('open');
    }
  });

  // v2026.4: Scroll-spy — detecta seccion activa incluyendo anclas en-pagina (proc-*, gal-*, flujo-*)
  function updateActiveNav() {
    var scrollTop = window.scrollY + 120;
    var current = '';

    // Considerar secciones
    sections.forEach(function(s) {
      if (s.offsetTop > 0 && s.style.display !== 'none' && s.offsetTop <= scrollTop) {
        current = s.id;
      }
    });

    // Considerar anclas en-pagina dentro de secciones (proc-*, gal-*, flujo-*, fa-*, fg-*, ft-*, fo-*)
    document.querySelectorAll('[id^="proc-"], [id^="gal-"], [id^="flujo-"], [id^="fa-"], [id^="fg-"], [id^="ft-"], [id^="fo-"]').forEach(function(el) {
      var rect = el.getBoundingClientRect();
      if (rect.top <= 120) current = el.id;
    });

    // Limpiar active-parent
    document.querySelectorAll('.nav-section-title').forEach(function(t) {
      t.classList.remove('active-parent');
    });

    navLinks.forEach(function(link) {
      var isActive = link.getAttribute('href') === '#' + current;
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.scrollIntoView({ block: 'nearest' });
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
  window.addEventListener('scroll', function() {
    updateActiveNav();
    updateProgress();
  }, { passive: true });
  updateActiveNav();
  updateProgress();

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
});
