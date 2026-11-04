import { identityCuit } from './identityCuit';

export type CompanyFieldErrors = Record<string, string | undefined>;
const textError = (value: string, max: number, required = false): string | undefined =>
  required && !value.trim() ? 'Completá este dato para continuar.'
    : value.trim().length > max ? `Usá hasta ${max} caracteres.` : undefined;
export const companyReasonError = (value: string) => textError(value, 500, true);
export function companyEmailError(value: string): string | undefined {
  const text = value.trim();
  if (!text) return 'Ingresá el correo de la persona.';
  if (text.length > 254) return 'Usá hasta 254 caracteres.';
  // Same email shape as the server schema; validity never grants access.
  return /^(?:[A-Za-z0-9_'+-]+\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/.test(text)
    ? undefined : 'Ingresá un correo válido, por ejemplo nombre@empresa.com.';
}
export function companyIdentityErrors(form: { cuit?: string; razonSocial: string; nombreFantasia?: string; calle: string; localidad: string; departamento: string; motivo?: string }, create: boolean): CompanyFieldErrors {
  return {
    ...(create ? { cuit: /^(?:\d{11}|\d{2}-\d{8}-\d)$/.test(form.cuit?.trim() || '') && identityCuit(form.cuit || '') ? undefined : 'Revisá el CUIT: ingresá 11 dígitos válidos, con o sin guiones.' } : {}),
    razonSocial: textError(form.razonSocial, 250, true), nombreFantasia: textError(form.nombreFantasia || '', 250),
    calle: textError(form.calle, 300), localidad: textError(form.localidad, 150), departamento: textError(form.departamento, 100),
    ...(!create ? { motivo: companyReasonError(form.motivo || '') } : {}),
  };
}
export function companySiteErrors(form: { codigo: string; nombre: string; domicilio: string; localidad: string; departamento: string; certificados: string; motivo: string }, edit: boolean): CompanyFieldErrors {
  const certificates = form.certificados.split(',').map(item => item.trim()).filter(Boolean);
  return {
    codigo: textError(form.codigo, 80, true), nombre: textError(form.nombre, 200, true), domicilio: textError(form.domicilio, 300),
    localidad: textError(form.localidad, 150), departamento: textError(form.departamento, 100),
    certificados: certificates.length > 100 ? 'Ingresá hasta 100 certificados, separados por coma.'
      : certificates.some(item => item.length > 100) ? 'Cada certificado admite hasta 100 caracteres.' : undefined,
    ...(edit ? { motivo: companyReasonError(form.motivo) } : {}),
  };
}
