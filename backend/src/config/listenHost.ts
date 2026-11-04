/** Keep the API private unless an operator explicitly chooses another host. */
export function resolveListenHost(host: string | undefined, nodeEnv: string): string | undefined {
  return host?.trim() || (nodeEnv === 'production' ? '127.0.0.1' : undefined);
}
