#!/usr/bin/env python3
"""
Manual SITREP v2026.3 — Nav Activa + Screenshots Duales Web+Mobile
Idempotent: detecta cu-screenshot-duo ya presente y salta esa parte.
"""
import re

HTML_PATH = "docs/manual/index.html"

with open(HTML_PATH, "r", encoding="utf-8") as f:
    html = f.read()

# ─── VERIFICAR SI YA APLICADO ─────────────────────────────────────────────────
already_applied = "cu-screenshot-duo" in html
if already_applied:
    print("⚠️  cu-screenshot-duo ya presente — saltando transformación de screenshots duales")

# ═══════════════════════════════════════════════════════════════════════════════
# PARTE 1 — CSS NUEVO
# ═══════════════════════════════════════════════════════════════════════════════

NEW_CSS = """
/* ── v2026.3: Duo screenshot (desktop + mobile side by side) ── */
.cu-screenshot-duo {
  display: grid;
  grid-template-columns: 1fr 130px;
  gap: 0.75rem;
  margin: 0.75rem 0 1.25rem;
  align-items: start;
}
.cu-screenshot-duo .cu-screenshot { margin: 0; }
.cu-screenshot-mobile {
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid #e2e8f0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.cu-screenshot-mobile a { display: block; }
.cu-screenshot-mobile img {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  object-position: top;
  display: block;
}
.cu-screenshot-mobile-caption {
  background: #fef9ec;
  padding: 0.3rem 0.6rem;
  font-size: 0.68rem;
  color: #92400e;
  border-top: 1px solid #fde68a;
  text-align: center;
}
@media (max-width: 640px) {
  .cu-screenshot-duo { grid-template-columns: 1fr; }
}
/* ── v2026.3: CU section title badges ── */
.cu-section-title { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.cu-section-badge {
  font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.7rem;
  border-radius: 999px; text-transform: uppercase; letter-spacing: 0.05em;
}
.cu-section-badge.role-admin         { background: var(--admin-light);         color: var(--admin); }
.cu-section-badge.role-generador     { background: var(--generador-light);     color: var(--generador); }
.cu-section-badge.role-transportista { background: var(--transportista-light); color: var(--transportista); }
.cu-section-badge.role-operador      { background: var(--operador-light);      color: var(--operador); }
.cu-section-badge.role-sistema       { background: var(--sistema-light);       color: var(--sistema); }
.cu-section-count { font-weight: 400; color: var(--text-secondary); font-size: 0.9rem; }
"""

if "cu-screenshot-duo" not in html:
    html = html.replace("</style>", NEW_CSS + "\n</style>", 1)
    print("✅ CSS agregado")
else:
    print("⏭️  CSS ya presente, saltando")

# ═══════════════════════════════════════════════════════════════════════════════
# PARTE 2 — FIX JS
# ═══════════════════════════════════════════════════════════════════════════════

# Fix 1: updateActiveNav — saltar secciones ocultas
OLD_UPDATE_NAV = """  function updateActiveNav() {
    var scrollTop = window.scrollY + 120;
    var current = '';
    sections.forEach(function(s) {
      if (s.offsetTop <= scrollTop) current = s.id;
    });
    navLinks.forEach(function(link) {
      var isActive = link.getAttribute('href') === '#' + current;
      link.classList.toggle('active', isActive);
      if (isActive) {
        // Mantener el link activo visible dentro del sidebar
        link.scrollIntoView({ block: 'nearest' });
      }
    });
  }"""

NEW_UPDATE_NAV = """  function updateActiveNav() {
    var scrollTop = window.scrollY + 120;
    var current = '';
    sections.forEach(function(s) {
      // v2026.3: saltar secciones ocultas (offsetTop=0 cuando display:none)
      if (s.offsetTop > 0 && s.style.display !== 'none' && s.offsetTop <= scrollTop) {
        current = s.id;
      }
    });
    navLinks.forEach(function(link) {
      if (link.style.display === 'none') return;
      var isActive = link.getAttribute('href') === '#' + current;
      link.classList.toggle('active', isActive);
      if (isActive) link.scrollIntoView({ block: 'nearest' });
    });
  }"""

if OLD_UPDATE_NAV in html:
    html = html.replace(OLD_UPDATE_NAV, NEW_UPDATE_NAV, 1)
    print("✅ Fix 1 aplicado: updateActiveNav salta secciones ocultas")
