export function appendDictatedText(existing: string, spoken: string): string {
  const phrase = spoken.trim();
  if (!phrase) return existing;
  return `${existing}${existing && !/\s$/.test(existing) ? ' ' : ''}${phrase}`;
}
