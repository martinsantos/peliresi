/**
 * Match an IPv4 address against an exact address, an IPv4 CIDR, or `*`.
 * The demo allowlist is intentionally small and this helper does not accept
 * malformed rules, so a typo fails closed instead of widening access.
 */
function parseIpv4(value: string): number | null {
  const octets = value.trim().split('.');
  if (octets.length !== 4 || octets.some((octet) => !/^\d{1,3}$/.test(octet))) return null;

  const numbers = octets.map(Number);
  if (numbers.some((octet) => octet < 0 || octet > 255)) return null;
  return (((numbers[0] * 256 + numbers[1]) * 256 + numbers[2]) * 256 + numbers[3]) >>> 0;
}

export function ipMatchesAllowlistRule(ip: string, rule: string): boolean {
  const normalizedIp = ip.replace(/^::ffff:/i, '').trim();
  const normalizedRule = rule.trim();
  if (!normalizedIp || !normalizedRule) return false;
  if (normalizedRule === '*') return true;

  const slash = normalizedRule.indexOf('/');
  if (slash === -1) return normalizedIp === normalizedRule;

  const base = parseIpv4(normalizedRule.slice(0, slash));
  const prefixText = normalizedRule.slice(slash + 1);
  if (base === null || !/^\d{1,2}$/.test(prefixText)) return false;
  const prefix = Number(prefixText);
  if (prefix < 0 || prefix > 32) return false;

  const candidate = parseIpv4(normalizedIp);
  if (candidate === null) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (candidate & mask) === (base & mask);
}

export function ipMatchesAllowlist(ip: string, rules: string[]): boolean {
  return rules.some((rule) => ipMatchesAllowlistRule(ip, rule));
}
