#!/usr/bin/env python3
"""
verify-actor-data.py — Verifica datos de actores en BD produccion vs archivos fuente oficiales.

Compara generadores, operadores y transportistas entre los archivos DPA Mendoza
y la API de produccion SITREP, reportando discrepancias.

Un mismo CUIT puede tener multiples roles (Generador + Operador + Transportista).
El script verifica cada tabla de actor independientemente.

Uso:
  python3 backend/tests/verify-actor-data.py                             # vs produccion
  python3 backend/tests/verify-actor-data.py --api http://localhost:3010  # vs local

Dependencias: python3, openpyxl (pip3 install openpyxl)
"""

import argparse
import csv
import io
import json
import os
import re
import sys
import urllib.request
import urllib.error

# ============================================================
# ANSI colors
# ============================================================
RED = '\033[91m'
GREEN = '\033[92m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
CYAN = '\033[96m'
MAGENTA = '\033[95m'
BOLD = '\033[1m'
DIM = '\033[2m'
RESET = '\033[0m'

# ============================================================
# Config
# ============================================================
DEFAULT_API = 'https://sitrep.ultimamilla.com.ar/api'
LOGIN_EMAIL = 'admin@dgfa.mendoza.gov.ar'
LOGIN_PASS = 'admin123'

DEMO_CUITS = {
    '30-12345678-9', '30-87654321-0', '30-56789012-3',
    '30-34567890-1', '30-09876543-2', '30-13579246-8', '30-24681357-9',
}

# ============================================================
# Paths (relative to project root)
# ============================================================
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))

GENERADORES_CSV = os.path.join(PROJECT_ROOT, 'docs', 'data', 'generadores21012926')
OPERADORES_CSV = os.path.join(PROJECT_ROOT, 'docs', 'data', 'operadores050226csv')
TRANSPORTISTAS_XLSX = os.path.join(PROJECT_ROOT, 'Registro Pcial de Transportistas de RRPP.xlsx')
CUITS_JSON = os.path.join(PROJECT_ROOT, 'backend', 'prisma', 'cuits-encontrados.json')


# ============================================================
# CSV parser (handles multiline quoted fields)
# ============================================================
def parse_csv_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    reader = csv.reader(io.StringIO(content))
    rows = list(reader)
    return rows[0], rows[1:]


# ============================================================
# CUIT normalization & validation
# ============================================================
CUIT_PATTERN = re.compile(r'^\d{2}-\d{8}-\d$')


def normalize_cuit(raw):
    return (raw or '').strip().replace(' ', '')


def is_valid_cuit(cuit):
    return bool(CUIT_PATTERN.match(cuit))


def is_placeholder_cuit(cuit):
    return cuit.startswith('CAA-T-')


def is_demo_cuit(cuit):
    return cuit in DEMO_CUITS


# ============================================================
# Certificado normalizer
# ============================================================
def normalize_cert(cert):
    s = re.sub(r'\s+', ' ', cert).strip()
    s = re.sub(r'\s*[–—\-]\s*', '-', s)
    return s


def normalize_caa(caa):
    s = caa.strip()
    s = re.sub(r'\s*[–—\-]\s*', '-', s)
    s = re.sub(r'^T-\s*', 'T-', s)
    return s