else:
    print("⚠️  Fix 1: no encontró bloque updateActiveNav exacto — verificar manualmente")

# Fix 2: Role tabs — filtrar nav + scroll al primer elemento + recalcular active
OLD_ROLE_TABS = """  // Role filter tabs
  roleTabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      roleTabs.forEach(function(t) { t.classList.remove('active'); });
      this.classList.add('active');
      currentRole = this.getAttribute('data-role');
      sections.forEach(function(sec) {
        var r = sec.getAttribute('data-role');
        sec.style.display = (currentRole === 'all' || r === 'all' || r === currentRole) ? '' : 'none';
      });
    });
  });"""

NEW_ROLE_TABS = """  // Role filter tabs — v2026.3: nav filter + scroll to first section + active recalc
  roleTabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      roleTabs.forEach(function(t) { t.classList.remove('active'); });
      this.classList.add('active');
      currentRole = this.getAttribute('data-role');

      // 1. Mostrar/ocultar secciones
      var firstVisible = null;
      sections.forEach(function(sec) {
        var r = sec.getAttribute('data-role');
        var visible = (currentRole === 'all' || r === 'all' || r === currentRole);
        sec.style.display = visible ? '' : 'none';
        if (visible && !firstVisible && r === currentRole) firstVisible = sec;
      });

      // 2. Ocultar/mostrar nav links según data-nav-role
      navLinks.forEach(function(link) {
        var nr = link.getAttribute('data-nav-role');
        if (nr && nr !== 'all') {
          link.style.display = (currentRole === 'all' || currentRole === nr) ? '' : 'none';
        }
      });

      // 3. Scroll a la primera sección del rol seleccionado
      if (firstVisible && currentRole !== 'all') {
        setTimeout(function() {
          firstVisible.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }

      // 4. Recalcular active después de scroll
      setTimeout(updateActiveNav, 300);
    });
  });"""

if OLD_ROLE_TABS in html:
    html = html.replace(OLD_ROLE_TABS, NEW_ROLE_TABS, 1)
    print("✅ Fix 2 aplicado: role tabs con nav filter + scroll + active recalc")
else:
    print("⚠️  Fix 2: no encontró bloque role tabs exacto — verificar manualmente")

# ═══════════════════════════════════════════════════════════════════════════════
# PARTE 3 — data-nav-role en nav links sección 7 y sección 2
# ═══════════════════════════════════════════════════════════════════════════════

nav_replacements = [
    # Sección 7 — CU subsections
    (
        '<a href="#cu-admin" class="nav-link">7.1 Administrador</a>',
        '<a href="#cu-admin" class="nav-link" data-nav-role="admin">7.1 Administrador</a>'
    ),
    (
        '<a href="#cu-generador" class="nav-link level-2">7.2 Generador</a>',
        '<a href="#cu-generador" class="nav-link level-2" data-nav-role="generador">7.2 Generador</a>'
    ),
    (
        '<a href="#cu-transportista" class="nav-link level-2">7.3 Transportista</a>',
        '<a href="#cu-transportista" class="nav-link level-2" data-nav-role="transportista">7.3 Transportista</a>'
    ),
    (
        '<a href="#cu-operador" class="nav-link level-2">7.4 Operador</a>',
        '<a href="#cu-operador" class="nav-link level-2" data-nav-role="operador">7.4 Operador</a>'
    ),
    (
        '<a href="#cu-sistema" class="nav-link level-2">7.5 Sistema</a>',
        '<a href="#cu-sistema" class="nav-link level-2" data-nav-role="all">7.5 Sistema</a>'
    ),
    (
        '<a href="#cu-resumen" class="nav-link level-2">7.6 Resumen</a>',
        '<a href="#cu-resumen" class="nav-link level-2" data-nav-role="all">7.6 Resumen</a>'
    ),
    # Sección 2 — Guía rápida por rol
    (
        '<a href="#guia-admin" class="nav-link">2.1 Administrador</a>',
        '<a href="#guia-admin" class="nav-link" data-nav-role="admin">2.1 Administrador</a>'
    ),
    (
        '<a href="#guia-generador" class="nav-link level-2">2.2 Generador</a>',
        '<a href="#guia-generador" class="nav-link level-2" data-nav-role="generador">2.2 Generador</a>'
    ),
    (
        '<a href="#guia-transportista" class="nav-link level-2">2.3 Transportista</a>',
        '<a href="#guia-transportista" class="nav-link level-2" data-nav-role="transportista">2.3 Transportista</a>'
    ),
    (
        '<a href="#guia-operador" class="nav-link level-2">2.4 Operador</a>',
        '<a href="#guia-operador" class="nav-link level-2" data-nav-role="operador">2.4 Operador</a>'
    ),
]

