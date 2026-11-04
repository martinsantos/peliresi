/** URL parsing strips ASCII controls; reject them before normalizing a return target. */
export function hasAsciiControlCharacters(value: string): boolean {
  return Array.from(value).some(character => character.charCodeAt(0) < 32);
}
