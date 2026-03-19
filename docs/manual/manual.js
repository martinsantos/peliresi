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

    // Considerar anclas en-pagina dentro de secciones (proc-*, gal-*, flujo-*)
    document.querySelectorAll('[id^="proc-"], [id^="gal-"], [id^="flujo-"]').forEach(function(el) {
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
});