for old, new in nav_replacements:
    if old in html:
        html = html.replace(old, new, 1)
        print(f"✅ data-nav-role: {old[:60]}...")
    else:
        print(f"⚠️  No encontrado: {old[:60]}...")

# ═══════════════════════════════════════════════════════════════════════════════
# PARTE 4 — H3 badges en subsecciones CU
# ═══════════════════════════════════════════════════════════════════════════════

h3_replacements = [
    (
        '<h3>7.1 Administrador DGFA (19 casos)</h3>',
        '<h3 class="cu-section-title"><span class="cu-section-badge role-admin">Administrador</span>7.1 Administrador DGFA <span class="cu-section-count">(19 casos)</span></h3>'
    ),
    (
        '<h3>7.2 Generador (12 casos)</h3>',
        '<h3 class="cu-section-title"><span class="cu-section-badge role-generador">Generador</span>7.2 Generador <span class="cu-section-count">(12 casos)</span></h3>'
    ),
    (
        '<h3>7.3 Transportista (12 casos)</h3>',
        '<h3 class="cu-section-title"><span class="cu-section-badge role-transportista">Transportista</span>7.3 Transportista <span class="cu-section-count">(12 casos)</span></h3>'
    ),
    (
        '<h3>7.4 Operador (11 casos)</h3>',
        '<h3 class="cu-section-title"><span class="cu-section-badge role-operador">Operador</span>7.4 Operador <span class="cu-section-count">(11 casos)</span></h3>'
    ),
    (
        '<h3>7.5 Sistema (12 casos)</h3>',
        '<h3 class="cu-section-title"><span class="cu-section-badge role-sistema">Sistema</span>7.5 Sistema <span class="cu-section-count">(12 casos)</span></h3>'
    ),
]

for old, new in h3_replacements:
    if old in html:
        html = html.replace(old, new, 1)
        print(f"✅ H3 badge: {old[:50]}...")
    else:
        # Try to find the actual h3 text
        m = re.search(r'<h3>(7\.[1-5][^<]*)</h3>', html)
        print(f"⚠️  No encontrado: {old[:50]}...")

# ═══════════════════════════════════════════════════════════════════════════════
# PARTE 5 — Duo screenshots (19 CUs)
# ═══════════════════════════════════════════════════════════════════════════════

# Mapa: CU collapsible header text → mobile file + caption
CU_MOBILE_MAP = [
    ("CU-A01: Gestionar Usuarios del Sistema",      "M05_usuarios_mobile.png",                   "Usuarios — móvil"),
    ("CU-A07: Visualizar Dashboard General",         "M02_dashboard_admin_mobile.png",             "Dashboard Admin — móvil"),
    ("CU-A09: Generar Reportes",                     "M04_reportes_mobile.png",                   "Reportes — móvil"),
    ("CU-A11: Gestionar Alertas",                    "M03_alertas_mobile.png",                    "Alertas — móvil"),
    ("CU-G01: Crear Manifiesto",                     "M09_nuevo_manifiesto_paso1_mobile.png",      "Nuevo manifiesto — móvil"),
    ("CU-G03: Consultar Manifiestos Propios",        "M07_manifiestos_generador_mobile.png",       "Mis manifiestos — móvil"),
    ("CU-G04: Ver Detalle de Manifiesto",            "M25_manifiesto_detalle_generador_mobile.png","Detalle manifiesto — móvil"),
    ("CU-G09: Visualizar Dashboard de Generador",   "M06_dashboard_generador_mobile.png",         "Dashboard generador — móvil"),
    ("CU-T01: Ver Manifiestos Asignados",            "M13_manifiestos_transportista_mobile.png",   "Manifiestos asignados — móvil"),
    ("CU-T02: Confirmar Retiro de Residuos",         "M21_tomar_viaje_mobile.png",                 "Tomar viaje — móvil"),
    ("CU-T03: Tracking GPS en Tiempo Real",          "M22_viaje_gps_activo_mobile.png",            "GPS activo — móvil"),
    ("CU-T07: Escanear Codigo QR",                   "M15_escaner_qr_mobile.png",                  "Escáner QR — móvil"),
    ("CU-T08: Visualizar Dashboard de Transportista","M10_dashboard_transportista_mobile.png",     "Dashboard transportista — móvil"),
    ("CU-T11: Gestionar Perfil",                     "M12_transporte_perfil_info_mobile.png",      "Perfil transportista — móvil"),
    ("CU-O01: Ver Manifiestos Entrantes",            "M18_manifiestos_operador_mobile.png",        "Manifiestos entrantes — móvil"),
    ("CU-O02: Confirmar Recepcion",                  "M23_manifiesto_entregado_operador_mobile.png","Confirmar recepción — móvil"),
    ("CU-O03: Registrar Pesaje Real",                "M24_pesaje_modal_mobile.png",                "Pesaje — móvil"),
    ("CU-O09: Visualizar Dashboard de Operador",    "M17_dashboard_operador_mobile.png",          "Dashboard operador — móvil"),
    ("CU-S08: Sincronizar Datos Offline",            "M16_configuracion_mobile.png",               "Configuración offline — móvil"),
]

