/** Mirrors the server's accepted decimal syntax; it does not validate a payment. */
export function validPaymentAmount(raw: string): boolean {
  let value = raw.trim().replace(/^\$\s*/, '').replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(value)) return false;
  if (value.includes(',')) {
    if (!/^\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(value)) return false;
    value = value.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(value)) value = value.replace(/\./g, '');
  return /^\d{1,12}(?:\.\d{1,2})?$/.test(value) && Number(value) > 0;
}

export function validPaymentDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
