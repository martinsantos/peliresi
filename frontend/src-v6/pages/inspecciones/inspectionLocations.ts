/** Read existing declarations only. A suggestion never changes the observed place or GPS. */
export interface DeclaredLocationSource {
  domicilio?: unknown;
  domicilioRealCalle?: unknown;
  domicilioRealLocalidad?: unknown;
  domicilioRealDepto?: unknown;
  domicilioLegalCalle?: unknown;
  domicilioLegalLocalidad?: unknown;
  domicilioLegalDepto?: unknown;
}

export interface InspectionLocationSuggestion {
  label: string;
  value: string;
}

type DeclaredReference = { codigo: string; valorDeclarado?: string | null };
const text = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

function streetAddress(street: unknown, locality: unknown, department: unknown) {
  const parts = [text(street), text(locality), text(department)];
  if (!parts[0]) return ''; // A department alone is not an address.
  return [...new Set(parts.filter(Boolean))].join(', ');
}

export function inspectionLocationSuggestions(actor?: DeclaredLocationSource | null, references?: DeclaredReference[]): InspectionLocationSuggestion[] {
  const options: InspectionLocationSuggestion[] = [];
  const seen = new Set<string>();
  const add = (label: string, raw: unknown) => {
    const value = text(raw);
    const key = value.toLocaleLowerCase('es-AR');
    if (!value || seen.has(key)) return;
    seen.add(key);
    options.push({ label, value });
  };

  if (references) {
    const frozen = references.find(row => row.codigo === 'CON-DOMICILIO');
    // An explicitly empty snapshot must not be replaced by a newer registry address.
    add('Domicilio declarado', frozen ? frozen.valorDeclarado : actor?.domicilio);
    const sites = references.find(row => row.codigo === 'EST-SEDES')?.valorDeclarado;
    if (typeof sites === 'string') sites.split(/\r?\n/).forEach(site => add('Sede declarada', site));
    return options;
  }

  add('Domicilio real', streetAddress(actor?.domicilioRealCalle, actor?.domicilioRealLocalidad, actor?.domicilioRealDepto));
  add('Domicilio declarado', actor?.domicilio);
  add('Domicilio legal', streetAddress(actor?.domicilioLegalCalle, actor?.domicilioLegalLocalidad, actor?.domicilioLegalDepto));
  return options;
}