def make_mobile_div(mobile_file, mobile_caption):
    return (
        f'\n<div class="cu-screenshot-mobile">'
        f'<a href="screenshots/mobile/{mobile_file}" target="_blank">'
        f'<img src="screenshots/mobile/{mobile_file}" alt="{mobile_caption}" loading="lazy">'
        f'</a>'
        f'<div class="cu-screenshot-mobile-caption">📱 Móvil</div>'
        f'</div>\n</div>'
    )

if not already_applied:
    for cu_header, mobile_file, mobile_caption in CU_MOBILE_MAP:
        # Pattern: find collapsible-header with this CU, then find its next cu-screenshot div
        # We look for the pattern: header → collapsible-body → cu-screenshot
        header_pattern = f'<div class="collapsible-header" onclick="toggleCollapsible(this)">{re.escape(cu_header)}</div>'

        if cu_header not in html:
            print(f"⚠️  No encontrado CU header: {cu_header}")
            continue

        # Find position of this CU header
        header_pos = html.find(f'>{cu_header}</div>')
        if header_pos == -1:
            print(f"⚠️  No encontrado: {cu_header}")
            continue

        # From header_pos, find the next <div class="cu-screenshot">
        # Search forward from this position
        search_start = header_pos
        screenshot_pattern = '<div class="cu-screenshot">'

        # Find first screenshot after this header
        ss_pos = html.find(screenshot_pattern, search_start)
        if ss_pos == -1:
            print(f"⚠️  No cu-screenshot después de: {cu_header}")
            continue

        # Find the end of this screenshot div (must balance tags)
        # The screenshot div is self-contained in one line: <div class="cu-screenshot">...</div>
        # Find closing </div> for the screenshot (it's a single nested structure)
        # Pattern: <div class="cu-screenshot"><a...><img...></a><div class="cu-screenshot-caption">...</div></div>
        # We need to find the complete div by counting nesting
        pos = ss_pos + len(screenshot_pattern)
        depth = 1
        while pos < len(html) and depth > 0:
            next_open = html.find('<div', pos)
            next_close = html.find('</div>', pos)
            if next_close == -1:
                break
            if next_open != -1 and next_open < next_close:
                depth += 1
                pos = next_open + 4
            else:
                depth -= 1
                pos = next_close + 6

        screenshot_end = pos
        screenshot_block = html[ss_pos:screenshot_end]

        # Build the duo wrapper
        duo_block = (
            '<div class="cu-screenshot-duo">\n'
            + screenshot_block
            + make_mobile_div(mobile_file, mobile_caption)
        )

        # Replace only the first occurrence after the header
        # We replace in the substring from header_pos onward to avoid replacing wrong screenshots
        before = html[:ss_pos]
        after = html[screenshot_end:]
        html = before + duo_block + after
        print(f"✅ Duo screenshot: {cu_header[:45]}... → {mobile_file}")
else:
    print("⏭️  Saltando duo screenshots (ya aplicado)")

# ═══════════════════════════════════════════════════════════════════════════════
# ESCRIBIR RESULTADO
# ═══════════════════════════════════════════════════════════════════════════════

with open(HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html)

print(f"\n✅ Escrito: {HTML_PATH}")
print(f"   Tamaño: {len(html):,} bytes")