# ============================================================
# API helpers
# ============================================================
def api_request(url, token=None, data=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    body = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=body, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8', errors='replace')
        print(f'{RED}API Error {e.code}: {url}{RESET}')
        print(f'{DIM}{error_body[:200]}{RESET}')
        return None
    except urllib.error.URLError as e:
        print(f'{RED}Connection error: {e.reason}{RESET}')
        return None


def api_login(base_url):
    result = api_request(f'{base_url}/auth/login', data={
        'email': LOGIN_EMAIL,
        'password': LOGIN_PASS,
    })
    if not result:
        return None
    if 'token' in result:
        return result['token']
    data = result.get('data', {})
    if isinstance(data, dict):
        if 'token' in data:
            return data['token']
        tokens = data.get('tokens', {})
        if isinstance(tokens, dict) and 'accessToken' in tokens:
            return tokens['accessToken']
    print(f'{RED}Login failed. Response keys: {list(result.keys())}{RESET}')
    return None


def extract_list(resp, key):
    """Extract list from API response: {success, data: {key: [...]}}"""
    if resp is None:
        return []
    if isinstance(resp, list):
        return resp
    data = resp.get('data', resp)
    if isinstance(data, dict):
        if key in data and isinstance(data[key], list):
            return data[key]
        for v in data.values():
            if isinstance(v, list):
                return v
    if isinstance(data, list):
        return data
    return []


# ============================================================
# Phase 1: Load source data
# ============================================================
def load_generadores_source():
    print(f'\n{BOLD}--- Cargando generadores fuente ---{RESET}')
    if not os.path.exists(GENERADORES_CSV):
        print(f'{RED}Archivo no encontrado: {GENERADORES_CSV}{RESET}')
        return {}, {}

    header, data_rows = parse_csv_file(GENERADORES_CSV)
    print(f'  Filas: {len(data_rows)}, Columnas: {len(header)}')

    by_cuit = {}
    stats = {'total_rows': len(data_rows), 'empty_cuit': 0, 'malformed_cuit': 0, 'duplicates': 0}
    malformed = []

    for row in data_rows:
        cuit_raw = row[3].strip() if len(row) > 3 else ''
        if not cuit_raw:
            stats['empty_cuit'] += 1
            continue

        cuit = normalize_cuit(cuit_raw)
        if not is_valid_cuit(cuit):
            stats['malformed_cuit'] += 1
            malformed.append((cuit, row[2].strip() if len(row) > 2 else '?'))
            continue

        if cuit in by_cuit:
            stats['duplicates'] += 1
            continue

        cert = normalize_cert(row[0]) if row[0] else ''
        razon = row[2].strip() if len(row) > 2 else ''
        dom_parts = [row[6].strip(), row[7].strip(), row[8].strip()] if len(row) > 8 else []
        domicilio = ', '.join(p for p in dom_parts if p) or 'Sin datos'
        email_raw = row[12].strip() if len(row) > 12 else ''
        emails = [e.strip() for e in re.split(r'[,;\s]+', email_raw) if '@' in e]
        telefono = row[13].strip() if len(row) > 13 else ''
        categorias = row[15].strip() if len(row) > 15 else ''

        by_cuit[cuit] = {
            'certificado': cert, 'razonSocial': razon, 'cuit': cuit,
            'domicilio': domicilio, 'email': emails[0] if emails else '',
            'telefono': telefono, 'categoria': categorias,
        }

    print(f'  CUITs validos unicos: {BOLD}{len(by_cuit)}{RESET}')
    print(f'  Vacios: {stats["empty_cuit"]}, Malformados: {stats["malformed_cuit"]}, Duplicados: {stats["duplicates"]}')
    if malformed:
        print(f'  {YELLOW}CUITs malformados:{RESET}')
        for cuit, razon in malformed:
            print(f'    [{cuit}] {razon}')

    return by_cuit, stats


def load_operadores_source():
    print(f'\n{BOLD}--- Cargando operadores fuente ---{RESET}')
    if not os.path.exists(OPERADORES_CSV):
        print(f'{RED}Archivo no encontrado: {OPERADORES_CSV}{RESET}')
        return {}, {}

    header, data_rows = parse_csv_file(OPERADORES_CSV)
    print(f'  Filas: {len(data_rows)}, Columnas: {len(header)}')

    by_cuit = {}
    stats = {'total_rows': len(data_rows), 'empty_cuit': 0, 'duplicates': 0}

    for row in data_rows:
        cuit = normalize_cuit(row[3]) if len(row) > 3 else ''
        if not cuit:
            stats['empty_cuit'] += 1
            continue

        cert = normalize_cert(row[0]) if row[0] else ''
        empresa = row[2].strip() if len(row) > 2 else ''
        telefono = row[4].strip() if len(row) > 4 else ''
        email = row[5].strip() if len(row) > 5 else ''
        dom_parts = [row[6].strip(), row[7].strip(), row[8].strip()] if len(row) > 8 else []
        domicilio = ', '.join(p for p in dom_parts if p)
        categoria = row[12].strip() if len(row) > 12 else ''
        tecnologia = row[13].strip() if len(row) > 13 else ''
        corrientes = row[14].strip() if len(row) > 14 else ''

        if cuit in by_cuit:
            existing = by_cuit[cuit]
            existing['certificados'].append(cert)
            existing['categorias'].append(categoria)
            existing['tecnologias'].append(tecnologia)
            existing['corrientes_raw'].append(corrientes)
            stats['duplicates'] += 1
        else:
            by_cuit[cuit] = {
                'certificados': [cert], 'razonSocial': empresa, 'cuit': cuit,
                'domicilio': domicilio, 'telefono': telefono, 'email': email,
                'categorias': [categoria], 'tecnologias': [tecnologia],
                'corrientes_raw': [corrientes],
            }

    for data in by_cuit.values():
        data['certificado'] = ' / '.join(data['certificados'])
        data['categoria'] = ' / '.join(sorted(set(data['categorias'])))

    print(f'  CUITs unicos: {BOLD}{len(by_cuit)}{RESET}')
    print(f'  Vacios: {stats["empty_cuit"]}, Duplicados (merged): {stats["duplicates"]}')

    return by_cuit, stats


def load_transportistas_source():
    print(f'\n{BOLD}--- Cargando transportistas fuente ---{RESET}')
    if not os.path.exists(TRANSPORTISTAS_XLSX):
        print(f'{RED}Archivo no encontrado: {TRANSPORTISTAS_XLSX}{RESET}')
        return {}, {}

    import openpyxl
    wb = openpyxl.load_workbook(TRANSPORTISTAS_XLSX, read_only=True)
    ws = wb.active
    all_rows = list(ws.iter_rows(values_only=True))
    wb.close()

    header_idx = 0
    for i, row in enumerate(all_rows[:5]):
        vals = [str(v or '').upper() for v in row]
        if any('CAA' in v or 'RAZ' in v for v in vals):
            header_idx = i
            break

    data_rows = [r for r in all_rows[header_idx + 1:]
                 if any(v for v in r if v is not None and str(v).strip())]

    print(f'  Filas: {len(data_rows)} (header en fila {header_idx})')

    cuits_map = {}
    if os.path.exists(CUITS_JSON):
        try:
            cuits_data = json.load(open(CUITS_JSON, 'r'))
            for entry in cuits_data:
                if entry.get('cuitEncontrado'):
                    cuits_map[normalize_caa(entry['caa'])] = normalize_cuit(entry['cuitEncontrado'])
            if cuits_map:
                print(f'  CUITs confirmados (json): {len(cuits_map)}')
        except Exception:
            pass

    by_caa = {}
    stats = {'total_rows': len(data_rows), 'with_cuit': 0, 'placeholder_cuit': 0}

    for row in data_rows:
        caa_raw = str(row[0] or '').strip()
        razon = str(row[1] or '').strip()
        cuit_raw = normalize_cuit(str(row[2] or ''))

        if not caa_raw and not razon:
            continue

        caa = normalize_caa(caa_raw)
        cuit = cuit_raw
        if not cuit and caa in cuits_map:
            cuit = cuits_map[caa]
        if not cuit:
            caa_num = re.sub(r'[^0-9]', '', caa_raw).zfill(6)
            cuit = f'CAA-T-{caa_num}'
            stats['placeholder_cuit'] += 1
        else:
            stats['with_cuit'] += 1

        domicilio_base = str(row[4] or '').strip() if len(row) > 4 else ''
        localidad = str(row[5] or '').strip() if len(row) > 5 else ''
        domicilio = ', '.join(p for p in [domicilio_base, localidad] if p) or 'Sin datos'

        by_caa[caa] = {
            'caa': caa, 'razonSocial': razon, 'cuit': cuit, 'domicilio': domicilio,
            'corrientes': str(row[6] or '').strip() if len(row) > 6 else '',
            'vencimiento': str(row[7] or '').strip() if len(row) > 7 else '',
            'resolucionDPA': str(row[8] or '').strip() if len(row) > 8 else '',
            'resolucionSSP': str(row[9] or '').strip() if len(row) > 9 else '',
            'expedienteDPA': str(row[3] or '').strip() if len(row) > 3 else '',
            'unidades': str(row[11] or '').strip() if len(row) > 11 else '',
        }

    print(f'  CAAs unicos: {BOLD}{len(by_caa)}{RESET}')
    print(f'  Con CUIT real: {stats["with_cuit"]}, Placeholder: {stats["placeholder_cuit"]}')

    return by_caa, stats


# ============================================================
# Phase 2: Query API & build cross-role index
# ============================================================
def fetch_api_data(base_url, token):
    print(f'\n{BOLD}--- Consultando API ---{RESET}')

    gen_list = extract_list(api_request(f'{base_url}/catalogos/generadores', token), 'generadores')
    trans_list = extract_list(api_request(f'{base_url}/catalogos/transportistas', token), 'transportistas')
    oper_list = extract_list(api_request(f'{base_url}/catalogos/operadores', token), 'operadores')

    print(f'  Generadores: {len(gen_list)}, Transportistas: {len(trans_list)}, Operadores: {len(oper_list)}')

    return gen_list, trans_list, oper_list


def build_cuit_role_index(gen_list, trans_list, oper_list):
    """Build CUIT → set of roles present in BD (across all 3 actor tables)."""
    index = {}  # cuit → {role: razonSocial}
    for g in gen_list:
        c = normalize_cuit(g.get('cuit', ''))
        if c:
            index.setdefault(c, {})['GENERADOR'] = g.get('razonSocial', '?')
    for t in trans_list:
        c = normalize_cuit(t.get('cuit', ''))
        if c:
            index.setdefault(c, {})['TRANSPORTISTA'] = t.get('razonSocial', '?')
    for o in oper_list:
        c = normalize_cuit(o.get('cuit', ''))
        if c:
            index.setdefault(c, {})['OPERADOR'] = o.get('razonSocial', '?')
    return index


# ============================================================
# Phase 3: Comparison functions
# ============================================================
def compare_entity(entity_name, role_name, source_by_key, db_list, cuit_role_index,
                   key_field='cuit', source_key_fn=None, db_key_fn=None):
    """
    Generic comparison: source vs DB for a specific entity/role.
    key_field: field used to match (cuit for gen/oper, caa for trans)
    source_key_fn: extract key from source dict
    db_key_fn: extract key from DB dict
    """
    print(f'\n{BOLD}{"=" * 66}{RESET}')
    print(f'{BOLD}  {entity_name.upper()}: fuente vs BD{RESET}')
    print(f'{BOLD}{"=" * 66}{RESET}')

    if source_key_fn is None:
        source_key_fn = lambda d: d.get('cuit', '')
    if db_key_fn is None:
        db_key_fn = lambda d: normalize_cuit(d.get('cuit', ''))

    # Build DB lookup
    db_by_key = {}
    for item in db_list:
        k = db_key_fn(item)
        if k:
            db_by_key[k] = item

    print(f'  Fuente: {len(source_by_key)}')
    print(f'  BD:     {len(db_by_key)}')

    # --- MISSING (in source, not in BD for this role) ---
    missing = []
    for key, data in sorted(source_by_key.items()):
        if key not in db_by_key:
            missing.append((key, data))

    # --- EXTRA (in BD, not in source) ---
    source_keys = set(source_by_key.keys())
    extra = []
    extra_malformed = []
    demo = []
    for key, item in sorted(db_by_key.items()):
        if key not in source_keys:
            cuit = normalize_cuit(item.get('cuit', ''))
            razon = item.get('razonSocial', '?')
            if is_demo_cuit(cuit):
                demo.append((key, cuit, razon))
            elif not is_valid_cuit(cuit) and not is_placeholder_cuit(cuit):
                extra_malformed.append((key, cuit, razon))
            else:
                extra.append((key, cuit, razon))

    # --- FIELD MISMATCHES ---
    mismatches = []
    for key in sorted(source_by_key):
        if key not in db_by_key:
            continue
        src = source_by_key[key]
        db = db_by_key[key]
        diffs = []
        src_razon = src.get('razonSocial', '').strip()
        db_razon = (db.get('razonSocial') or '').strip()
        if src_razon.lower() != db_razon.lower() and src_razon and db_razon:
            diffs.append(('razonSocial', src_razon[:60], db_razon[:60]))
        if diffs:
            mismatches.append((key, diffs))

    # --- NULL FIELDS (for transportistas) ---
    null_fields = {}
    if entity_name.lower() == 'transportistas':
        check_fields = [
            ('expedienteDPA', 'expedienteDPA'),
            ('corrientes', 'corrientesAutorizadas'),
            ('resolucionDPA', 'resolucionDPA'),
            ('resolucionSSP', 'resolucionSSP'),
            ('vencimiento', 'vencimientoHabilitacion'),
        ]
        matched_count = 0
        for key, data in source_by_key.items():
            db_entry = db_by_key.get(key)
            if not db_entry:
                continue
            matched_count += 1
            for src_field, db_field in check_fields:
                src_val = data.get(src_field, '').strip()
                db_val = db_entry.get(db_field)
                if src_val and (db_val is None or str(db_val).strip() in ('', 'None')):
                    null_fields.setdefault(db_field, {'null': 0, 'total': 0})
                    null_fields[db_field]['null'] += 1
            for src_field, db_field in check_fields:
                null_fields.setdefault(db_field, {'null': 0, 'total': 0})
                null_fields[db_field]['total'] = matched_count

    # ===== REPORT =====

    # Missing
    print(f'\n  {RED}FALTANTES: {len(missing)}{RESET}')
    for key, data in missing:
        cuit = data.get('cuit', key)
        razon = data.get('razonSocial', '?')[:60]
        cert = data.get('certificado', data.get('caa', ''))

        # Cross-role: is this CUIT present in BD under a DIFFERENT role?
        other_roles = []
        if cuit in cuit_role_index:
            for r, rname in cuit_role_index[cuit].items():
                if r != role_name:
                    other_roles.append(r)

        cross_info = ''
        if other_roles:
            cross_info = f' {MAGENTA}(en BD como: {", ".join(other_roles)}){RESET}'

        print(f'    {RED}✗{RESET} {cuit} — {razon} [{cert}]{cross_info}')

    # Extra valid
    if extra:
        print(f'\n  {YELLOW}EXTRAS en BD (no en fuente): {len(extra)}{RESET}')
        for key, cuit, razon in extra:
            print(f'    {YELLOW}?{RESET} {cuit} — {razon[:60]}')

    # Extra malformed CUITs
    if extra_malformed:
        print(f'\n  {YELLOW}EN BD CON CUIT MALFORMADO: {len(extra_malformed)}{RESET}')
        for key, cuit, razon in extra_malformed:
            print(f'    {YELLOW}!{RESET} [{cuit}] — {razon[:60]}')

    # Demo
    if demo:
        print(f'\n  {CYAN}DEMO/SEED: {len(demo)}{RESET}')
        for key, cuit, razon in demo:
            print(f'    {CYAN}*{RESET} {cuit} — {razon[:60]}')

    # Mismatches
    if mismatches:
        print(f'\n  {YELLOW}CAMPOS DIFERENTES (mismo CUIT): {len(mismatches)}{RESET}')
        for key, diffs in mismatches[:10]:
            for field, src_val, db_val in diffs:
                print(f'    {key}: {field}: fuente=[{src_val}] vs bd=[{db_val}]')
        if len(mismatches) > 10:
            print(f'    ... y {len(mismatches) - 10} mas')

    # Null fields
    if null_fields:
        print(f'\n  {YELLOW}CAMPOS NULL en BD (dato existe en fuente):{RESET}')
        for field, counts in sorted(null_fields.items(), key=lambda x: -x[1]['null']):
            if counts['null'] > 0:
                total = counts['total']
                pct = round(counts['null'] / total * 100) if total else 0
                print(f'    {field}: {counts["null"]}/{total} con NULL ({pct}%)')

    matched = len(source_by_key) - len(missing)
    return {
        'source_count': len(source_by_key),
        'db_count': len(db_by_key),
        'matched': matched,
        'missing': len(missing),
        'extra': len(extra),
        'extra_malformed': len(extra_malformed),
        'demo': len(demo),
        'mismatches': len(mismatches),
        'null_fields': null_fields,
        'coverage_pct': round(matched / len(source_by_key) * 100, 1) if source_by_key else 0,
    }


# ============================================================
# Phase 4: Cross-role analysis
# ============================================================
def cross_role_analysis(gen_source, oper_source, trans_source, cuit_role_index):
    """Show CUITs that appear in multiple source files and whether BD has all roles."""
    print(f'\n{BOLD}{"=" * 66}{RESET}')
    print(f'{BOLD}  ANALISIS CROSS-ROLE: CUITs con multiples roles{RESET}')
    print(f'{BOLD}{"=" * 66}{RESET}')

    # Collect CUITs from all sources
    src_roles = {}  # cuit → set of expected roles
    for cuit in gen_source:
        src_roles.setdefault(cuit, set()).add('GENERADOR')
    for cuit in oper_source:
        src_roles.setdefault(cuit, set()).add('OPERADOR')
    for caa, data in trans_source.items():
        cuit = data.get('cuit', '')
        if cuit and not is_placeholder_cuit(cuit):
            src_roles.setdefault(cuit, set()).add('TRANSPORTISTA')

    multi_role_cuits = {c: r for c, r in src_roles.items() if len(r) > 1}

    if not multi_role_cuits:
        print(f'  Ningun CUIT aparece en multiples archivos fuente.')
        return

    print(f'\n  CUITs con multiples roles en archivos fuente: {BOLD}{len(multi_role_cuits)}{RESET}')

    all_ok = 0
    partial = 0
    missing_all = 0

    for cuit in sorted(multi_role_cuits):
        expected = multi_role_cuits[cuit]
        actual = set(cuit_role_index.get(cuit, {}).keys())
        missing_roles = expected - actual

        # Get razonSocial from any source
        razon = ''
        if cuit in gen_source:
            razon = gen_source[cuit].get('razonSocial', '')
        elif cuit in oper_source:
            razon = oper_source[cuit].get('razonSocial', '')

        expected_str = '+'.join(sorted(expected))
        actual_str = '+'.join(sorted(actual)) if actual else 'NINGUNO'

        if not missing_roles:
            all_ok += 1
            print(f'    {GREEN}OK{RESET}  {cuit} — {razon[:45]} [{expected_str}]')
        else:
            missing_str = ', '.join(sorted(missing_roles))
            if actual:
                partial += 1
                print(f'    {YELLOW}!!{RESET}  {cuit} — {razon[:45]} esperado=[{expected_str}] actual=[{actual_str}] {RED}falta: {missing_str}{RESET}')
            else:
                missing_all += 1
                print(f'    {RED}XX{RESET}  {cuit} — {razon[:45]} esperado=[{expected_str}] {RED}NO EXISTE EN BD{RESET}')

    print(f'\n  Resumen multi-rol: {GREEN}{all_ok} OK{RESET}, {YELLOW}{partial} parcial{RESET}, {RED}{missing_all} sin ningun rol{RESET}')


# ============================================================
# Phase 5: Summary
# ============================================================
def print_summary(results_list):
    print(f'\n{BOLD}{"=" * 72}{RESET}')
    print(f'{BOLD}  RESUMEN DE VERIFICACION{RESET}')
    print(f'{BOLD}{"=" * 72}{RESET}')

    headers = ['', 'Fuente', 'BD', 'Match', 'Faltan', 'Extra', 'Malform', 'Demo', 'Cobert.']
    widths = [16, 7, 7, 7, 7, 6, 7, 5, 8]

    def fmt_row(vals, color=''):
        parts = []
        for v, w in zip(vals, widths):
            parts.append(str(v).rjust(w))
        line = ' | '.join(parts)
        return f'  {color}{line}{RESET}' if color else f'  {line}'

    print(fmt_row(headers, BOLD))
    print(f'  {"-" * (sum(widths) + 3 * (len(widths) - 1))}')

    total_source = 0
    total_matched = 0
    total_missing = 0

    for name, r in results_list:
        if not r:
            continue
        cov = r['coverage_pct']
        color = GREEN if cov >= 99 else YELLOW if cov >= 95 else RED
        vals = [
            name, r['source_count'], r['db_count'], r['matched'],
            r['missing'], r['extra'], r['extra_malformed'], r['demo'],
            f'{cov}%',
        ]
        print(fmt_row(vals, color))
        total_source += r['source_count']
        total_matched += r['matched']
        total_missing += r['missing']

    print(f'  {"-" * (sum(widths) + 3 * (len(widths) - 1))}')

    overall_pct = round(total_matched / total_source * 100, 1) if total_source else 0
    color = GREEN if overall_pct >= 99 else YELLOW if overall_pct >= 95 else RED

    print(f'\n  {BOLD}Total:{RESET} {total_matched}/{total_source} verificados ({color}{overall_pct}%{RESET})')
    print(f'  {BOLD}Faltantes:{RESET} {RED}{total_missing}{RESET}')

    if total_missing == 0:
        print(f'\n  {GREEN}PASS — Todos los actores fuente estan en la BD{RESET}')
    else:
        print(f'\n  {RED}FAIL — {total_missing} actores fuente no encontrados en la BD{RESET}')

    return total_missing


# ============================================================
# Main
# ============================================================
def main():
    parser = argparse.ArgumentParser(description='Verifica datos de actores en BD vs archivos fuente')
    parser.add_argument('--api', default=DEFAULT_API, help=f'Base URL de la API (default: {DEFAULT_API})')
    parser.add_argument('--no-color', action='store_true', help='Desactivar colores ANSI')
    args = parser.parse_args()

    if args.no_color:
        global RED, GREEN, YELLOW, BLUE, CYAN, MAGENTA, BOLD, DIM, RESET
        RED = GREEN = YELLOW = BLUE = CYAN = MAGENTA = BOLD = DIM = RESET = ''

    base_url = args.api.rstrip('/')
    if not base_url.endswith('/api'):
        base_url = base_url + '/api' if not base_url.endswith('/') else base_url + 'api'

    print(f'{BOLD}SITREP — Verificacion de Datos de Actores{RESET}')
    print(f'API: {base_url}')
    print(f'Fecha: {__import__("datetime").datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print(f'{DIM}Un mismo CUIT puede tener multiples roles (Gen+Oper+Trans){RESET}')

    # Phase 1
    print(f'\n{BOLD}{"=" * 66}{RESET}')
    print(f'{BOLD}  PHASE 1: CARGA DE ARCHIVOS FUENTE{RESET}')
    print(f'{BOLD}{"=" * 66}{RESET}')
    gen_source, _ = load_generadores_source()
    oper_source, _ = load_operadores_source()
    trans_source, _ = load_transportistas_source()

    if not gen_source and not oper_source and not trans_source:
        print(f'{RED}No se pudo cargar ningun archivo fuente.{RESET}')
        sys.exit(1)

    # Phase 2
    print(f'\n{BOLD}{"=" * 66}{RESET}')
    print(f'{BOLD}  PHASE 2: CONSULTA API{RESET}')
    print(f'{BOLD}{"=" * 66}{RESET}')

    token = api_login(base_url)
    if not token:
        print(f'{RED}Login fallido.{RESET}')
        sys.exit(1)
    print(f'  {GREEN}Login OK{RESET}')

    gen_db, trans_db, oper_db = fetch_api_data(base_url, token)

    # Build cross-role index
    cuit_role_index = build_cuit_role_index(gen_db, trans_db, oper_db)
    multi_in_bd = sum(1 for roles in cuit_role_index.values() if len(roles) > 1)
    print(f'  CUITs con multiples roles en BD: {BOLD}{multi_in_bd}{RESET}')

    # Phase 3: Compare each entity
    print(f'\n{BOLD}{"=" * 66}{RESET}')
    print(f'{BOLD}  PHASE 3: COMPARACION POR ENTIDAD{RESET}')
    print(f'{BOLD}{"=" * 66}{RESET}')

    gen_results = compare_entity(
        'Generadores', 'GENERADOR', gen_source, gen_db, cuit_role_index,
        key_field='cuit',
        source_key_fn=lambda d: d.get('cuit', ''),
        db_key_fn=lambda d: normalize_cuit(d.get('cuit', '')),
    ) if gen_source else None

    oper_results = compare_entity(
        'Operadores', 'OPERADOR', oper_source, oper_db, cuit_role_index,
        key_field='cuit',
        source_key_fn=lambda d: d.get('cuit', ''),
        db_key_fn=lambda d: normalize_cuit(d.get('cuit', '')),
    ) if oper_source else None

    # Transportistas: match by CAA (numeroHabilitacion), not by CUIT
    trans_results = compare_entity(
        'Transportistas', 'TRANSPORTISTA', trans_source, trans_db, cuit_role_index,
        key_field='caa',
        source_key_fn=lambda d: d.get('caa', ''),
        db_key_fn=lambda d: normalize_caa(d.get('numeroHabilitacion', '') or ''),
    ) if trans_source else None

    # Phase 4: Cross-role
    cross_role_analysis(gen_source, oper_source, trans_source, cuit_role_index)

    # Phase 5: Summary
    results_list = [
        ('Generadores', gen_results),
        ('Operadores', oper_results),
        ('Transportistas', trans_results),
    ]
    total_missing = print_summary(results_list)

    print()
    sys.exit(1 if total_missing > 0 else 0)


if __name__ == '__main__':
    main()
