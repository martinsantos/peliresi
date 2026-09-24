(function () {
  'use strict';

  var data = window.SITREP_HELP || { profiles: [], guides: [] };
  var page = document.body.getAttribute('data-page');
  var params = new URLSearchParams(window.location.search);
  var storageKey = 'sitrep_help_progress_v1';

  function escapeHTML(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function slugify(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function profileById(id) {
    return data.profiles.find(function (profile) { return profile.id === id; });
  }

  function guideById(id) {
    return data.guides.find(function (guide) { return guide.id === id; });
  }

  function readProgress() {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); }
    catch (_error) { return {}; }
  }

  function writeProgress(guide, index) {
    var progress = readProgress();
    progress[guide.id] = {
      step: index,
      total: guide.steps.length,
      title: guide.title,
      profile: guide.profile,
      updatedAt: Date.now()
    };
    localStorage.setItem(storageKey, JSON.stringify(progress));
  }

  function latestProgress() {
    var entries = Object.keys(readProgress()).map(function (key) {
      var item = readProgress()[key];
      item.guideId = key;
      return item;
    });
    return entries.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); })[0];
  }

  function showToast(message) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(function () { toast.classList.remove('visible'); }, 2600);
  }

  function handleDirectoryHash() {
    if (page !== 'home' || !window.location.hash) return;
    var hash = window.location.hash.slice(1);
    var nativeHashes = ['perfiles', 'frecuentes', 'tutoriales', 'main'];
    if (nativeHashes.indexOf(hash) >= 0) return;
    var mapped = {
      capacitacion: 'index.html#tutoriales',
      'ft-5': 'tutorial.html?guide=transportista-confirmar-retiro#paso-3-confirmar-el-retiro',
      'ft-9': 'tutorial.html?guide=transportista-confirmar-entrega#paso-3-confirmar-la-entrega',
      'fg-3': 'tutorial.html?guide=generador-crear-manifiesto#paso-1-iniciar-un-manifiesto',
      'fg-7': 'tutorial.html?guide=generador-seguir-manifiesto#paso-3-consultar-el-viaje',
      'fo-4': 'tutorial.html?guide=operador-recibir-pesar#paso-3-confirmar-la-recepcion',
      'fo-5': 'tutorial.html?guide=operador-recibir-pesar#paso-4-registrar-el-pesaje',
      'fo-7': 'tutorial.html?guide=operador-tratar-cerrar#paso-2-registrar-el-tratamiento',
      'fa-4': 'tutorial.html?guide=administrador-impersonar-volver#paso-2-elegir-el-usuario'
    };
    window.location.replace(mapped[hash] || ('directorio.html#' + encodeURIComponent(hash)));
  }

  function tutorialURL(guide, stepIndex) {
    var url = 'tutorial.html?guide=' + encodeURIComponent(guide.id);
    if (typeof stepIndex === 'number' && guide.steps[stepIndex]) {
      url += '#paso-' + (stepIndex + 1) + '-' + slugify(guide.steps[stepIndex].title);
    }
    return url;
  }

  function renderHome() {
    var profileList = document.getElementById('profileList');
    data.profiles.forEach(function (profile) {
      var link = document.createElement('a');
      link.className = 'profile-row';
      link.href = 'search.html?profile=' + encodeURIComponent(profile.id);
      link.innerHTML = '<span class="profile-icon"><span class="material-symbols-rounded" aria-hidden="true">' + escapeHTML(profile.icon) + '</span></span>' +
        '<span class="profile-copy"><span class="profile-title">' + escapeHTML(profile.label) + '</span><span class="profile-description">' + escapeHTML(profile.description) + '</span></span>' +
        '<span class="material-symbols-rounded" aria-hidden="true">chevron_right</span>';
      profileList.appendChild(link);
    });

    var popularIds = [
      'inspector-completar-inspeccion',
      'generador-crear-manifiesto',
      'transportista-confirmar-retiro',
      'operador-recibir-pesar',
      'operador-tratar-cerrar',
      'administrador-impersonar-volver'
    ];
    var popularList = document.getElementById('popularList');
    popularIds.forEach(function (id) {
      var guide = guideById(id);
      if (!guide) return;
      var item = document.createElement('li');
      item.innerHTML = '<a href="' + tutorialURL(guide) + '"><span>' + escapeHTML(guide.title) + '</span><span class="material-symbols-rounded" aria-hidden="true">chevron_right</span></a>';
      popularList.appendChild(item);
    });

    var tutorialGrid = document.getElementById('tutorialGrid');
    data.guides.slice(0, 9).forEach(function (guide) {
      var profile = profileById(guide.profile);
      var link = document.createElement('a');
      link.className = 'tutorial-card';
      link.href = tutorialURL(guide);
      link.innerHTML = '<span class="tutorial-card-icon"><span class="material-symbols-rounded" aria-hidden="true">' + escapeHTML(guide.icon) + '</span></span>' +
        '<h3>' + escapeHTML(guide.title) + '</h3><p>' + escapeHTML(guide.summary) + '</p>' +
        '<span class="tutorial-card-meta"><span>' + escapeHTML(profile ? profile.label : guide.profile) + '</span><span><span class="material-symbols-rounded" aria-hidden="true">format_list_numbered</span>' + guide.steps.length + ' pasos</span><span><span class="material-symbols-rounded" aria-hidden="true">schedule</span>' + escapeHTML(guide.duration) + '</span></span>';
      tutorialGrid.appendChild(link);
    });

    var recent = latestProgress();
    var continuePanel = document.getElementById('continuePanel');
    if (recent && guideById(recent.guideId)) {
      var guide = guideById(recent.guideId);
      var profile = profileById(guide.profile);
      var nextStep = Math.min(recent.step || 0, guide.steps.length - 1);
      var percent = Math.round(((nextStep + 1) / guide.steps.length) * 100);
      document.getElementById('continueDescription').textContent = (profile ? profile.label + ' · ' : '') + guide.title + ' · Paso ' + (nextStep + 1) + ' de ' + guide.steps.length;
      document.getElementById('continueProgress').style.width = percent + '%';
      document.getElementById('continueLink').href = tutorialURL(guide, nextStep);
      continuePanel.hidden = false;
    }

    document.addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.getElementById('homeSearch').focus();
      }
    });
  }

  function scoreGuide(guide, query) {
    if (!query) return 1;
    var words = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(Boolean);
    var title = guide.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var summary = guide.summary.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var keywords = guide.keywords.join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var steps = guide.steps.map(function (step) { return step.title + ' ' + step.body.join(' '); }).join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var profile = (profileById(guide.profile) || {}).label || guide.profile;
    var searchable = [title, summary, keywords, steps, profile.toLowerCase()].join(' ');
    if (!words.every(function (word) { return searchable.indexOf(word) >= 0; })) return 0;
    return words.reduce(function (score, word) {
      if (title.indexOf(word) >= 0) score += 12;
      if (keywords.indexOf(word) >= 0) score += 7;
      if (summary.indexOf(word) >= 0) score += 4;
      if (steps.indexOf(word) >= 0) score += 2;
      return score;
    }, 0);
  }

  function renderSearch() {
    var queryInput = document.getElementById('searchQuery');
    var query = params.get('q') || '';
    var activeProfile = params.get('profile') || 'all';
    var selectedId = null;
    var previewMedia = window.matchMedia('(min-width: 1101px)');
    queryInput.value = query;

    var filters = document.getElementById('searchProfileFilters');
    data.profiles.forEach(function (profile) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'category-filter';
      button.setAttribute('data-profile', profile.id);
      button.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">' + escapeHTML(profile.icon) + '</span>' + escapeHTML(profile.label);
      filters.appendChild(button);
    });

    function updateURL() {
      var current = new URL(window.location.href);
      if (query) current.searchParams.set('q', query); else current.searchParams.delete('q');
      if (activeProfile !== 'all') current.searchParams.set('profile', activeProfile); else current.searchParams.delete('profile');
      window.history.replaceState(null, '', current.pathname + current.search);
    }

    function selectGuide(guide) {
      selectedId = guide.id;
      document.querySelectorAll('.search-result').forEach(function (item) {
        var selected = item.getAttribute('data-guide') === guide.id;
        item.classList.toggle('selected', selected);
        if (selected) item.setAttribute('aria-current', 'true');
        else item.removeAttribute('aria-current');
      });
      var profile = profileById(guide.profile);
      var preview = document.getElementById('searchPreview');
      preview.innerHTML = '<p class="preview-profile">' + escapeHTML(profile ? profile.label : guide.profile) + '</p>' +
        '<h2>' + escapeHTML(guide.title) + '</h2>' +
        '<div class="preview-meta"><span><span class="material-symbols-rounded" aria-hidden="true">menu_book</span>Tutorial</span><span><span class="material-symbols-rounded" aria-hidden="true">format_list_numbered</span>' + guide.steps.length + ' pasos</span><span><span class="material-symbols-rounded" aria-hidden="true">schedule</span>' + escapeHTML(guide.duration) + '</span></div>' +
        '<p class="preview-summary">' + escapeHTML(guide.summary) + '</p>' +
        '<div class="preview-note"><span class="material-symbols-rounded" aria-hidden="true">info</span><span>Leer este tutorial no modifica ningún dato en SITREP.</span></div>' +
        '<ol class="preview-steps">' + guide.steps.map(function (step, index) { return '<li><span class="preview-step-number">' + (index + 1) + '</span><span>' + escapeHTML(step.title) + '</span></li>'; }).join('') + '</ol>' +
        '<div class="preview-actions"><a class="button button-primary" href="' + tutorialURL(guide) + '"><span class="material-symbols-rounded" aria-hidden="true">play_circle</span>Comenzar tutorial</a><div class="preview-secondary"><a class="quiet-link" href="' + tutorialURL(guide) + '"><span class="material-symbols-rounded" aria-hidden="true">menu_book</span>Abrir guía</a><button type="button" id="copyGuide"><span class="material-symbols-rounded" aria-hidden="true">link</span>Copiar enlace</button></div></div>';
      var copy = document.getElementById('copyGuide');
      copy.addEventListener('click', function () {
        navigator.clipboard.writeText(new URL(tutorialURL(guide), window.location.href).href).then(function () { showToast('Enlace copiado'); });
      });
    }

    function drawResults() {
      var ranked = data.guides.map(function (guide) { return { guide: guide, score: scoreGuide(guide, query) }; })
        .filter(function (item) { return item.score > 0 && (activeProfile === 'all' || item.guide.profile === activeProfile); })
        .sort(function (a, b) { return b.score - a.score || a.guide.title.localeCompare(b.guide.title); });
      var results = document.getElementById('searchResults');
      results.innerHTML = '';
      document.getElementById('searchEmpty').hidden = ranked.length > 0;
      document.getElementById('searchResultCount').textContent = ranked.length + (ranked.length === 1 ? ' resultado' : ' resultados');
      document.getElementById('searchResultsTitle').textContent = query ? 'Resultados para “' + query + '”' : (activeProfile === 'all' ? 'Todas las guías' : 'Guías para ' + (profileById(activeProfile) || {}).label);
      ranked.forEach(function (item, index) {
        var guide = item.guide;
        var profile = profileById(guide.profile);
        var result = document.createElement('a');
        result.className = 'search-result';
        result.href = tutorialURL(guide);
        result.setAttribute('data-guide', guide.id);
        result.innerHTML = '<span class="result-number">' + (index + 1) + '</span><span><h2>' + escapeHTML(guide.title) + '</h2><p>' + escapeHTML(guide.summary) + '</p><span class="result-meta"><span>' + escapeHTML(profile ? profile.label : guide.profile) + '</span><span><span class="material-symbols-rounded" aria-hidden="true">menu_book</span>Tutorial</span><span><span class="material-symbols-rounded" aria-hidden="true">schedule</span>' + escapeHTML(guide.duration) + '</span></span></span><span class="material-symbols-rounded" aria-hidden="true">chevron_right</span>';
        result.addEventListener('click', function (event) {
          var modifiedClick = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
          var keyboardActivation = event.detail === 0;
          if (!previewMedia.matches || modifiedClick || keyboardActivation) return;
          event.preventDefault();
          selectGuide(guide);
        });
        result.addEventListener('dblclick', function () { window.location.href = tutorialURL(guide); });
        results.appendChild(result);
      });
      if (ranked.length && previewMedia.matches) selectGuide(ranked[0].guide);
    }

    document.querySelectorAll('.category-filter[data-profile]').forEach(function (button) {
      var isActive = button.getAttribute('data-profile') === activeProfile;
      button.classList.toggle('active', isActive);
      button.addEventListener('click', function () {
        activeProfile = button.getAttribute('data-profile');
        document.querySelectorAll('.category-filter[data-profile]').forEach(function (item) { item.classList.toggle('active', item === button); });
        updateURL();
        drawResults();
      });
    });
    document.getElementById('searchPageForm').addEventListener('submit', function (event) {
      event.preventDefault();
      query = queryInput.value.trim();
      updateURL();
      drawResults();
    });
    drawResults();
  }

  function renderTutorial() {
    var guide = guideById(params.get('guide')) || guideById('transportista-confirmar-retiro') || data.guides[0];
    if (!guide) return;
    var profile = profileById(guide.profile) || { label: guide.profile, icon: guide.icon };
    document.title = guide.title + ' — Centro de Ayuda SITREP';
    document.getElementById('sidebarProfile').textContent = profile.label;
    document.getElementById('sidebarProfileIcon').textContent = profile.icon;
    document.getElementById('breadcrumbProfile').textContent = profile.label;
    document.getElementById('breadcrumbProfile').href = 'search.html?profile=' + encodeURIComponent(profile.id || guide.profile);
    document.getElementById('breadcrumbTitle').textContent = guide.title;
    document.getElementById('tutorialProfile').textContent = profile.label;
    document.getElementById('tutorialTitle').textContent = guide.title;
    document.getElementById('tutorialSummary').textContent = guide.summary;
    document.getElementById('stepCount').textContent = guide.steps.length + ' pasos';
    document.getElementById('tutorialDuration').textContent = guide.duration;
    document.querySelector('#safetyNote p').textContent = guide.safety || 'Leé todos los pasos antes de realizar acciones en el sistema.';

    var indexList = document.getElementById('tutorialIndex');
    var stepsRoot = document.getElementById('tutorialSteps');
    var activeIndex = 0;
    var stepSections = [];
    var stepLinks = [];

    guide.steps.forEach(function (step, index) {
      var id = 'paso-' + (index + 1) + '-' + slugify(step.title);
      var listItem = document.createElement('li');
      var link = document.createElement('a');
      link.href = '#' + id;
      link.innerHTML = '<span class="index-marker">' + (index + 1) + '</span><span>' + escapeHTML(step.title) + '</span>';
      link.addEventListener('click', function () {
        updateActive(index, true);
        if (window.innerWidth <= 820) setMobileIndex(false);
      });
      listItem.appendChild(link);
      indexList.appendChild(listItem);
      stepLinks.push(link);

      var section = document.createElement('section');
      section.className = 'guide-step';
      section.id = id;
      section.setAttribute('data-step', String(index));
      section.innerHTML = '<p class="step-kicker">Paso ' + (index + 1) + ' de ' + guide.steps.length + '</p>' +
        '<div class="step-title-row"><h2>' + escapeHTML(step.title) + '</h2><button class="copy-step-link" type="button" data-copy-step="' + index + '"><span class="material-symbols-rounded" aria-hidden="true">link</span>Copiar enlace a este paso</button></div>' +
        '<ol class="step-instructions">' + step.body.map(function (instruction) { return '<li><span>' + escapeHTML(instruction) + '</span></li>'; }).join('') + '</ol>' +
        (step.image ? '<figure class="guide-image-wrap' + (step.image.indexOf('/mobile/') >= 0 ? ' is-mobile-capture' : ' is-desktop-capture') + '"><a class="guide-image-link" href="' + escapeHTML(step.image) + '" target="_blank" rel="noopener" aria-label="Abrir captura a tamaño completo"><img class="guide-image" src="' + escapeHTML(step.image) + '" width="1600" height="900" loading="lazy" alt="' + escapeHTML(step.alt) + '"></a><figcaption class="guide-image-caption">' + (step.image.indexOf('inspection_') >= 0 ? 'Simulación de capacitación con datos de prueba' : 'Captura de SITREP') + ' · Tocá para verla completa.</figcaption></figure>' : '') +
        '<div class="expected-result"><span class="material-symbols-rounded" aria-hidden="true">check</span><div><strong>Resultado esperado</strong><p>' + escapeHTML(step.expected) + '</p></div></div>';
      stepsRoot.appendChild(section);
      stepSections.push(section);
    });

    function updateActive(index, replaceHash) {
      activeIndex = Math.max(0, Math.min(index, guide.steps.length - 1));
      var percent = Math.round(((activeIndex + 1) / guide.steps.length) * 100);
      stepLinks.forEach(function (link, linkIndex) {
        link.classList.toggle('active', linkIndex === activeIndex);
        link.classList.toggle('complete', linkIndex < activeIndex);
        if (linkIndex === activeIndex) link.setAttribute('aria-current', 'step'); else link.removeAttribute('aria-current');
        var marker = link.querySelector('.index-marker');
        marker.textContent = linkIndex < activeIndex ? '✓' : String(linkIndex + 1);
      });
      document.getElementById('progressLabel').textContent = 'Paso ' + (activeIndex + 1) + ' de ' + guide.steps.length;
      document.getElementById('progressPercent').textContent = percent + '%';
      document.getElementById('tutorialProgressBar').style.width = percent + '%';
      document.getElementById('footerProgress').textContent = (activeIndex + 1) + ' de ' + guide.steps.length;
      document.getElementById('mobileIndexStatus').textContent = 'Paso ' + (activeIndex + 1) + ' de ' + guide.steps.length;
      document.getElementById('previousStep').disabled = activeIndex === 0;
      var next = document.getElementById('nextStep');
      next.querySelector('span:first-child').textContent = activeIndex === guide.steps.length - 1 ? 'Finalizar' : 'Siguiente paso';
      writeProgress(guide, activeIndex);
      if (replaceHash) window.history.replaceState(null, '', '#' + stepSections[activeIndex].id);
    }

    function goToStep(index) {
      var target = Math.max(0, Math.min(index, guide.steps.length - 1));
      if (index >= guide.steps.length) {
        writeProgress(guide, guide.steps.length - 1);
        showToast('Tutorial completado');
        window.location.href = './';
        return;
      }
      stepSections[target].scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      updateActive(target, true);
    }

    document.getElementById('previousStep').addEventListener('click', function () { goToStep(activeIndex - 1); });
    document.getElementById('nextStep').addEventListener('click', function () { goToStep(activeIndex + 1); });
    document.querySelectorAll('[data-copy-step]').forEach(function (button) {
      button.addEventListener('click', function () {
        var index = Number(button.getAttribute('data-copy-step'));
        var url = new URL(window.location.href);
        url.hash = stepSections[index].id;
        navigator.clipboard.writeText(url.href).then(function () { showToast('Enlace al paso copiado'); });
      });
    });

    var scrollTicking = false;
    function syncStepFromScroll() {
      var readingLine = window.innerWidth <= 820 ? 240 : 170;
      var current = 0;
      stepSections.forEach(function (section, index) {
        if (section.getBoundingClientRect().top <= readingLine) current = index;
      });
      if (current !== activeIndex) updateActive(current, true);
    }
    window.addEventListener('scroll', function () {
      if (scrollTicking) return;
      scrollTicking = true;
      window.requestAnimationFrame(function () {
        syncStepFromScroll();
        scrollTicking = false;
      });
    }, { passive: true });

    var hashIndex = stepSections.findIndex(function (section) { return '#' + section.id === window.location.hash; });
    var saved = readProgress()[guide.id];
    var initial = hashIndex >= 0 ? hashIndex : (saved ? Math.min(saved.step || 0, guide.steps.length - 1) : 0);
    updateActive(initial, false);
    if (hashIndex >= 0) window.setTimeout(function () { stepSections[hashIndex].scrollIntoView({ block: 'start' }); }, 60);

    var mobileToggle = document.getElementById('mobileIndexToggle');
    var sidebar = document.getElementById('tutorialSidebar');
    function setMobileIndex(open) {
      sidebar.classList.toggle('open', open);
      mobileToggle.setAttribute('aria-expanded', String(open));
    }
    mobileToggle.addEventListener('click', function () { setMobileIndex(mobileToggle.getAttribute('aria-expanded') !== 'true'); });
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape') setMobileIndex(false); });
  }

  handleDirectoryHash();
  if (page === 'home') renderHome();
  if (page === 'search') renderSearch();
  if (page === 'tutorial') renderTutorial();
})();
