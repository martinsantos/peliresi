/** Use the joined manifest number without repeating a reference already in the notice. */
export function notificationManifestReference(notice: { manifiesto?: { numero?: string | null } | null; titulo?: string | null; mensaje?: string | null }): string | null {
  const number = notice.manifiesto?.numero?.trim();
  if (!number || `${notice.titulo || ''}\n${notice.mensaje || ''}`.includes(number)) return null;
  return `Manifiesto ${number}`;
}
