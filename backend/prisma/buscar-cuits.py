#!/usr/bin/env python3
# buscar-cuits.py — busca CUITs por razón social via cuitonline.com
# Input:  /tmp/transporte.json (NDJSON, cada línea es un array CSV row)
# Output: /tmp/cuits-encontrados.json (NDJSON con resultados + similitud)
import json, re, time, sys, urllib.request, urllib.parse
from difflib import SequenceMatcher


def sim(a, b):
    return SequenceMatcher(None, a.upper(), b.upper()).ratio()


def normalize(name):
    # Quitar sufijos legales para mejor match
    name = re.sub(r'\b(S\.?A\.?|S\.?R\.?L\.?|S\.?A\.?S\.?|SRL|SA)\b', '', name, flags=re.I)
    return re.sub(r'\s+', ' ', name).strip()


def buscar(nombre):
    query = urllib.parse.quote(nombre)
    url = f'https://api.cuitonline.com/nombre/{query}'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read())
    except Exception as e:
        return []


def main():
    with open('/tmp/transporte.json') as f:
        rows = [json.loads(l) for l in f if l.strip()]

    sin_cuit = [(r[0], r[1], r) for r in rows if len(r) > 2 and not r[2].strip()]
    print(f'Empresas sin CUIT: {len(sin_cuit)}\n')

    resultados = []
    for caa_raw, razon, row in sin_cuit:
        caa = caa_raw.strip().replace(' - ', '-').replace(' -', '-')
        matches = buscar(normalize(razon)) or buscar(razon.split()[0])

        best, best_sim = None, 0
        for m in matches[:5]:
            s = sim(razon, m.get('denominacion', ''))
            if s > best_sim:
                best_sim, best = s, m

        estado = 'MATCH_PROBABLE' if best_sim > 0.65 else 'SIN_MATCH'
        entry = {
            'caa': caa,
            'razon': razon,
            'cuit_sugerido': best.get('cuit') if best else None,
            'denominacion_afip': best.get('denominacion') if best else None,
            'similitud': round(best_sim, 2),
            'estado': estado,
        }
        resultados.append(entry)
        icon = '✓' if estado == 'MATCH_PROBABLE' else '?'
        print(f'{icon} {caa:<12} {razon[:35]:<35} → {entry["cuit_sugerido"] or "NO ENCONTRADO"} ({best_sim:.0%})')
        time.sleep(0.8)

    with open('/tmp/cuits-encontrados.json', 'w') as out:
        for r in resultados:
            out.write(json.dumps(r, ensure_ascii=False) + '\n')

    matches = sum(1 for r in resultados if r['estado'] == 'MATCH_PROBABLE')
    print(f'\n=== RESULTADO ===')
    print(f'Matches probables (>65%): {matches}/{len(resultados)}')
    print(f'Sin match:                {len(resultados) - matches}/{len(resultados)}')
    print(f'Guardado en: /tmp/cuits-encontrados.json')
    print('IMPORTANTE: Revisar manualmente antes de importar al sistema')


main()
